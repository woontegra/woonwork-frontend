import type { Request, Response, NextFunction } from 'express';
import * as pageService from '../services/page.service';
import { ok } from '../lib/errors';
import { accessCtxFromReq } from '../services/contentAccess.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const parentIdRaw = req.query.parentId as string | undefined;
    const data = await pageService.listPages(accessCtxFromReq(req as never), {
      parentId: parentIdRaw,
      q: req.query.q as string | undefined,
    });
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await pageService.getPage(accessCtxFromReq(req as never), req.params.id);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await pageService.createPage(accessCtxFromReq(req as never), req.body);
    res.status(201).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await pageService.updatePage(
      accessCtxFromReq(req as never),
      req.params.id,
      req.body,
    );
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function move(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await pageService.movePage(
      accessCtxFromReq(req as never),
      req.params.id,
      req.body,
    );
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function duplicate(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await pageService.duplicatePage(
      accessCtxFromReq(req as never),
      req.params.id,
    );
    res.status(201).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function createSubpage(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await pageService.createSubpage(
      accessCtxFromReq(req as never),
      req.params.id,
      req.body,
    );
    res.status(201).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await pageService.deletePage(accessCtxFromReq(req as never), req.params.id);
    res.json(ok({ message: 'Sayfa silindi' }));
  } catch (error) {
    next(error);
  }
}
