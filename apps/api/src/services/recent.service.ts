import type { ContentResourceType } from '@woonwork/shared';
import { prisma } from '../lib/prisma';
import { resolveAccess, type AccessContext } from './contentAccess.service';

export async function listRecents(ctx: AccessContext, limit = 12) {
  const items = await prisma.recentItem.findMany({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
    orderBy: { lastOpenedAt: 'desc' },
    take: Math.min(limit, 50),
  });

  const hydrated = [];
  for (const item of items) {
    const level = await resolveAccess(ctx, item.resourceType, item.resourceId);
    if (level === 'NONE') continue;

    if (item.resourceType === 'PAGE') {
      const page = await prisma.page.findFirst({
        where: { id: item.resourceId, tenantId: ctx.tenantId },
        select: { id: true, title: true, icon: true, updatedAt: true, workspaceAreaId: true },
      });
      if (page) {
        hydrated.push({
          ...item,
          name: page.title,
          icon: page.icon,
          href: `/notlar/${page.id}`,
        });
      }
    } else if (item.resourceType === 'DATABASE') {
      const db = await prisma.database.findFirst({
        where: { id: item.resourceId, tenantId: ctx.tenantId },
        select: { id: true, name: true, updatedAt: true, workspaceAreaId: true },
      });
      if (db) {
        hydrated.push({
          ...item,
          name: db.name,
          icon: null,
          href: `/tablolar/${db.id}`,
        });
      }
    } else {
      const project = await prisma.project.findFirst({
        where: { id: item.resourceId, tenantId: ctx.tenantId },
        select: { id: true, name: true, updatedAt: true, workspaceAreaId: true },
      });
      if (project) {
        hydrated.push({
          ...item,
          name: project.name,
          icon: null,
          href: `/projeler/${project.id}`,
        });
      }
    }
  }
  return hydrated;
}

export type { ContentResourceType };
