import type { Request, Response, NextFunction } from 'express';
import { AppError, ok } from '../lib/errors';
import { accessCtxFromReq } from '../services/contentAccess.service';
import * as accountService from '../services/socialAccount.service';
import {
  assertCompletionHtmlSafe,
  buildMetaOauthErrorHtml,
  buildMetaOauthSuccessHtml,
  metaOauthCompletionHeaders,
} from '../services/meta/metaOauthCompletion';
import * as oauthService from '../services/socialOAuth.service';
import * as publishService from '../services/socialPublish.service';

function ctx(req: Request) {
  return accessCtxFromReq(req as never);
}

function sendOauthCompletionHtml(res: Response, html: string) {
  const headers = metaOauthCompletionHeaders();
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  res.status(200).send(html);
}

export async function startMetaOauth(req: Request, res: Response, next: NextFunction) {
  try {
    const reconnectConnectionId =
      typeof req.query.reconnectConnectionId === 'string' ? req.query.reconnectConnectionId : null;
    res.json(ok(await oauthService.startMetaOauth(ctx(req), { reconnectConnectionId })));
  } catch (error) {
    next(error);
  }
}

export async function metaOauthStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : '';
    res.json(ok(await oauthService.getMetaOauthStatus(ctx(req), sessionId)));
  } catch (error) {
    next(error);
  }
}

export async function metaOauthCallback(req: Request, res: Response, next: NextFunction) {
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const result = await oauthService.handleMetaOauthCallback(code, state);
    const html = buildMetaOauthSuccessHtml({
      connectionId: result.connectionId,
      reconnected: result.reconnected,
    });
    assertCompletionHtmlSafe(html);
    sendOauthCompletionHtml(res, html);
  } catch (error) {
    const code = error instanceof AppError ? error.code : 'OAUTH_FAILED';
    await oauthService.markMetaOauthFailedByState(state, code);
    const html = buildMetaOauthErrorHtml(code);
    assertCompletionHtmlSafe(html);
    sendOauthCompletionHtml(res, html);
    void next;
  }
}

export async function discoverMeta(req: Request, res: Response, next: NextFunction) {
  try {
    const connectionId = typeof req.query.connectionId === 'string' ? req.query.connectionId : undefined;
    res.json(ok(await oauthService.discoverMetaPages(ctx(req), connectionId)));
  } catch (error) {
    next(error);
  }
}

export async function connectMetaAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await accountService.connectMetaAccounts(ctx(req), req.body)));
  } catch (error) {
    next(error);
  }
}

export async function listAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const activeOnly = req.query.active === 'true';
    res.json(ok(await accountService.listSocialAccounts(ctx(req), activeOnly)));
  } catch (error) {
    next(error);
  }
}

export async function updateAccount(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await accountService.updateSocialAccount(ctx(req), req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function disconnectAccount(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await accountService.disconnectSocialAccount(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function publishContent(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await publishService.publishContent(ctx(req), req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}
