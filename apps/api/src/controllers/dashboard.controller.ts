import type { Request, Response, NextFunction } from 'express';
import * as dashboardService from '../services/dashboard.service';
import { ok } from '../lib/errors';
import { accessCtxFromReq } from '../services/contentAccess.service';

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await dashboardService.getDashboard(accessCtxFromReq(req as never));
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}
