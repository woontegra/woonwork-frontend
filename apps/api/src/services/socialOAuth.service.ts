import { randomBytes } from 'crypto';
import { META_OAUTH_SCOPES } from '@woonwork/shared';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { AccessContext } from './contentAccess.service';
import {
  assertMetaConfigured,
  buildMetaOauthUrl,
  exchangeLongLivedUserToken,
  exchangeOauthCode,
  metaGet,
} from './meta/metaGraphClient';
import { encryptToken } from './tokenEncryption.service';

const STATE_TTL_MS = 10 * 60 * 1000;
const OUTCOME_TTL_MS = 15 * 60 * 1000;

type MetaOauthSessionOutcome =
  | { status: 'SUCCESS'; connectionId: string; reconnected: boolean; at: number }
  | { status: 'FAILED'; error: string; at: number };

/** In-memory OAuth completion outcomes for opener-less / postMessage-fallback polling. */
const metaOauthOutcomes = new Map<string, MetaOauthSessionOutcome>();

function pruneMetaOauthOutcomes() {
  const cutoff = Date.now() - OUTCOME_TTL_MS;
  for (const [id, outcome] of metaOauthOutcomes) {
    if (outcome.at < cutoff) metaOauthOutcomes.delete(id);
  }
}

export function rememberMetaOauthSuccess(
  sessionId: string,
  connectionId: string,
  reconnected: boolean,
) {
  pruneMetaOauthOutcomes();
  metaOauthOutcomes.set(sessionId, {
    status: 'SUCCESS',
    connectionId,
    reconnected,
    at: Date.now(),
  });
}

export function rememberMetaOauthFailure(sessionId: string, error: string) {
  pruneMetaOauthOutcomes();
  metaOauthOutcomes.set(sessionId, {
    status: 'FAILED',
    error: error.replace(/[^A-Z0-9_]/gi, '').slice(0, 80) || 'OAUTH_FAILED',
    at: Date.now(),
  });
}

/** Test helper — clears in-memory outcomes. */
export function clearMetaOauthOutcomesForTests() {
  metaOauthOutcomes.clear();
}

export type MetaOauthStatusResult =
  | { status: 'PENDING' }
  | { status: 'EXPIRED' }
  | { status: 'SUCCESS'; connectionId: string; reconnected: boolean }
  | { status: 'FAILED'; error: string };

export async function getMetaOauthStatus(
  ctx: AccessContext,
  sessionId: string,
): Promise<MetaOauthStatusResult> {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new AppError(400, 'OAUTH_SESSION_INVALID', 'OAuth oturumu geçersiz');
  }

  const session = await prisma.socialOAuthSession.findFirst({
    where: {
      id: sessionId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      provider: 'META',
    },
  });
  if (!session) {
    throw new AppError(404, 'OAUTH_SESSION_NOT_FOUND', 'OAuth oturumu bulunamadı');
  }

  const outcome = metaOauthOutcomes.get(sessionId);
  if (outcome?.status === 'SUCCESS') {
    return {
      status: 'SUCCESS',
      connectionId: outcome.connectionId,
      reconnected: outcome.reconnected,
    };
  }
  if (outcome?.status === 'FAILED') {
    return { status: 'FAILED', error: outcome.error };
  }

  if (session.expiresAt.getTime() < Date.now() && !session.consumedAt) {
    return { status: 'EXPIRED' };
  }

  // Process restart after consume: recover recent CONNECTED connection for this user.
  if (session.consumedAt && !outcome) {
    const recent = await prisma.socialConnection.findFirst({
      where: {
        tenantId: ctx.tenantId,
        provider: 'META',
        status: 'CONNECTED',
        OR: [{ createdById: ctx.userId }, { id: session.reconnectConnectionId ?? '__none__' }],
        updatedAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (recent) {
      return {
        status: 'SUCCESS',
        connectionId: recent.id,
        reconnected: Boolean(session.reconnectConnectionId),
      };
    }
  }

  return { status: 'PENDING' };
}

function isLoginForBusinessSystemUserFlow() {
  // config_id + SYSTEM-USER token type configuration (never-expiring SUAT)
  return Boolean(env.META_LOGIN_CONFIG_ID);
}

function connectionGrantedScopes() {
  if (isLoginForBusinessSystemUserFlow()) {
    return {
      scopes: [...META_OAUTH_SCOPES],
      tokenType: 'SYSTEM_USER' as const,
      configId: env.META_LOGIN_CONFIG_ID,
    };
  }
  return [...META_OAUTH_SCOPES];
}

export type DiscoveredInstagram = {
  id: string;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  accountType: string | null;
};

export type DiscoveredPage = {
  pageId: string;
  name: string;
  tasks: string[];
  instagram: DiscoveredInstagram | null;
  instagramUnlinkedReason: string | null;
};

type GraphPage = {
  id: string;
  name?: string;
  access_token?: string;
  tasks?: string[];
  instagram_business_account?: {
    id: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
    account_type?: string;
  } | null;
};

export async function startMetaOauth(
  ctx: AccessContext,
  opts?: { reconnectConnectionId?: string | null },
) {
  assertMetaConfigured();
  if (opts?.reconnectConnectionId) {
    const existing = await prisma.socialConnection.findFirst({
      where: { id: opts.reconnectConnectionId, tenantId: ctx.tenantId, provider: 'META' },
    });
    if (!existing) throw new AppError(404, 'CONNECTION_NOT_FOUND', 'Meta bağlantısı bulunamadı');
  }

  const state = randomBytes(32).toString('hex');
  const session = await prisma.socialOAuthSession.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      provider: 'META',
      state,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
      reconnectConnectionId: opts?.reconnectConnectionId ?? null,
    },
  });

  return {
    authorizationUrl: buildMetaOauthUrl(state, META_OAUTH_SCOPES),
    sessionId: session.id,
  };
}

export async function handleMetaOauthCallback(code: string | undefined, state: string | undefined) {
  assertMetaConfigured();
  if (!state) throw new AppError(400, 'OAUTH_STATE_INVALID', 'OAuth state eksik');
  if (!code) throw new AppError(400, 'OAUTH_CODE_INVALID', 'OAuth yetkilendirme kodu eksik');

  const session = await prisma.socialOAuthSession.findUnique({ where: { state } });
  if (!session) throw new AppError(400, 'OAUTH_STATE_INVALID', 'OAuth state geçersiz');
  if (session.consumedAt) throw new AppError(400, 'OAUTH_STATE_INVALID', 'OAuth state daha önce kullanıldı');
  if (session.expiresAt.getTime() < Date.now()) {
    throw new AppError(400, 'OAUTH_STATE_EXPIRED', 'OAuth oturumu süresi doldu');
  }

  await prisma.socialOAuthSession.update({
    where: { id: session.id },
    data: { consumedAt: new Date() },
  });

  const exchanged = await exchangeOauthCode(code, env.META_OAUTH_REDIRECT_URI);
  let accessToken = exchanged.data.access_token;
  let expiresAt: Date | null = exchanged.data.expires_in
    ? new Date(Date.now() + exchanged.data.expires_in * 1000)
    : null;

  // Facebook Login for Business SYSTEM-USER config: code exchange already yields the
  // business integration token. Do not run fb_exchange_token (user long-lived) flow.
  if (!isLoginForBusinessSystemUserFlow()) {
    try {
      const longLived = await exchangeLongLivedUserToken(accessToken);
      accessToken = longLived.data.access_token;
      expiresAt = longLived.data.expires_in
        ? new Date(Date.now() + longLived.data.expires_in * 1000)
        : expiresAt;
    } catch {
      // short-lived user token still usable for discovery
    }
  }

  const me = await metaGet<{ id: string; name?: string }>(`me`, accessToken, { fields: 'id,name' });
  const encrypted = encryptToken(accessToken);
  const scopes = connectionGrantedScopes();

  let connectionId = session.reconnectConnectionId;
  if (connectionId) {
    const existing = await prisma.socialConnection.findFirst({
      where: { id: connectionId, tenantId: session.tenantId, provider: 'META' },
    });
    if (!existing) connectionId = null;
  }

  const connection = connectionId
    ? await prisma.socialConnection.update({
        where: { id: connectionId },
        data: {
          externalUserId: me.data.id,
          accessTokenEncrypted: encrypted.ciphertext,
          accessTokenIv: encrypted.iv,
          accessTokenTag: encrypted.authTag,
          expiresAt,
          grantedScopes: scopes,
          status: 'CONNECTED',
        },
      })
    : await prisma.socialConnection.create({
        data: {
          tenantId: session.tenantId,
          provider: 'META',
          externalUserId: me.data.id,
          accessTokenEncrypted: encrypted.ciphertext,
          accessTokenIv: encrypted.iv,
          accessTokenTag: encrypted.authTag,
          expiresAt,
          grantedScopes: scopes,
          status: 'CONNECTED',
          createdById: session.userId,
        },
      });

  if (connectionId) {
    await refreshAccountTokensFromConnection(session.tenantId, connection.id, accessToken);
  }

  const reconnected = Boolean(connectionId);
  rememberMetaOauthSuccess(session.id, connection.id, reconnected);
  return {
    connectionId: connection.id,
    sessionId: session.id,
    tenantId: session.tenantId,
    reconnected,
  };
}

/**
 * Best-effort: mark a session failed from the callback error path when state is known.
 * Does not throw — used only for polling fallback.
 */
export async function markMetaOauthFailedByState(state: string | undefined, errorCode: string) {
  if (!state) return;
  const session = await prisma.socialOAuthSession.findUnique({ where: { state } });
  if (!session) return;
  rememberMetaOauthFailure(session.id, errorCode);
}

export async function discoverMetaPages(ctx: AccessContext, connectionId?: string) {
  const connection = await prisma.socialConnection.findFirst({
    where: {
      tenantId: ctx.tenantId,
      provider: 'META',
      ...(connectionId ? { id: connectionId } : { status: 'CONNECTED' }),
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (!connection) throw new AppError(404, 'CONNECTION_NOT_FOUND', 'Meta bağlantısı bulunamadı');
  if (connection.status === 'REVOKED') {
    throw new AppError(400, 'CONNECTION_REVOKED', 'Meta bağlantısı kesilmiş. Yeniden bağlanın.');
  }

  const { decryptStoredToken } = await import('./tokenEncryption.service');
  const userToken = decryptStoredToken(connection);
  const pages = await fetchDiscoverablePages(userToken);
  return {
    connectionId: connection.id,
    connectionStatus: connection.status,
    pages: pages.map((page) => ({
      pageId: page.pageId,
      name: page.name,
      tasks: page.tasks,
      instagram: page.instagram,
      instagramUnlinkedReason: page.instagramUnlinkedReason,
    })),
  };
}

export async function fetchDiscoverablePages(userToken: string): Promise<DiscoveredPage[]> {
  const res = await metaGet<{ data?: GraphPage[] }>('me/accounts', userToken, {
    fields:
      'id,name,access_token,tasks,instagram_business_account{id,username,name,profile_picture_url}',
    limit: 100,
  });
  const pages = res.data.data ?? [];
  return pages.map((page) => {
    const ig = page.instagram_business_account;
    const accountType = ig?.account_type?.toUpperCase() ?? null;
    const professional = !accountType || accountType === 'BUSINESS' || accountType === 'CREATOR' || accountType === 'MEDIA_CREATOR';
    return {
      pageId: page.id,
      name: page.name || 'Facebook Sayfası',
      tasks: page.tasks ?? [],
      instagram:
        ig && professional
          ? {
              id: ig.id,
              username: ig.username ?? null,
              name: ig.name ?? null,
              profilePictureUrl: ig.profile_picture_url ?? null,
              accountType: accountType,
            }
          : null,
      instagramUnlinkedReason: ig
        ? professional
          ? null
          : 'Yalnız Instagram Professional (Business/Creator) hesaplar desteklenir.'
        : 'Bu Instagram hesabı bir Facebook Sayfasına bağlı değil.',
    };
  });
}

export async function fetchPageAccessMap(userToken: string) {
  const res = await metaGet<{ data?: GraphPage[] }>('me/accounts', userToken, {
    fields:
      'id,name,access_token,tasks,instagram_business_account{id,username,name,profile_picture_url}',
    limit: 100,
  });
  const map = new Map<string, GraphPage>();
  for (const page of res.data.data ?? []) {
    map.set(page.id, page);
  }
  return map;
}

async function refreshAccountTokensFromConnection(
  tenantId: string,
  connectionId: string,
  userToken: string,
) {
  const accounts = await prisma.socialAccount.findMany({
    where: { tenantId, socialConnectionId: connectionId },
  });
  if (!accounts.length) return;
  const pageMap = await fetchPageAccessMap(userToken);
  const { encryptToken: enc } = await import('./tokenEncryption.service');

  for (const account of accounts) {
    const pageId = account.platform === 'FACEBOOK' ? account.externalAccountId : account.parentExternalId;
    if (!pageId) continue;
    const page = pageMap.get(pageId);
    if (!page?.access_token) {
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: { connectionStatus: 'EXPIRED' },
      });
      continue;
    }
    const token = enc(page.access_token);
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        accessTokenEncrypted: token.ciphertext,
        accessTokenIv: token.iv,
        accessTokenTag: token.authTag,
        connectionStatus: 'CONNECTED',
        isActive: true,
        name: account.platform === 'FACEBOOK' ? page.name || account.name : account.name,
        username:
          account.platform === 'INSTAGRAM'
            ? page.instagram_business_account?.username ?? account.username
            : account.username,
        profilePictureUrl:
          account.platform === 'INSTAGRAM'
            ? page.instagram_business_account?.profile_picture_url ?? account.profilePictureUrl
            : account.profilePictureUrl,
      },
    });
  }

  await prisma.socialConnection.update({
    where: { id: connectionId },
    data: { status: 'CONNECTED' },
  });
}
