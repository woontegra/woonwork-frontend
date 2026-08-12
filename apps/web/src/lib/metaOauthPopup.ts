import {
  META_OAUTH_MSG_ERROR,
  META_OAUTH_MSG_SUCCESS,
  isTrustedFrontendOrigin,
  parseMetaOauthMessage,
  type MetaOauthMessage,
} from '@woonwork/shared';

export {
  META_OAUTH_MSG_ERROR,
  META_OAUTH_MSG_SUCCESS,
  isTrustedFrontendOrigin,
  parseMetaOauthMessage,
};
export type { MetaOauthMessage };

export type MetaOauthPopupPhase =
  | 'IDLE'
  | 'AUTHORIZING'
  | 'SUCCESS'
  | 'ERROR'
  | 'POPUP_CLOSED'
  | 'SELECT_ACCOUNTS';

export function trustedMetaOauthMessageOrigins(): string[] {
  const origins = new Set<string>();
  // Callback completion HTML is served by the API, so event.origin is the API origin.
  const api = import.meta.env.VITE_API_URL;
  if (typeof api === 'string' && api) {
    try {
      origins.add(new URL(api).origin);
    } catch {
      /* ignore */
    }
  }
  // Fallback for local API defaults / same-origin completion pages.
  origins.add(window.location.origin);
  try {
    origins.add(new URL('http://localhost:4000').origin);
  } catch {
    /* ignore */
  }
  return [...origins];
}

/** @deprecated use trustedMetaOauthMessageOrigins — kept for existing imports */
export function trustedFrontendOrigins(): string[] {
  return trustedMetaOauthMessageOrigins();
}

export function isMetaOauthEventTrusted(event: MessageEvent, allowedOrigins: string[]): boolean {
  return allowedOrigins.some((origin) => isTrustedFrontendOrigin(event.origin, origin));
}

/**
 * Open OAuth popup WITHOUT noopener/noreferrer so window.opener stays available
 * for the API callback page postMessage.
 */
export function openCenteredPopup(url: string, name = 'woonwork_meta_oauth'): Window | null {
  const width = 620;
  const height = 720;
  const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
  const dualScreenTop = window.screenTop ?? window.screenY ?? 0;
  const screenWidth = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const screenHeight = window.innerHeight || document.documentElement.clientHeight || screen.height;
  const left = Math.max(0, dualScreenLeft + (screenWidth - width) / 2);
  const top = Math.max(0, dualScreenTop + (screenHeight - height) / 2);
  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${Math.round(left)}`,
    `top=${Math.round(top)}`,
    'resizable=yes',
    'scrollbars=yes',
    'status=no',
    'toolbar=no',
    'menubar=no',
  ].join(',');
  // Do not pass noopener/noreferrer — that would null window.opener on the popup.
  return window.open(url, name, features);
}

/**
 * Watch for true user-close. Callers with status polling should prefer a long
 * settleGraceMs and ignore callbacks while polling can still succeed.
 */
export function watchPopupClosed(
  popup: Window,
  onClosed: () => void,
  intervalMs = 500,
  settleGraceMs = 2000,
): () => void {
  let closedTimer: number | null = null;
  const timer = window.setInterval(() => {
    if (!popup.closed) return;
    window.clearInterval(timer);
    // Allow in-flight postMessage from completion page to settle before treating as manual close.
    closedTimer = window.setTimeout(() => {
      onClosed();
    }, settleGraceMs);
  }, intervalMs);
  return () => {
    window.clearInterval(timer);
    if (closedTimer !== null) window.clearTimeout(closedTimer);
  };
}

export const META_OAUTH_STATUS_POLL_MS = 1500;
export const META_OAUTH_STATUS_POLL_MAX_MS = 90_000;

export function logMetaOauthMessageDev(event: MessageEvent, message: MetaOauthMessage | null) {
  if (!import.meta.env.DEV) return;
  const data =
    event.data && typeof event.data === 'object'
      ? (event.data as Record<string, unknown>)
      : null;
  console.debug('[meta-oauth] message', {
    origin: event.origin,
    type: message?.type ?? (typeof data?.type === 'string' ? data.type : undefined),
    hasConnectionId: Boolean(
      message && message.type === META_OAUTH_MSG_SUCCESS && message.connectionId,
    ),
  });
}
