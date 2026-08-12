import type { Request, Response, NextFunction } from 'express';
import { ok } from '../lib/errors';
import { accessCtxFromReq } from '../services/contentAccess.service';
import * as brandService from '../services/socialBrand.service';
import * as contentService from '../services/socialContent.service';
import * as hashtagService from '../services/socialHashtag.service';

function ctx(req: Request) {
  return accessCtxFromReq(req as never);
}

export async function listBrands(req: Request, res: Response, next: NextFunction) {
  try {
    const activeOnly = req.query.active === 'true';
    res.json(ok(await brandService.listBrands(ctx(req), activeOnly)));
  } catch (error) {
    next(error);
  }
}

export async function getBrand(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await brandService.getBrand(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function createBrand(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await brandService.createBrand(ctx(req), req.body)));
  } catch (error) {
    next(error);
  }
}

export async function updateBrand(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await brandService.updateBrand(ctx(req), req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function removeBrand(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await brandService.deleteBrand(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function overview(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await contentService.overview(ctx(req))));
  } catch (error) {
    next(error);
  }
}

export async function listContents(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await contentService.listContents(ctx(req), req.query as Record<string, unknown>)));
  } catch (error) {
    next(error);
  }
}

export async function calendar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await contentService.listCalendar(ctx(req), req.query as Record<string, unknown>)));
  } catch (error) {
    next(error);
  }
}

export async function unscheduled(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await contentService.listUnscheduled(ctx(req))));
  } catch (error) {
    next(error);
  }
}

export async function getContent(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await contentService.getContent(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function createContent(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await contentService.createContent(ctx(req), req.body)));
  } catch (error) {
    next(error);
  }
}

export async function updateContent(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await contentService.updateContent(ctx(req), req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function removeContent(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await contentService.deleteContent(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function duplicateContent(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await contentService.duplicateContent(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function addMedia(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await contentService.addMedia(ctx(req), req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function removeMedia(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await contentService.removeMedia(ctx(req), req.params.id, req.params.mediaId)));
  } catch (error) {
    next(error);
  }
}

export async function reorderMedia(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await contentService.reorderMedia(ctx(req), req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function listHashtags(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await hashtagService.listHashtags(ctx(req), req.query as Record<string, unknown>)));
  } catch (error) {
    next(error);
  }
}

export async function createHashtag(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await hashtagService.createHashtag(ctx(req), req.body)));
  } catch (error) {
    next(error);
  }
}

export async function bulkCreateHashtags(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(ok(await hashtagService.bulkCreateHashtags(ctx(req), req.body)));
  } catch (error) {
    next(error);
  }
}

export async function updateHashtag(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await hashtagService.updateHashtag(ctx(req), req.params.id, req.body)));
  } catch (error) {
    next(error);
  }
}

export async function removeHashtag(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(ok(await hashtagService.deleteHashtag(ctx(req), req.params.id)));
  } catch (error) {
    next(error);
  }
}
