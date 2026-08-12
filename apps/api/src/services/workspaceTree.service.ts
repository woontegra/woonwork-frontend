import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  accessibleWhere,
  listVisibleAreas,
  type AccessContext,
} from './contentAccess.service';
import { listFavorites } from './favorite.service';
import { listRecents } from './recent.service';

export type WorkspaceTreeNode = {
  id: string;
  type: 'PAGE' | 'DATABASE' | 'PROJECT';
  name: string;
  icon: string | null;
  parentId: string | null;
  areaId: string | null;
  updatedAt: Date;
  children?: WorkspaceTreeNode[];
};

function buildPageForest(
  pages: Array<{
    id: string;
    title: string;
    icon: string | null;
    parentId: string | null;
    workspaceAreaId: string | null;
    updatedAt: Date;
  }>,
  areaId: string | null,
): WorkspaceTreeNode[] {
  const scoped = pages.filter((p) => (p.workspaceAreaId ?? null) === areaId);
  const byParent = new Map<string | null, typeof scoped>();
  for (const page of scoped) {
    const key = page.parentId;
    const list = byParent.get(key) ?? [];
    list.push(page);
    byParent.set(key, list);
  }

  const walk = (parentId: string | null): WorkspaceTreeNode[] => {
    const list = byParent.get(parentId) ?? [];
    return list
      .sort((a, b) => a.title.localeCompare(b.title, 'tr'))
      .map((page) => ({
        id: page.id,
        type: 'PAGE' as const,
        name: page.title,
        icon: page.icon,
        parentId: page.parentId,
        areaId: page.workspaceAreaId,
        updatedAt: page.updatedAt,
        children: walk(page.id),
      }));
  };

  return walk(null);
}

export async function getWorkspaceTree(ctx: AccessContext) {
  const [pageAccess, dbAccess, projectAccess, areas, favorites, recents] = await Promise.all([
    accessibleWhere(ctx, 'PAGE') as Promise<Prisma.PageWhereInput>,
    accessibleWhere(ctx, 'DATABASE') as Promise<Prisma.DatabaseWhereInput>,
    accessibleWhere(ctx, 'PROJECT') as Promise<Prisma.ProjectWhereInput>,
    listVisibleAreas(ctx),
    listFavorites(ctx, 8),
    listRecents(ctx, 8),
  ]);

  const [pages, databases, projects, socialBrands] = await Promise.all([
    prisma.page.findMany({
      where: pageAccess,
      select: {
        id: true,
        title: true,
        icon: true,
        parentId: true,
        workspaceAreaId: true,
        updatedAt: true,
      },
      orderBy: { title: 'asc' },
      take: 800,
    }),
    prisma.database.findMany({
      where: { ...dbAccess, pageId: null },
      select: {
        id: true,
        name: true,
        workspaceAreaId: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    prisma.project.findMany({
      where: projectAccess,
      select: {
        id: true,
        name: true,
        workspaceAreaId: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    prisma.socialBrand.findMany({
      where: {
        tenantId: ctx.tenantId,
        isActive: true,
        workspaceAreaId: { not: null },
      },
      select: { workspaceAreaId: true },
    }),
  ]);

  const socialAreaIds = new Set(
    socialBrands.map((b) => b.workspaceAreaId).filter((id): id is string => Boolean(id)),
  );

  const toDbNode = (db: (typeof databases)[number]): WorkspaceTreeNode => ({
    id: db.id,
    type: 'DATABASE',
    name: db.name,
    icon: null,
    parentId: null,
    areaId: db.workspaceAreaId,
    updatedAt: db.updatedAt,
  });

  const toProjectNode = (project: (typeof projects)[number]): WorkspaceTreeNode => ({
    id: project.id,
    type: 'PROJECT',
    name: project.name,
    icon: null,
    parentId: null,
    areaId: project.workspaceAreaId,
    updatedAt: project.updatedAt,
  });

  const favoriteIds = new Set(favorites.map((f) => `${f.resourceType}:${f.resourceId}`));
  const recentItems = recents
    .filter((r) => !favoriteIds.has(`${r.resourceType}:${r.resourceId}`))
    .slice(0, 5);

  return {
    favorites: favorites.slice(0, 8).map((f) => ({
      id: f.resourceId,
      type: f.resourceType,
      name: f.name ?? f.resourceId,
      icon: f.icon ?? null,
      href: f.href,
      areaId: null as string | null,
    })),
    recents: favorites.length < 4 ? recentItems : [],
    private: {
      pages: buildPageForest(pages, null),
      databases: databases.filter((d) => !d.workspaceAreaId).map(toDbNode),
      projects: projects.filter((p) => !p.workspaceAreaId).map(toProjectNode),
    },
    areas: areas.map((area) => ({
      id: area.id,
      name: area.name,
      icon: area.icon,
      description: area.description,
      hasSocial: socialAreaIds.has(area.id),
      pages: buildPageForest(pages, area.id),
      databases: databases.filter((d) => d.workspaceAreaId === area.id).map(toDbNode),
      projects: projects.filter((p) => p.workspaceAreaId === area.id).map(toProjectNode),
    })),
  };
}
