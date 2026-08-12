import type { Request, Response, NextFunction } from 'express';
import * as libraryService from '../services/library.service';
import * as workspaceAreaService from '../services/workspaceArea.service';
import * as shareService from '../services/share.service';
import * as favoriteService from '../services/favorite.service';
import * as recentService from '../services/recent.service';
import { ok } from '../lib/errors';
import { accessCtxFromReq } from '../services/contentAccess.service';
import type { ContentResourceType } from '@woonwork/shared';

function ctx(req: Request) {
  return accessCtxFromReq(req as never);
}

export async function library(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await libraryService.listLibrary(ctx(req), req.query as Record<string, unknown>)));
  } catch (error) {
    next(error);
  }
}

export async function listAreas(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await workspaceAreaService.listAreas(ctx(req))));
  } catch (error) {
    next(error);
  }
}

export async function getArea(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await workspaceAreaService.getArea(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function createArea(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await workspaceAreaService.createArea(ctx(req), req.body)));
  } catch (error) {
    next(error);
  }
}

export async function updateArea(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await workspaceAreaService.updateArea(ctx(req), req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function removeArea(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await workspaceAreaService.deleteArea(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function listAreaMembers(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await workspaceAreaService.listAreaMembers(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function upsertAreaMember(req: Request, res: Response, next: NextFunction) {
  try {
    res
      .status(201)
      .json(ok(await workspaceAreaService.upsertAreaMember(ctx(req), req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function removeAreaMember(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(
      ok(await workspaceAreaService.removeAreaMember(ctx(req), req.params.id, req.params.userId)),
    );
  } catch (error) {
    next(error);
  }
}

export async function areaContents(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await workspaceAreaService.getAreaContents(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function listShares(req: Request, res: Response, next: NextFunction) {
  try {
    const resourceType = req.query.resourceType as ContentResourceType;
    const resourceId = req.query.resourceId as string;
    res.json(ok(await shareService.listShares(ctx(req), resourceType, resourceId)));
  } catch (error) {
    next(error);
  }
}

export async function createShare(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await shareService.createShare(ctx(req), req.body)));
  } catch (error) {
    next(error);
  }
}

export async function updateShare(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await shareService.updateShare(ctx(req), req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function removeShare(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await shareService.deleteShare(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function listFavorites(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 8;
    res.json(ok(await favoriteService.listFavorites(ctx(req), limit)));
  } catch (error) {
    next(error);
  }
}

export async function addFavorite(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await favoriteService.addFavorite(ctx(req), req.body)));
  } catch (error) {
    next(error);
  }
}

export async function removeFavorite(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(
      ok(
        await favoriteService.removeFavorite(
          ctx(req),
          req.params.resourceType as ContentResourceType,
          req.params.resourceId,
        ),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function listRecents(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 12;
    res.json(ok(await recentService.listRecents(ctx(req), limit)));
  } catch (error) {
    next(error);
  }
}
