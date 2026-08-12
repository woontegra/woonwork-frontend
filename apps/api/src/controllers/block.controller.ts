import type { Request, Response, NextFunction } from 'express';
import * as blockService from '../services/block.service';
import { ok } from '../lib/errors';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await blockService.listBlocks(
      req.tenant!.id,
      req.params.pageId,
      req.user!.id,
    );
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await blockService.createBlock(
      req.tenant!.id,
      req.params.pageId,
      req.user!.id,
      req.body,
    );
    res.status(201).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await blockService.updateBlock(
      req.tenant!.id,
      req.params.pageId,
      req.params.blockId,
      req.user!.id,
      req.body,
    );
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await blockService.deleteBlock(
      req.tenant!.id,
      req.params.pageId,
      req.params.blockId,
      req.user!.id,
    );
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function reorder(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await blockService.reorderBlocks(
      req.tenant!.id,
      req.params.pageId,
      req.user!.id,
      req.body,
    );
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function duplicate(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await blockService.duplicateBlock(
      req.tenant!.id,
      req.params.pageId,
      req.params.blockId,
      req.user!.id,
    );
    res.status(201).json(ok(data));
  } catch (error) {
    next(error);
  }
}
