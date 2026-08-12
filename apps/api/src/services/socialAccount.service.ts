import {
  connectMetaAccountsSchema,
  updateSocialAccountSchema,
  type ConnectMetaAccountsInput,
  type UpdateSocialAccountInput,
} from '@woonwork/shared';
import { hasMinRole } from '@woonwork/shared';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { AccessContext } from './contentAccess.service';
import { fetchPageAccessMap } from './socialOAuth.service';
import { decryptStoredToken, encryptToken } from './tokenEncryption.service';

const accountPublicSelect = {
  id: true,
  tenantId: true,
  socialConnectionId: true,
  socialBrandId: true,
  platform: true,
  externalAccountId: true,
  parentExternalId: true,
  name: true,
  username: true,
  profilePictureUrl: true,
  accountType: true,
  tokenExpiresAt: true,
  isActive: true,
  connectionStatus: true,
  createdAt: true,
  updatedAt: true,
  brand: { select: { id: true, name: true, color: true } },
  connection: { select: { id: true, provider: true, status: true, expiresAt: true } },
} as const;

export function assertNoTokenLeak(payload: unknown) {
  const json = JSON.stringify(payload);
  if (
    /accessToken/i.test(json) ||
    /access_token/i.test(json) ||
    /"ciphertext"/i.test(json) ||
    /accessTokenEncrypted/i.test(json)
  ) {
    throw new AppError(500, 'TOKEN_LEAK_PREVENTED', 'Yanıt token alanı içeremez');
  }
}

export async function listSocialAccounts(ctx: AccessContext, activeOnly = false) {
  return prisma.socialAccount.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(activeOnly ? { isActive: true } : {}),
    },
    select: accountPublicSelect,
    orderBy: [{ platform: 'asc' }, { name: 'asc' }],
  });
}

export async function connectMetaAccounts(ctx: AccessContext, raw: ConnectMetaAccountsInput) {
  if (!hasMinRole(ctx.tenantRole, 'MEMBER')) {
    throw new AppError(403, 'FORBIDDEN', 'Hesap bağlama yetkiniz yok');
  }
  const input = connectMetaAccountsSchema.parse(raw);
  const connection = await prisma.socialConnection.findFirst({
    where: { id: input.connectionId, tenantId: ctx.tenantId, provider: 'META' },
  });
  if (!connection) throw new AppError(404, 'CONNECTION_NOT_FOUND', 'Meta bağlantısı bulunamadı');

  if (input.socialBrandId) {
    const brand = await prisma.socialBrand.findFirst({
      where: { id: input.socialBrandId, tenantId: ctx.tenantId },
    });
    if (!brand) throw new AppError(400, 'INVALID_BRAND', 'Marka bulunamadı');
  }

  const userToken = decryptStoredToken(connection);
  const pageMap = await fetchPageAccessMap(userToken);
  const createdIds: string[] = [];

  for (const pageSel of input.pages) {
    const page = pageMap.get(pageSel.pageId);
    if (!page?.access_token) {
      throw new AppError(400, 'PAGE_NOT_FOUND', `Facebook sayfası bulunamadı veya erişim yok: ${pageSel.pageId}`);
    }
    const pageToken = encryptToken(page.access_token);
    const ig = page.instagram_business_account;

    if (pageSel.connectFacebook) {
      const account = await prisma.socialAccount.upsert({
        where: {
          tenantId_platform_externalAccountId: {
            tenantId: ctx.tenantId,
            platform: 'FACEBOOK',
            externalAccountId: page.id,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          socialConnectionId: connection.id,
          socialBrandId: input.socialBrandId ?? null,
          platform: 'FACEBOOK',
          externalAccountId: page.id,
          name: page.name || 'Facebook Sayfası',
          accessTokenEncrypted: pageToken.ciphertext,
          accessTokenIv: pageToken.iv,
          accessTokenTag: pageToken.authTag,
          isActive: true,
          connectionStatus: 'CONNECTED',
          metadata: { tasks: page.tasks ?? [] },
        },
        update: {
          socialConnectionId: connection.id,
          socialBrandId: input.socialBrandId ?? undefined,
          name: page.name || 'Facebook Sayfası',
          accessTokenEncrypted: pageToken.ciphertext,
          accessTokenIv: pageToken.iv,
          accessTokenTag: pageToken.authTag,
          isActive: true,
          connectionStatus: 'CONNECTED',
          metadata: { tasks: page.tasks ?? [] },
        },
      });
      createdIds.push(account.id);
    }

    if (pageSel.connectInstagram) {
      if (!ig?.id) {
        throw new AppError(
          400,
          'IG_NOT_LINKED',
          'Bu Instagram hesabı bir Facebook Sayfasına bağlı değil.',
        );
      }
      const accountType = ig.account_type?.toUpperCase() ?? null;
      if (accountType && accountType !== 'BUSINESS' && accountType !== 'CREATOR' && accountType !== 'MEDIA_CREATOR') {
        throw new AppError(400, 'IG_NOT_PROFESSIONAL', 'Yalnız Instagram Professional hesaplar desteklenir.');
      }
      const account = await prisma.socialAccount.upsert({
        where: {
          tenantId_platform_externalAccountId: {
            tenantId: ctx.tenantId,
            platform: 'INSTAGRAM',
            externalAccountId: ig.id,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          socialConnectionId: connection.id,
          socialBrandId: input.socialBrandId ?? null,
          platform: 'INSTAGRAM',
          externalAccountId: ig.id,
          parentExternalId: page.id,
          name: ig.name || ig.username || 'Instagram',
          username: ig.username ?? null,
          profilePictureUrl: ig.profile_picture_url ?? null,
          accountType,
          accessTokenEncrypted: pageToken.ciphertext,
          accessTokenIv: pageToken.iv,
          accessTokenTag: pageToken.authTag,
          isActive: true,
          connectionStatus: 'CONNECTED',
        },
        update: {
          socialConnectionId: connection.id,
          socialBrandId: input.socialBrandId ?? undefined,
          parentExternalId: page.id,
          name: ig.name || ig.username || 'Instagram',
          username: ig.username ?? null,
          profilePictureUrl: ig.profile_picture_url ?? null,
          accountType,
          accessTokenEncrypted: pageToken.ciphertext,
          accessTokenIv: pageToken.iv,
          accessTokenTag: pageToken.authTag,
          isActive: true,
          connectionStatus: 'CONNECTED',
        },
      });
      createdIds.push(account.id);
    }
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { tenantId: ctx.tenantId, id: { in: createdIds } },
    select: accountPublicSelect,
  });
  assertNoTokenLeak(accounts);
  return accounts;
}

export async function updateSocialAccount(
  ctx: AccessContext,
  id: string,
  raw: UpdateSocialAccountInput,
) {
  if (!hasMinRole(ctx.tenantRole, 'MEMBER')) {
    throw new AppError(403, 'FORBIDDEN', 'Hesap güncelleme yetkiniz yok');
  }
  const input = updateSocialAccountSchema.parse(raw);
  const account = await prisma.socialAccount.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Sosyal hesap bulunamadı');

  if (input.socialBrandId) {
    const brand = await prisma.socialBrand.findFirst({
      where: { id: input.socialBrandId, tenantId: ctx.tenantId },
    });
    if (!brand) throw new AppError(400, 'INVALID_BRAND', 'Marka bulunamadı');
  }

  return prisma.socialAccount.update({
    where: { id },
    data: {
      ...(input.socialBrandId !== undefined ? { socialBrandId: input.socialBrandId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: accountPublicSelect,
  });
}

export async function disconnectSocialAccount(ctx: AccessContext, id: string) {
  if (!hasMinRole(ctx.tenantRole, 'MEMBER')) {
    throw new AppError(403, 'FORBIDDEN', 'Hesap bağlantısını kesme yetkiniz yok');
  }
  const account = await prisma.socialAccount.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Sosyal hesap bulunamadı');

  const updated = await prisma.socialAccount.update({
    where: { id },
    data: {
      isActive: false,
      connectionStatus: 'REVOKED',
      accessTokenEncrypted: null,
      accessTokenIv: null,
      accessTokenTag: null,
    },
    select: accountPublicSelect,
  });
  return updated;
}

export async function markAccountExpired(accountId: string, connectionId?: string | null) {
  await prisma.socialAccount.update({
    where: { id: accountId },
    data: { connectionStatus: 'EXPIRED' },
  });
  if (connectionId) {
    await prisma.socialConnection.update({
      where: { id: connectionId },
      data: { status: 'EXPIRED' },
    });
  }
}
