import { libraryQuerySchema, type ContentResourceType } from '@woonwork/shared';
import { prisma } from '../lib/prisma';
import {
  accessibleWhere,
  getSharedResourceIds,
  type AccessContext,
} from './contentAccess.service';

type LibraryItem = {
  id: string;
  resourceType: ContentResourceType;
  name: string;
  icon: string | null;
  workspaceAreaId: string | null;
  areaName: string | null;
  owner: { id: string; firstName: string; lastName: string } | null;
  updatedAt: Date;
  sharedPermission?: string | null;
};

export async function listLibrary(ctx: AccessContext, query: Record<string, unknown>) {
  const input = libraryQuerySchema.parse(query);
  const skip = (input.page - 1) * input.limit;

  if (input.view === 'areas') {
    return { items: [], total: 0, page: input.page, limit: input.limit, view: input.view };
  }

  if (input.view === 'favorites') {
    return listFavoritesLibrary(ctx, input, skip);
  }
  if (input.view === 'recents') {
    return listRecentsLibrary(ctx, input, skip);
  }
  if (input.view === 'shared') {
    return listSharedLibrary(ctx, input, skip);
  }

  const types: ContentResourceType[] = input.type
    ? [input.type]
    : ['PAGE', 'DATABASE', 'PROJECT'];

  const chunks: LibraryItem[] = [];
  for (const type of types) {
    const where = (await accessibleWhere(ctx, type)) as Record<string, unknown>;
    if (input.view === 'private') {
      Object.assign(where, { createdById: ctx.userId, workspaceAreaId: null });
    }
    if (input.areaId) {
      Object.assign(where, { workspaceAreaId: input.areaId });
    }

    if (type === 'PAGE') {
      const rows = await prisma.page.findMany({
        where: {
          ...(where as object),
          ...(input.search
            ? { title: { contains: input.search, mode: 'insensitive' } }
            : {}),
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          workspaceArea: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: input.limit + skip,
      });
      chunks.push(
        ...rows.map((r) => ({
          id: r.id,
          resourceType: 'PAGE' as const,
          name: r.title,
          icon: r.icon,
          workspaceAreaId: r.workspaceAreaId,
          areaName: r.workspaceArea?.name ?? null,
          owner: r.createdBy,
          updatedAt: r.updatedAt,
        })),
      );
    }

    if (type === 'DATABASE') {
      const rows = await prisma.database.findMany({
        where: {
          ...(where as object),
          ...(input.search
            ? { name: { contains: input.search, mode: 'insensitive' } }
            : {}),
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          workspaceArea: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: input.limit + skip,
      });
      chunks.push(
        ...rows.map((r) => ({
          id: r.id,
          resourceType: 'DATABASE' as const,
          name: r.name,
          icon: null,
          workspaceAreaId: r.workspaceAreaId,
          areaName: r.workspaceArea?.name ?? null,
          owner: r.createdBy,
          updatedAt: r.updatedAt,
        })),
      );
    }

    if (type === 'PROJECT') {
      const rows = await prisma.project.findMany({
        where: {
          ...(where as object),
          ...(input.search
            ? { name: { contains: input.search, mode: 'insensitive' } }
            : {}),
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          workspaceArea: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: input.limit + skip,
      });
      chunks.push(
        ...rows.map((r) => ({
          id: r.id,
          resourceType: 'PROJECT' as const,
          name: r.name,
          icon: null,
          workspaceAreaId: r.workspaceAreaId,
          areaName: r.workspaceArea?.name ?? null,
          owner: r.createdBy,
          updatedAt: r.updatedAt,
        })),
      );
    }
  }

  chunks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const total = chunks.length;
  const items = chunks.slice(skip, skip + input.limit);
  return { items, total, page: input.page, limit: input.limit, view: input.view };
}

async function listFavoritesLibrary(
  ctx: AccessContext,
  input: { page: number; limit: number; search?: string; type?: ContentResourceType },
  skip: number,
) {
  const favorites = await prisma.favorite.findMany({
    where: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      ...(input.type ? { resourceType: input.type } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  const items = await hydrateResources(ctx, favorites, input.search);
  return {
    items: items.slice(skip, skip + input.limit),
    total: items.length,
    page: input.page,
    limit: input.limit,
    view: 'favorites' as const,
  };
}

async function listRecentsLibrary(
  ctx: AccessContext,
  input: { page: number; limit: number; search?: string; type?: ContentResourceType },
  skip: number,
) {
  const recents = await prisma.recentItem.findMany({
    where: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      ...(input.type ? { resourceType: input.type } : {}),
    },
    orderBy: { lastOpenedAt: 'desc' },
    take: 100,
  });
  const items = await hydrateResources(ctx, recents, input.search);
  return {
    items: items.slice(skip, skip + input.limit),
    total: items.length,
    page: input.page,
    limit: input.limit,
    view: 'recents' as const,
  };
}

async function listSharedLibrary(
  ctx: AccessContext,
  input: { page: number; limit: number; search?: string; type?: ContentResourceType },
  skip: number,
) {
  const shares = await prisma.contentShare.findMany({
    where: {
      tenantId: ctx.tenantId,
      sharedWithUserId: ctx.userId,
      ...(input.type ? { resourceType: input.type } : {}),
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const items = await hydrateResources(
    ctx,
    shares.map((s) => ({
      resourceType: s.resourceType,
      resourceId: s.resourceId,
      sharedPermission: s.permission,
      sharedBy: s.createdBy,
    })),
    input.search,
  );
  return {
    items: items.slice(skip, skip + input.limit),
    total: items.length,
    page: input.page,
    limit: input.limit,
    view: 'shared' as const,
  };
}

async function hydrateResources(
  ctx: AccessContext,
  refs: Array<{
    resourceType: ContentResourceType;
    resourceId: string;
    sharedPermission?: string;
    sharedBy?: { id: string; firstName: string; lastName: string };
  }>,
  search?: string,
): Promise<LibraryItem[]> {
  const { resolveAccess } = await import('./contentAccess.service');
  const out: LibraryItem[] = [];
  for (const ref of refs) {
    const level = await resolveAccess(ctx, ref.resourceType, ref.resourceId);
    if (level === 'NONE') continue;

    if (ref.resourceType === 'PAGE') {
      const row = await prisma.page.findFirst({
        where: { id: ref.resourceId, tenantId: ctx.tenantId },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          workspaceArea: { select: { name: true } },
        },
      });
      if (!row) continue;
      if (search && !row.title.toLowerCase().includes(search.toLowerCase())) continue;
      out.push({
        id: row.id,
        resourceType: 'PAGE',
        name: row.title,
        icon: row.icon,
        workspaceAreaId: row.workspaceAreaId,
        areaName: row.workspaceArea?.name ?? null,
        owner: row.createdBy,
        updatedAt: row.updatedAt,
        sharedPermission: ref.sharedPermission ?? null,
      });
    }
    if (ref.resourceType === 'DATABASE') {
      const row = await prisma.database.findFirst({
        where: { id: ref.resourceId, tenantId: ctx.tenantId },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          workspaceArea: { select: { name: true } },
        },
      });
      if (!row) continue;
      if (search && !row.name.toLowerCase().includes(search.toLowerCase())) continue;
      out.push({
        id: row.id,
        resourceType: 'DATABASE',
        name: row.name,
        icon: null,
        workspaceAreaId: row.workspaceAreaId,
        areaName: row.workspaceArea?.name ?? null,
        owner: row.createdBy,
        updatedAt: row.updatedAt,
        sharedPermission: ref.sharedPermission ?? null,
      });
    }
    if (ref.resourceType === 'PROJECT') {
      const row = await prisma.project.findFirst({
        where: { id: ref.resourceId, tenantId: ctx.tenantId },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          workspaceArea: { select: { name: true } },
        },
      });
      if (!row) continue;
      if (search && !row.name.toLowerCase().includes(search.toLowerCase())) continue;
      out.push({
        id: row.id,
        resourceType: 'PROJECT',
        name: row.name,
        icon: null,
        workspaceAreaId: row.workspaceAreaId,
        areaName: row.workspaceArea?.name ?? null,
        owner: row.createdBy,
        updatedAt: row.updatedAt,
        sharedPermission: ref.sharedPermission ?? null,
      });
    }
  }
  return out;
}

export { getSharedResourceIds };
