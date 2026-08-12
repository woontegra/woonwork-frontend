import { beforeEach, describe, expect, it } from 'vitest';
import {
  META_OAUTH_MSG_ERROR,
  META_OAUTH_MSG_SUCCESS,
  isTrustedFrontendOrigin,
  parseMetaOauthMessage,
} from '@woonwork/shared';
import {
  assertCompletionHtmlSafe,
  buildMetaOauthErrorHtml,
  buildMetaOauthSuccessHtml,
  metaOauthCompletionHeaders,
} from '../services/meta/metaOauthCompletion';
import {
  clearMetaOauthOutcomesForTests,
  getMetaOauthStatus,
  rememberMetaOauthFailure,
  rememberMetaOauthSuccess,
} from '../services/socialOAuth.service';
import { prisma } from '../lib/prisma';

describe('Meta OAuth popup completion HTML', () => {
  it('success HTML contains executable script + postMessage + close', () => {
    const html = buildMetaOauthSuccessHtml({
      connectionId: 'clxxxxxxxxxxxxxxxxxxxx',
      reconnected: false,
    });
    expect(html).toContain('<script>');
    expect(html).toContain(META_OAUTH_MSG_SUCCESS);
    expect(html).toContain('connectionId');
    expect(html).toContain('postMessage');
    expect(html).toContain('window.close');
    expect(html).toContain('window.opener');
    expect(html).toMatch(/setTimeout\(function \(\) \{[\s\S]*window\.close/);
    expect(html).not.toMatch(/access_token|client_secret|ciphertext/i);
    expect(() => assertCompletionHtmlSafe(html)).not.toThrow();
  });

  it('success HTML uses FRONTEND_URL targetOrigin', () => {
    const html = buildMetaOauthSuccessHtml({
      connectionId: 'clxxxxxxxxxxxxxxxxxxxx',
      reconnected: false,
    });
    expect(html).toMatch(/targetOrigin = 'http:\/\/localhost:517[0-9]'/);
    expect(html).toContain("type: 'WOONWORK_META_OAUTH_SUCCESS'");
  });

  it('dev HTML exposes opener/message/close debug lines without secrets', () => {
    const html = buildMetaOauthSuccessHtml({
      connectionId: 'clxxxxxxxxxxxxxxxxxxxx',
      reconnected: false,
    });
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      // NODE_ENV=test → isDev() is false; still assert script updates debug statuses.
      expect(html).toContain("opener: ' + (openerAvailable ? 'available' : 'missing')");
      expect(html).toContain("message: ' + messageStatus");
      expect(html).toContain("'close: attempted'");
    }
    expect(html).not.toMatch(/access_token|META_APP_SECRET|Bearer/i);
  });

  it('error HTML güvenli error code gönderir, token içermez', () => {
    const html = buildMetaOauthErrorHtml('OAUTH_STATE_INVALID');
    expect(html).toContain('<script>');
    expect(html).toContain(META_OAUTH_MSG_ERROR);
    expect(html).toContain('OAUTH_STATE_INVALID');
    expect(html).toContain('postMessage');
    expect(html).not.toMatch(/access_token|secret/i);
    expect(() => assertCompletionHtmlSafe(html)).not.toThrow();
  });

  it('completion response headers allow inline script and keep opener', () => {
    const headers = metaOauthCompletionHeaders();
    expect(headers['Content-Type']).toMatch(/text\/html/);
    expect(headers['Content-Security-Policy']).toContain("script-src 'unsafe-inline'");
    expect(headers['Cross-Origin-Opener-Policy']).toBe('unsafe-none');
  });

  it('assertCompletionHtmlSafe token sızıntısını yakalar', () => {
    expect(() => assertCompletionHtmlSafe('<script>var access_token="x"</script>')).toThrow();
  });
});

describe('Meta OAuth postMessage protocol', () => {
  it('success message parse eder', () => {
    expect(
      parseMetaOauthMessage({
        type: META_OAUTH_MSG_SUCCESS,
        connectionId: 'conn_1',
        reconnected: true,
      }),
    ).toEqual({
      type: META_OAUTH_MSG_SUCCESS,
      connectionId: 'conn_1',
      reconnected: true,
    });
  });

  it('error message sanitize eder', () => {
    expect(
      parseMetaOauthMessage({
        type: META_OAUTH_MSG_ERROR,
        error: 'OAUTH_FAILED<script>',
      }),
    ).toEqual({
      type: META_OAUTH_MSG_ERROR,
      error: 'OAUTH_FAILEDscript',
    });
  });

  it('callback sender origin (API) kabul, yabancı origin reddedilir', () => {
    // Completion page is served from API → event.origin is API origin.
    expect(isTrustedFrontendOrigin('http://localhost:4000', 'http://localhost:4000')).toBe(true);
    expect(isTrustedFrontendOrigin('http://localhost:4000', 'http://localhost:5175')).toBe(false);
    expect(isTrustedFrontendOrigin('https://evil.example', 'http://localhost:4000')).toBe(false);
    expect(isTrustedFrontendOrigin('http://localhost:5175', 'http://localhost:5175')).toBe(true);
  });

  it('bilinmeyen message ignore', () => {
    expect(parseMetaOauthMessage({ type: 'OTHER' })).toBeNull();
    expect(parseMetaOauthMessage(null)).toBeNull();
  });
});

describe('Meta OAuth status polling fallback', () => {
  beforeEach(() => {
    clearMetaOauthOutcomesForTests();
  });

  it('remembered SUCCESS is returned for matching tenant/user session', async () => {
    const stamp = Date.now();
    const tenant = await prisma.tenant.create({
      data: { name: `Poll T ${stamp}`, slug: `poll-t-${stamp}` },
    });
    const user = await prisma.user.create({
      data: {
        email: `poll-u-${stamp}@test.local`,
        passwordHash: 'x',
        firstName: 'Poll',
        lastName: 'User',
      },
    });
    await prisma.tenantMember.create({
      data: { tenantId: tenant.id, userId: user.id, role: 'OWNER' },
    });
    const session = await prisma.socialOAuthSession.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        provider: 'META',
        state: `state-${stamp}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    rememberMetaOauthSuccess(session.id, 'conn_poll_1', false);
    const status = await getMetaOauthStatus(
      { tenantId: tenant.id, userId: user.id, tenantRole: 'OWNER' },
      session.id,
    );
    expect(status).toEqual({
      status: 'SUCCESS',
      connectionId: 'conn_poll_1',
      reconnected: false,
    });
    expect(JSON.stringify(status)).not.toMatch(/access_token|secret/i);

    rememberMetaOauthFailure(session.id, 'OAUTH_FAILED');
    const failed = await getMetaOauthStatus(
      { tenantId: tenant.id, userId: user.id, tenantRole: 'OWNER' },
      session.id,
    );
    expect(failed).toEqual({ status: 'FAILED', error: 'OAUTH_FAILED' });

    await prisma.socialOAuthSession.deleteMany({ where: { id: session.id } });
    await prisma.tenantMember.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('PENDING when session open and no outcome', async () => {
    const stamp = Date.now();
    const tenant = await prisma.tenant.create({
      data: { name: `Poll T2 ${stamp}`, slug: `poll-t2-${stamp}` },
    });
    const user = await prisma.user.create({
      data: {
        email: `poll-u2-${stamp}@test.local`,
        passwordHash: 'x',
        firstName: 'Poll',
        lastName: 'Two',
      },
    });
    const session = await prisma.socialOAuthSession.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        provider: 'META',
        state: `state2-${stamp}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const status = await getMetaOauthStatus(
      { tenantId: tenant.id, userId: user.id, tenantRole: 'MEMBER' },
      session.id,
    );
    expect(status).toEqual({ status: 'PENDING' });

    await prisma.socialOAuthSession.deleteMany({ where: { id: session.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
