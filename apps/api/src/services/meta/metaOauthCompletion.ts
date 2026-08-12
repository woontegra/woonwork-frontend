import {
  META_OAUTH_MSG_ERROR,
  META_OAUTH_MSG_SUCCESS,
} from '@woonwork/shared';
import { env } from '../../config/env';

function escapeJsString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\u003c');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function frontendOrigin(): string {
  try {
    return new URL(env.FRONTEND_URL).origin;
  } catch {
    return 'http://localhost:5173';
  }
}

function isDev(): boolean {
  return env.NODE_ENV === 'development';
}

/** Headers that must override Helmet defaults on the OAuth completion page. */
export function metaOauthCompletionHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    // Allow the tiny inline completion script (Helmet default script-src 'self' blocks it).
    'Content-Security-Policy':
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    // Keep window.opener across Facebook → API callback navigation.
    'Cross-Origin-Opener-Policy': 'unsafe-none',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  };
}

function completionDocument(opts: {
  title: string;
  bodyText: string;
  scriptBody: string;
  debugBlock?: string;
}): string {
  const debug = opts.debugBlock
    ? `<pre id="ww-debug" style="margin-top:16px;font-size:12px;line-height:1.5;color:#57534e;white-space:pre-wrap">${opts.debugBlock}</pre>`
    : '';
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#f7f6f3;color:#1c1917;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
    .box{max-width:28rem;padding:1.25rem;text-align:center}
    p{font-size:14px;letter-spacing:-0.01em;margin:0}
  </style>
</head>
<body>
  <div class="box">
    <p id="ww-status">${escapeHtml(opts.bodyText)}</p>
    ${debug}
  </div>
  <script>
${opts.scriptBody}
  </script>
</body>
</html>`;
}

function buildCompletionScript(opts: {
  payloadJson: string;
  targetOrigin: string;
  showDebug: boolean;
}): string {
  const targetOrigin = escapeJsString(opts.targetOrigin);
  return `  (function () {
    var payload = ${opts.payloadJson};
    var targetOrigin = '${targetOrigin}';
    var debug = ${opts.showDebug ? 'true' : 'false'};
    function setDebug(lines) {
      if (!debug) return;
      var el = document.getElementById('ww-debug');
      if (el) el.textContent = lines.join('\\n');
    }
    var openerAvailable = !!(window.opener && !window.opener.closed);
    var messageStatus = 'failed';
    var closeStatus = 'pending';
    try {
      if (openerAvailable) {
        window.opener.postMessage(payload, targetOrigin);
        messageStatus = 'sent';
      } else {
        messageStatus = 'failed';
      }
    } catch (e) {
      messageStatus = 'failed';
    }
    setDebug([
      'opener: ' + (openerAvailable ? 'available' : 'missing'),
      'message: ' + messageStatus,
      'close: attempted',
      'targetOrigin: ' + targetOrigin
    ]);
    closeStatus = 'attempted';
    setTimeout(function () {
      try { window.close(); } catch (e) {}
      setDebug([
        'opener: ' + (openerAvailable ? 'available' : 'missing'),
        'message: ' + messageStatus,
        'close: ' + closeStatus,
        'targetOrigin: ' + targetOrigin,
        window.closed ? 'window: closed' : 'window: still open (browser may block close)'
      ]);
    }, 300);
  })();`;
}

export function buildMetaOauthSuccessHtml(opts: {
  connectionId: string;
  reconnected: boolean;
}): string {
  const origin = frontendOrigin();
  const connectionId = escapeJsString(opts.connectionId);
  const reconnected = opts.reconnected ? 'true' : 'false';
  const payloadJson = `{ type: '${META_OAUTH_MSG_SUCCESS}', connectionId: '${connectionId}', reconnected: ${reconnected} }`;
  const showDebug = isDev();
  return completionDocument({
    title: 'WoonWork',
    bodyText: 'Bağlantı tamamlandı. Bu pencere kapanıyor…',
    scriptBody: buildCompletionScript({
      payloadJson,
      targetOrigin: origin,
      showDebug,
    }),
    debugBlock: showDebug
      ? 'opener: …\nmessage: …\nclose: …'
      : undefined,
  });
}

export function buildMetaOauthErrorHtml(errorCode: string): string {
  const origin = frontendOrigin();
  const safeError = escapeJsString(
    errorCode.replace(/[^A-Z0-9_]/gi, '').slice(0, 80) || 'OAUTH_FAILED',
  );
  const payloadJson = `{ type: '${META_OAUTH_MSG_ERROR}', error: '${safeError}' }`;
  const showDebug = isDev();
  return completionDocument({
    title: 'WoonWork',
    bodyText: 'Bağlantı tamamlanamadı. Bu pencere kapanıyor…',
    scriptBody: buildCompletionScript({
      payloadJson,
      targetOrigin: origin,
      showDebug,
    }),
    debugBlock: showDebug
      ? 'opener: …\nmessage: …\nclose: …'
      : undefined,
  });
}

export function assertCompletionHtmlSafe(html: string) {
  if (/access_token|client_secret|META_APP_SECRET|ciphertext|Bearer\s/i.test(html)) {
    throw new Error('OAuth completion HTML must not contain secrets');
  }
}
