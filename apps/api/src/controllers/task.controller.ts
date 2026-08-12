import type { Request, Response, NextFunction } from 'express';
import * as taskService from '../services/task.service';
import { ok } from '../lib/errors';
import { accessCtxFromReq } from '../services/contentAccess.service';

function ctx(req: Request) {
  return accessCtxFromReq(req as never);
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await taskService.listTasks(ctx(req), {
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      projectId: req.query.projectId as string | undefined,
      assigneeId: req.query.assigneeId as string | undefined,
      q: req.query.q as string | undefined,
    });
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await taskService.getTask(ctx(req), req.params.id);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await taskService.createTask(ctx(req), req.body);
    res.status(201).json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await taskService.updateTask(ctx(req), req.params.id, req.body);
    res.json(ok(data));
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await taskService.deleteTask(ctx(req), req.params.id);
    res.json(ok({ message: 'Görev silindi' }));
  } catch (error) {
    next(error);
  }
}
