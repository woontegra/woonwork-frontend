import { favoriteSchema, type FavoriteInput } from '@woonwork/shared';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { assertCanView, resolveAccess, type AccessContext } from './contentAccess.service';

export async function listFavorites(ctx: AccessContext, limit = 8) {
  const items = await prisma.favorite.findMany({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
  });

  const hydrated = [];
  for (const item of items) {
    const level = await resolveAccess(ctx, item.resourceType, item.resourceId);
    if (level === 'NONE') continue;

    if (item.resourceType === 'PAGE') {
      const page = await prisma.page.findFirst({
        where: { id: item.resourceId, tenantId: ctx.tenantId },
        select: { id: true, title: true, icon: true },
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
        select: { id: true, name: true },
      });
      if (db) {
        hydrated.push({
          ...item,
          name: db.name,
          icon: null as string | null,
          href: `/tablolar/${db.id}`,
        });
      }
    } else {
      const project = await prisma.project.findFirst({
        where: { id: item.resourceId, tenantId: ctx.tenantId },
        select: { id: true, name: true },
      });
      if (project) {
        hydrated.push({
          ...item,
          name: project.name,
          icon: null as string | null,
          href: `/projeler/${project.id}`,
        });
      }
    }
  }
  return hydrated;
}

export async function addFavorite(ctx: AccessContext, raw: FavoriteInput) {
  const input = favoriteSchema.parse(raw);
  await assertCanView(ctx, input.resourceType, input.resourceId);
  try {
    return await prisma.favorite.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
    });
  } catch {
    throw new AppError(400, 'ALREADY_FAVORITED', 'Zaten favorilerde');
  }
}

export async function removeFavorite(
  ctx: AccessContext,
  resourceType: FavoriteInput['resourceType'],
  resourceId: string,
) {
  const existing = await prisma.favorite.findUnique({
    where: {
      tenantId_userId_resourceType_resourceId: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        resourceType,
        resourceId,
      },
    },
  });
  if (!existing) throw new AppError(404, 'FAVORITE_NOT_FOUND', 'Favori bulunamadı');
  await prisma.favorite.delete({ where: { id: existing.id } });
  return { deleted: true };
}
