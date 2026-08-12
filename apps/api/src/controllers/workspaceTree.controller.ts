import type { Request, Response, NextFunction } from 'express';
import { ok } from '../lib/errors';
import { accessCtxFromReq } from '../services/contentAccess.service';
import { getWorkspaceTree } from '../services/workspaceTree.service';

export async function tree(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await getWorkspaceTree(accessCtxFromReq(req as never))));
  } catch (error) {
    next(error);
  }
}
