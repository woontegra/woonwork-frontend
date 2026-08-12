import type { Request, Response, NextFunction } from 'express';
import * as projectService from '../services/project.service';
import { ok } from '../lib/errors';
import { accessCtxFromReq } from '../services/contentAccess.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await projectService.listProjects(accessCtxFromReq(req as never), {
      status: req.query.status as string | undefined,
      q: req.query.q as string | undefined,
    });
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await projectService.getProject(accessCtxFromReq(req as never), req.params.id);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await projectService.createProject(accessCtxFromReq(req as never), req.body);
    res.status(201).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await projectService.updateProject(
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
    const data = await projectService.moveProject(
      accessCtxFromReq(req as never),
      req.params.id,
      req.body,
    );
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await projectService.deleteProject(accessCtxFromReq(req as never), req.params.id);
    res.json(ok({ message: 'Proje silindi' }));
  } catch (error) {
    next(error);
  }
}
