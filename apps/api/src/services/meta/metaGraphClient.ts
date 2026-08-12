import { env } from '../../config/env';
import { AppError } from '../../lib/errors';

export type MetaGraphErrorBody = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

export class MetaApiError extends Error {
  readonly code: number;
  readonly subcode?: number;
  readonly type?: string;
  readonly requestId?: string;
  readonly httpStatus: number;
  readonly path: string;

  constructor(opts: {
    message: string;
    code: number;
    subcode?: number;
    type?: string;
    requestId?: string;
    httpStatus: number;
    path: string;
  }) {
    super(opts.message);
    this.name = 'MetaApiError';
    this.code = opts.code;
    this.subcode = opts.subcode;
    this.type = opts.type;
    this.requestId = opts.requestId;
    this.httpStatus = opts.httpStatus;
    this.path = opts.path;
  }
}

export type MetaGraphResult<T> = {
  data: T;
  requestId: string | null;
  status: number;
};

function graphVersion() {
  return env.META_GRAPH_API_VERSION || 'v21.0';
}

export function metaConfigured() {
  return Boolean(env.META_APP_ID && env.META_APP_SECRET);
}

export function assertMetaConfigured() {
  if (!metaConfigured()) {
    throw new AppError(
      503,
      'META_NOT_CONFIGURED',
      'Meta uygulaması yapılandırılmamış. META_APP_ID ve META_APP_SECRET gerekli.',
    );
  }
}

export function userFacingMetaMessage(error: MetaApiError): string {
  if (error.code === 190 || error.code === 102 || error.subcode === 463 || error.subcode === 467) {
    return 'Meta erişim izni geçersiz veya süresi dolmuş.';
  }
  if (error.code === 10 || error.code === 200 || error.code === 294) {
    return 'Bu işlem için Meta izni yetersiz. Bağlantıyı yenileyin.';
  }
  if (error.code === 9004 || error.code === 9007 || error.subcode === 2207052) {
    return 'Instagram medya işleme tamamlanamadı.';
  }
  if (error.code === 36003 || error.code === 36001) {
    return 'Instagram medyası dışarıdan erişilebilir değil.';
  }
  if (error.httpStatus === 429 || error.code === 4 || error.code === 17 || error.code === 32) {
    return 'Meta API limiti aşıldı. Biraz sonra tekrar deneyin.';
  }
  return 'Meta yayını başarısız oldu. Lütfen hesabı ve içeriği kontrol edin.';
}

export function isTokenInvalidError(error: unknown): boolean {
  if (!(error instanceof MetaApiError)) return false;
  return error.code === 190 || error.code === 102 || error.subcode === 463 || error.subcode === 467;
}

type RequestOptions = {
  token?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: Record<string, unknown> | URLSearchParams;
  timeoutMs?: number;
  form?: boolean;
};

async function metaRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: RequestOptions = {},
): Promise<MetaGraphResult<T>> {
  const cleanPath = path.replace(/^\//, '');
  const url = new URL(`https://graph.facebook.com/${graphVersion()}/${cleanPath}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);

  try {
    const headers: Record<string, string> = {};
    if (options.token) headers.Authorization = `Bearer ${options.token}`;

    let body: string | URLSearchParams | undefined;
    if (options.body) {
      if (options.body instanceof URLSearchParams || options.form) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        body = options.body instanceof URLSearchParams ? options.body : new URLSearchParams(
          Object.entries(options.body).reduce<Record<string, string>>((acc, [k, v]) => {
            if (v === undefined || v === null) return acc;
            acc[k] = typeof v === 'string' ? v : JSON.stringify(v);
            return acc;
          }, {}),
        );
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
      }
    }

    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    const requestId =
      res.headers.get('x-fb-request-id') || res.headers.get('facebook-api-version') || null;

    const json = (await res.json().catch(() => null)) as
      | (T & { error?: MetaGraphErrorBody })
      | { error?: MetaGraphErrorBody }
      | null;

    if (!res.ok || (json && typeof json === 'object' && 'error' in json && json.error)) {
      const err = (json as { error?: MetaGraphErrorBody } | null)?.error;
      throw new MetaApiError({
        message: err?.message || 'Meta API hatası',
        code: err?.code ?? res.status,
        subcode: err?.error_subcode,
        type: err?.type,
        requestId: err?.fbtrace_id || requestId || undefined,
        httpStatus: res.status,
        path: cleanPath,
      });
    }

    return { data: json as T, requestId, status: res.status };
  } catch (error) {
    if (error instanceof MetaApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(504, 'META_TIMEOUT', 'Meta API zaman aşımına uğradı');
    }
    throw new AppError(502, 'META_NETWORK_ERROR', 'Meta API ile bağlantı kurulamadı');
  } finally {
    clearTimeout(timeout);
  }
}

export function metaGet<T>(path: string, token: string, query?: RequestOptions['query'], timeoutMs?: number) {
  return metaRequest<T>('GET', path, { token, query, timeoutMs });
}

export function metaPost<T>(
  path: string,
  token: string,
  body?: Record<string, unknown>,
  timeoutMs?: number,
) {
  return metaRequest<T>('POST', path, { token, body, timeoutMs, form: true });
}

export function metaDelete<T>(path: string, token: string, query?: RequestOptions['query']) {
  return metaRequest<T>('DELETE', path, { token, query });
}

export async function exchangeOauthCode(code: string, redirectUri: string) {
  assertMetaConfigured();
  const res = await metaRequest<unknown>('GET', 'oauth/access_token', {
    query: {
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      redirect_uri: redirectUri,
      code,
    },
  });
  const normalized = normalizeMetaAccessTokenResponse(res.data);
  return {
    data: {
      access_token: normalized.accessToken,
      token_type: normalized.tokenType ?? undefined,
      expires_in: normalized.expiresIn ?? undefined,
    },
    requestId: res.requestId,
    status: res.status,
  };
}

export type NormalizedMetaAccessToken = {
  accessToken: string;
  tokenType: string | null;
  expiresIn: number | null;
};

/** Meta token response may be flat or wrapped under `data`. Never log tokens. */
export function normalizeMetaAccessTokenResponse(raw: unknown): NormalizedMetaAccessToken {
  const body = (raw && typeof raw === 'object' ? raw : {}) as {
    access_token?: unknown;
    token_type?: unknown;
    expires_in?: unknown;
    data?: {
      access_token?: unknown;
      token_type?: unknown;
      expires_in?: unknown;
    };
  };
  const nested = body.data && typeof body.data === 'object' ? body.data : null;
  const accessTokenCandidate = body.access_token ?? nested?.access_token;
  if (typeof accessTokenCandidate !== 'string' || !accessTokenCandidate) {
    throw new AppError(502, 'META_TOKEN_EXCHANGE_FAILED', 'Meta erişim jetonu alınamadı');
  }
  const tokenTypeCandidate = body.token_type ?? nested?.token_type;
  const expiresCandidate = body.expires_in ?? nested?.expires_in;
  const expiresIn =
    typeof expiresCandidate === 'number' && Number.isFinite(expiresCandidate) && expiresCandidate > 0
      ? expiresCandidate
      : null;
  return {
    accessToken: accessTokenCandidate,
    tokenType: typeof tokenTypeCandidate === 'string' ? tokenTypeCandidate : null,
    expiresIn,
  };
}

export async function exchangeLongLivedUserToken(shortLivedToken: string) {
  assertMetaConfigured();
  return metaRequest<{ access_token: string; token_type?: string; expires_in?: number }>(
    'GET',
    'oauth/access_token',
    {
      query: {
        grant_type: 'fb_exchange_token',
        client_id: env.META_APP_ID,
        client_secret: env.META_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      },
    },
  );
}

export function buildMetaOauthUrl(state: string, scopes: readonly string[]) {
  assertMetaConfigured();
  const url = new URL('https://www.facebook.com/' + graphVersion() + '/dialog/oauth');
  url.searchParams.set('client_id', env.META_APP_ID!);
  url.searchParams.set('redirect_uri', env.META_OAUTH_REDIRECT_URI);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(','));
  // Facebook Login for Business: https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/
  if (env.META_LOGIN_CONFIG_ID) {
    url.searchParams.set('config_id', env.META_LOGIN_CONFIG_ID);
  }
  return url.toString();
}
