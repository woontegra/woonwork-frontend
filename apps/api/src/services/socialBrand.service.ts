import {
  createSocialBrandSchema,
  updateSocialBrandSchema,
  type CreateSocialBrandInput,
  type UpdateSocialBrandInput,
} from '@woonwork/shared';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import {
  assertAreaAssignable,
  assertCanAccessArea,
  type AccessContext,
} from './contentAccess.service';
import { hasMinRole } from '@woonwork/shared';

function canEdit(ctx: AccessContext) {
  return hasMinRole(ctx.tenantRole, 'MEMBER');
}

const brandListInclude = {
  workspaceArea: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  accounts: {
    where: { isActive: true },
    orderBy: { platform: 'asc' as const },
    select: {
      id: true,
      platform: true,
      name: true,
      username: true,
      connectionStatus: true,
      isActive: true,
    },
  },
  _count: {
    select: {
      contents: true,
      accounts: true,
      hashtags: true,
    },
  },
};

async function loadBrandStats(tenantId: string, brandIds: string[]) {
  const empty = () =>
    new Map<string, { planned: number; published: number; failed: number }>();
  if (!brandIds.length) return empty();

  const [plannedRows, publishedRows, failedRows] = await Promise.all([
    prisma.socialContent.groupBy({
      by: ['socialBrandId'],
      where: {
        tenantId,
        socialBrandId: { in: brandIds },
        scheduledAt: { not: null },
        published: false,
        status: { not: 'CANCELLED' },
      },
      _count: { _all: true },
    }),
    prisma.socialContent.groupBy({
      by: ['socialBrandId'],
      where: {
        tenantId,
        socialBrandId: { in: brandIds },
        published: true,
      },
      _count: { _all: true },
    }),
    prisma.socialContent.groupBy({
      by: ['socialBrandId'],
      where: {
        tenantId,
        socialBrandId: { in: brandIds },
        destinations: { some: { publicationStatus: 'FAILED' } },
      },
      _count: { _all: true },
    }),
  ]);

  const map = empty();
  for (const id of brandIds) {
    map.set(id, { planned: 0, published: 0, failed: 0 });
  }
  for (const row of plannedRows) {
    if (!row.socialBrandId) continue;
    const cur = map.get(row.socialBrandId) ?? { planned: 0, published: 0, failed: 0 };
    cur.planned = row._count._all;
    map.set(row.socialBrandId, cur);
  }
  for (const row of publishedRows) {
    if (!row.socialBrandId) continue;
    const cur = map.get(row.socialBrandId) ?? { planned: 0, published: 0, failed: 0 };
    cur.published = row._count._all;
    map.set(row.socialBrandId, cur);
  }
  for (const row of failedRows) {
    if (!row.socialBrandId) continue;
    const cur = map.get(row.socialBrandId) ?? { planned: 0, published: 0, failed: 0 };
    cur.failed = row._count._all;
    map.set(row.socialBrandId, cur);
  }
  return map;
}

function withStats<T extends { id: string; _count: { contents: number; accounts: number; hashtags: number } }>(
  brand: T,
  stats: Map<string, { planned: number; published: number; failed: number }>,
) {
  const s = stats.get(brand.id) ?? { planned: 0, published: 0, failed: 0 };
  return {
    ...brand,
    stats: {
      contents: brand._count.contents,
      planned: s.planned,
      published: s.published,
      failed: s.failed,
      hashtags: brand._count.hashtags,
      accounts: brand._count.accounts,
    },
  };
}

async function assertBrandVisible(ctx: AccessContext, brandId: string) {
  const brand = await prisma.socialBrand.findFirst({
    where: { id: brandId, tenantId: ctx.tenantId },
    include: brandListInclude,
  });
  if (!brand) throw new AppError(404, 'BRAND_NOT_FOUND', 'Marka bulunamadı');
  if (brand.workspaceAreaId) {
    await assertCanAccessArea(ctx, brand.workspaceAreaId, 'VIEWER');
  }
  return brand;
}

export async function listBrands(ctx: AccessContext, activeOnly = false) {
  const brands = await prisma.socialBrand.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }, { name: 'asc' }],
    include: brandListInclude,
  });

  const visible = [];
  for (const brand of brands) {
    if (!brand.workspaceAreaId) {
      visible.push(brand);
      continue;
    }
    try {
      await assertCanAccessArea(ctx, brand.workspaceAreaId, 'VIEWER');
      visible.push(brand);
    } catch {
      /* hidden by area */
    }
  }

  const stats = await loadBrandStats(
    ctx.tenantId,
    visible.map((b) => b.id),
  );
  return visible.map((b) => withStats(b, stats));
}

export async function getBrand(ctx: AccessContext, id: string) {
  const brand = await assertBrandVisible(ctx, id);
  const statsMap = await loadBrandStats(ctx.tenantId, [id]);
  const enriched = withStats(brand, statsMap);

  const [hashtagGroups, recentContents] = await Promise.all([
    prisma.socialHashtag.groupBy({
      by: ['status'],
      where: { tenantId: ctx.tenantId, socialBrandId: id },
      _count: { _all: true },
    }),
    prisma.socialContent.findMany({
      where: { tenantId: ctx.tenantId, socialBrandId: id },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        contentType: true,
        status: true,
        scheduledAt: true,
        published: true,
        updatedAt: true,
        platforms: { select: { platform: true } },
        destinations: {
          select: { platform: true, publicationStatus: true },
        },
      },
    }),
  ]);

  const hashtagBreakdown = {
    usable: 0,
    blocked: 0,
    inactive: 0,
  };
  for (const row of hashtagGroups) {
    if (row.status === 'ACTIVE') hashtagBreakdown.usable = row._count._all;
    else if (row.status === 'BLOCKED') hashtagBreakdown.blocked = row._count._all;
    else if (row.status === 'DISABLED') hashtagBreakdown.inactive = row._count._all;
  }

  return {
    ...enriched,
    hashtagBreakdown,
    recentContents,
  };
}

export async function createBrand(ctx: AccessContext, raw: CreateSocialBrandInput) {
  if (!canEdit(ctx)) throw new AppError(403, 'FORBIDDEN', 'Marka oluşturma yetkiniz yok');
  const input = createSocialBrandSchema.parse(raw);
  const workspaceAreaId = await assertAreaAssignable(ctx, input.workspaceAreaId);
  const created = await prisma.socialBrand.create({
    data: {
      tenantId: ctx.tenantId,
      createdById: ctx.userId,
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? null,
      workspaceAreaId,
      isActive: input.isActive ?? true,
    },
    include: brandListInclude,
  });
  return withStats(created, await loadBrandStats(ctx.tenantId, [created.id]));
}

export async function updateBrand(
  ctx: AccessContext,
  id: string,
  raw: UpdateSocialBrandInput,
) {
  if (!canEdit(ctx)) throw new AppError(403, 'FORBIDDEN', 'Marka düzenleme yetkiniz yok');
  const existing = await assertBrandVisible(ctx, id);
  if (existing.workspaceAreaId) {
    await assertCanAccessArea(ctx, existing.workspaceAreaId, 'MEMBER');
  }
  const input = updateSocialBrandSchema.parse(raw);
  let workspaceAreaId = existing.workspaceAreaId;
  if (input.workspaceAreaId !== undefined) {
    workspaceAreaId = await assertAreaAssignable(ctx, input.workspaceAreaId);
  }
  const updated = await prisma.socialBrand.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.workspaceAreaId !== undefined ? { workspaceAreaId } : {}),
    },
    include: brandListInclude,
  });
  return withStats(updated, await loadBrandStats(ctx.tenantId, [updated.id]));
}

export async function deleteBrand(ctx: AccessContext, id: string) {
  if (!hasMinRole(ctx.tenantRole, 'EDITOR')) {
    throw new AppError(403, 'FORBIDDEN', 'Marka silme yetkiniz yok');
  }
  const existing = await assertBrandVisible(ctx, id);
  if (existing.workspaceAreaId) {
    await assertCanAccessArea(ctx, existing.workspaceAreaId, 'MEMBER');
  }

  const [contentCount, accountCount, hashtagCount] = await Promise.all([
    prisma.socialContent.count({ where: { tenantId: ctx.tenantId, socialBrandId: id } }),
    prisma.socialAccount.count({ where: { tenantId: ctx.tenantId, socialBrandId: id } }),
    prisma.socialHashtag.count({ where: { tenantId: ctx.tenantId, socialBrandId: id } }),
  ]);

  if (contentCount > 0 || accountCount > 0 || hashtagCount > 0) {
    throw new AppError(
      409,
      'BRAND_HAS_RELATIONS',
      'Bu markanın içerik, hesap veya hashtag ilişkisi var. Silmek yerine pasife alın.',
    );
  }

  await prisma.socialBrand.delete({ where: { id } });
  return { deleted: true };
}

export async function assertBrandInTenant(ctx: AccessContext, brandId: string | null | undefined) {
  if (!brandId) return null;
  const brand = await prisma.socialBrand.findFirst({
    where: { id: brandId, tenantId: ctx.tenantId },
  });
  if (!brand) throw new AppError(400, 'INVALID_BRAND', 'Marka bu çalışma alanına ait değil');
  if (brand.workspaceAreaId) {
    await assertCanAccessArea(ctx, brand.workspaceAreaId, 'VIEWER');
  }
  return brand;
}
