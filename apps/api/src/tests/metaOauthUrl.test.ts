import { describe, expect, it } from 'vitest';
import { META_OAUTH_SCOPES } from '@woonwork/shared';
import { AppError } from '../lib/errors';
import { env } from '../config/env';
import {
  buildMetaOauthUrl,
  normalizeMetaAccessTokenResponse,
} from '../services/meta/metaGraphClient';

describe('buildMetaOauthUrl — Facebook Login for Business', () => {
  it('OAuth start URL içinde Configuration ID (config_id) bulunur', () => {
    expect(env.META_LOGIN_CONFIG_ID).toBeTruthy();

    const url = new URL(buildMetaOauthUrl('csrf-state-fixture', META_OAUTH_SCOPES));

    expect(url.origin + url.pathname).toBe(
      `https://www.facebook.com/${env.META_GRAPH_API_VERSION}/dialog/oauth`,
    );
    expect(url.searchParams.get('client_id')).toBe(env.META_APP_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(env.META_OAUTH_REDIRECT_URI);
    expect(url.searchParams.get('state')).toBe('csrf-state-fixture');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe(META_OAUTH_SCOPES.join(','));
    expect(url.searchParams.get('config_id')).toBe(env.META_LOGIN_CONFIG_ID);

    const raw = url.toString();
    expect(raw).not.toMatch(/client_secret/i);
    expect(raw).not.toContain(env.META_APP_SECRET ?? '___missing_secret___');
    expect(raw).not.toMatch(/access_token/i);
  });
});

describe('normalizeMetaAccessTokenResponse — SYSTEM-USER exchange', () => {
  it('flat access_token response parse eder; expires yoksa null', () => {
    const normalized = normalizeMetaAccessTokenResponse({
      access_token: 'suat-flat',
      token_type: 'bearer',
    });
    expect(normalized.accessToken).toBe('suat-flat');
    expect(normalized.tokenType).toBe('bearer');
    expect(normalized.expiresIn).toBeNull();
  });

  it('wrapped data.access_token response normalize eder', () => {
    const normalized = normalizeMetaAccessTokenResponse({
      data: { access_token: 'suat-nested', expires_in: 0 },
    });
    expect(normalized.accessToken).toBe('suat-nested');
    expect(normalized.expiresIn).toBeNull();
  });

  it('geçerli expires_in korunur', () => {
    const normalized = normalizeMetaAccessTokenResponse({
      access_token: 'suat-exp',
      expires_in: 3600,
    });
    expect(normalized.expiresIn).toBe(3600);
  });

  it('token yoksa hata verir', () => {
    expect(() => normalizeMetaAccessTokenResponse({})).toThrow(AppError);
  });
});
