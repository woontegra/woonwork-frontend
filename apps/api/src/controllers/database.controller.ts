import type { Request, Response, NextFunction } from 'express';
import * as databaseService from '../services/database.service';
import { ok } from '../lib/errors';
import { accessCtxFromReq } from '../services/contentAccess.service';

function ctx(req: Request) {
  return accessCtxFromReq(req as never);
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await databaseService.listDatabases(ctx(req))));
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await databaseService.getDatabase(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await databaseService.createDatabase(ctx(req), req.body)));
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await databaseService.updateDatabase(ctx(req), req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function move(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await databaseService.moveDatabase(ctx(req), req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await databaseService.deleteDatabase(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function createProperty(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res
      .status(201)
      .json(ok(await databaseService.createProperty(req.tenant!.id, req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function updateProperty(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res.json(
      ok(
        await databaseService.updateProperty(
          req.tenant!.id,
          req.params.id,
          req.params.propertyId,
          req.body,
        ),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function removeProperty(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res.json(
      ok(
        await databaseService.deleteProperty(
          req.tenant!.id,
          req.params.id,
          req.params.propertyId,
        ),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function reorderProperties(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res.json(
      ok(await databaseService.reorderProperties(req.tenant!.id, req.params.id, req.body)),
    );
  } catch (error) {
    next(error);
  }
}

export async function listRows(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseView(ctx(req), req.params.id);
    res.json(
      ok(
        await databaseService.listRows(
          req.tenant!.id,
          req.params.id,
          req.query as Record<string, unknown>,
        ),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function createRow(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res.status(201).json(
      ok(
        await databaseService.createRow(
          req.tenant!.id,
          req.params.id,
          req.user!.id,
          req.body,
        ),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function duplicateRow(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res.status(201).json(
      ok(
        await databaseService.duplicateRow(
          req.tenant!.id,
          req.params.id,
          req.params.rowId,
          req.user!.id,
        ),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function removeRow(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res.json(
      ok(await databaseService.deleteRow(req.tenant!.id, req.params.id, req.params.rowId)),
    );
  } catch (error) {
    next(error);
  }
}

export async function reorderRows(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res.json(ok(await databaseService.reorderRows(req.tenant!.id, req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function updateCell(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res.json(
      ok(
        await databaseService.updateCell(
          req.tenant!.id,
          req.params.id,
          req.params.rowId,
          req.params.propertyId,
          req.body,
        ),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function listViews(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseView(ctx(req), req.params.id);
    res.json(ok(await databaseService.listViews(req.tenant!.id, req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function createView(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res
      .status(201)
      .json(ok(await databaseService.createView(req.tenant!.id, req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function updateView(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res.json(
      ok(
        await databaseService.updateView(
          req.tenant!.id,
          req.params.id,
          req.params.viewId,
          req.body,
        ),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function removeView(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res.json(
      ok(await databaseService.deleteView(req.tenant!.id, req.params.id, req.params.viewId)),
    );
  } catch (error) {
    next(error);
  }
}

export async function duplicateView(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res.status(201).json(
      ok(await databaseService.duplicateView(req.tenant!.id, req.params.id, req.params.viewId)),
    );
  } catch (error) {
    next(error);
  }
}

export async function moveRow(req: Request, res: Response, next: NextFunction) {
  try {
    await databaseService.requireDatabaseEdit(ctx(req), req.params.id);
    res.json(ok(await databaseService.moveRow(req.tenant!.id, req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}
