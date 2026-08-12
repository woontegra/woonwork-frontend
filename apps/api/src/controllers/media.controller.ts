import type { Request, Response, NextFunction } from 'express';
import type { HandleUploadBody } from '@vercel/blob/client';
import * as mediaService from '../services/media.service';
import { ok } from '../lib/errors';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mediaService.listMedia(req.tenant!.id, {
      q: req.query.q as string | undefined,
      category: req.query.category as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mediaService.getMedia(req.tenant!.id, req.params.id);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function usage(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mediaService.getUsage(req.tenant!.id);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function upload(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as HandleUploadBody;
    const request = new Request(`${req.protocol}://${req.get('host')}${req.originalUrl}`, {
      method: 'POST',
      headers: req.headers as HeadersInit,
      body: JSON.stringify(body),
    });

    const data = await mediaService.handleClientUpload({
      tenantId: req.tenant!.id,
      userId: req.user!.id,
      body,
      request,
    });

    // handleUpload returns raw blob client protocol payload (not our ok wrapper)
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function finalize(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mediaService.finalizeMedia(req.tenant!.id, req.user!.id, req.body);
    res.status(201).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function preparePath(req: Request, res: Response, next: NextFunction) {
  try {
    const originalFileName = String(req.body.originalFileName || 'file');
    const mimeType = String(req.body.mimeType || 'application/octet-stream');
    const size = Number(req.body.size || 0);
    mediaService.assertAllowedFile(mimeType, originalFileName, size || 1);
    const pathname = mediaService.buildStoragePath(req.tenant!.id, originalFileName);
    res.json(ok({ pathname }));
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const force = req.query.force === 'true' || req.body?.force === true;
    const data = await mediaService.deleteMedia(req.tenant!.id, req.params.id, force);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}
