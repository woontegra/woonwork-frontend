import { Prisma } from '@prisma/client';
import { hasMinRole } from '@woonwork/shared';
import {
  bulkCreateSocialHashtagsSchema,
  createSocialHashtagSchema,
  hashtagKey,
  normalizeHashtag,
  parseHashtagsFromText,
  socialHashtagQuerySchema,
  splitBulkHashtagInput,
  updateSocialHashtagSchema,
  type BulkCreateSocialHashtagsInput,
  type CreateSocialHashtagInput,
  type SocialHashtagQuery,
  type UpdateSocialHashtagInput,
} from '@woonwork/shared';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { AccessContext } from './contentAccess.service';
import { assertBrandInTenant, getBrand, listBrands } from './socialBrand.service';

const hashtagInclude = {
  brand: { select: { id: true, name: true, color: true, isActive: true } },
} as const;

function canEdit(ctx: AccessContext) {
  return hasMinRole(ctx.tenantRole, 'MEMBER');
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function requireNormalizedTag(raw: string) {
  const tag = normalizeHashtag(raw);
  if (!tag) {
    throw new AppError(400, 'INVALID_HASHTAG', 'Hashtag geçersiz. Boşluk veya özel karakter kullanmayın.');
  }
  return { tag, tagKey: hashtagKey(tag) };
}

async function visibleBrandIds(ctx: AccessContext) {
  const brands = await listBrands(ctx);
  return brands.map((brand) => brand.id);
}

async function assertHashtagVisible(ctx: AccessContext, id: string) {
  const row = await prisma.socialHashtag.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: hashtagInclude,
  });
  if (!row) throw new AppError(404, 'HASHTAG_NOT_FOUND', 'Hashtag bulunamadı');
  await getBrand(ctx, row.socialBrandId);
  return row;
}

export async function listHashtags(ctx: AccessContext, raw: Record<string, unknown>) {
  const query: SocialHashtagQuery = socialHashtagQuerySchema.parse(raw);
  const brandIds = await visibleBrandIds(ctx);
  if (query.brandId) {
    await getBrand(ctx, query.brandId);
  }
  if (!brandIds.length) {
    return { items: [], total: 0, page: query.page, limit: query.limit };
  }

  const where: Prisma.SocialHashtagWhereInput = {
    tenantId: ctx.tenantId,
    socialBrandId: query.brandId ?? { in: brandIds },
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.search
      ? {
          OR: [
            { tag: { contains: query.search, mode: 'insensitive' } },
            { category: { contains: query.search, mode: 'insensitive' } },
            { notes: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.SocialHashtagOrderByWithRelationInput =
    query.sortBy === 'lastUsedAt'
      ? { lastUsedAt: query.sortDirection }
      : { [query.sortBy]: query.sortDirection };

  const [total, items] = await Promise.all([
    prisma.socialHashtag.count({ where }),
    prisma.socialHashtag.findMany({
      where,
      include: hashtagInclude,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function getHashtag(ctx: AccessContext, id: string) {
  return assertHashtagVisible(ctx, id);
}

export async function createHashtag(ctx: AccessContext, raw: CreateSocialHashtagInput) {
  if (!canEdit(ctx)) throw new AppError(403, 'FORBIDDEN', 'Hashtag oluşturma yetkiniz yok');
  const input = createSocialHashtagSchema.parse(raw);
  await assertBrandInTenant(ctx, input.socialBrandId);
  const { tag, tagKey } = requireNormalizedTag(input.tag);

  try {
    return await prisma.socialHashtag.create({
      data: {
        tenantId: ctx.tenantId,
        socialBrandId: input.socialBrandId,
        tag,
        tagKey,
        status: input.status ?? 'ACTIVE',
        category: input.category?.trim() || null,
        notes: input.notes?.trim() || null,
      },
      include: hashtagInclude,
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new AppError(409, 'HASHTAG_DUPLICATE', 'Bu markada aynı hashtag zaten var');
    }
    throw error;
  }
}

export async function updateHashtag(ctx: AccessContext, id: string, raw: UpdateSocialHashtagInput) {
  if (!canEdit(ctx)) throw new AppError(403, 'FORBIDDEN', 'Hashtag düzenleme yetkiniz yok');
  const existing = await assertHashtagVisible(ctx, id);
  const input = updateSocialHashtagSchema.parse(raw);

  let socialBrandId = existing.socialBrandId;
  if (input.socialBrandId !== undefined) {
    await assertBrandInTenant(ctx, input.socialBrandId);
    socialBrandId = input.socialBrandId;
  }

  let tag = existing.tag;
  let tagKey = existing.tagKey;
  if (input.tag !== undefined) {
    const next = requireNormalizedTag(input.tag);
    tag = next.tag;
    tagKey = next.tagKey;
  }

  try {
    return await prisma.socialHashtag.update({
      where: { id },
      data: {
        socialBrandId,
        tag,
        tagKey,
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.category !== undefined ? { category: input.category?.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
      include: hashtagInclude,
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new AppError(409, 'HASHTAG_DUPLICATE', 'Bu markada aynı hashtag zaten var');
    }
    throw error;
  }
}

export async function deleteHashtag(ctx: AccessContext, id: string) {
  if (!hasMinRole(ctx.tenantRole, 'EDITOR')) {
    throw new AppError(403, 'FORBIDDEN', 'Hashtag silme yetkiniz yok');
  }
  await assertHashtagVisible(ctx, id);
  await prisma.socialHashtag.delete({ where: { id } });
  return { deleted: true };
}

export async function bulkCreateHashtags(ctx: AccessContext, raw: BulkCreateSocialHashtagsInput) {
  if (!canEdit(ctx)) throw new AppError(403, 'FORBIDDEN', 'Hashtag oluşturma yetkiniz yok');
  const input = bulkCreateSocialHashtagsSchema.parse(raw);
  await assertBrandInTenant(ctx, input.socialBrandId);

  const tokens = input.hashtags?.length ? input.hashtags : splitBulkHashtagInput(input.text ?? '');
  const created: Awaited<ReturnType<typeof createHashtag>>[] = [];
  let duplicate = 0;
  let invalid = 0;
  const seen = new Set<string>();
  const duplicateTags: string[] = [];
  const invalidTags: string[] = [];

  for (const token of tokens) {
    const normalized = normalizeHashtag(token);
    if (!normalized) {
      invalid += 1;
      invalidTags.push(token);
      continue;
    }
    const key = hashtagKey(normalized);
    if (seen.has(key)) {
      duplicate += 1;
      duplicateTags.push(normalized);
      continue;
    }
    seen.add(key);
    try {
      const row = await prisma.socialHashtag.create({
        data: {
          tenantId: ctx.tenantId,
          socialBrandId: input.socialBrandId,
          tag: normalized,
          tagKey: key,
          status: input.status ?? 'ACTIVE',
          category: input.category?.trim() || null,
          notes: input.notes?.trim() || null,
        },
        include: hashtagInclude,
      });
      created.push(row);
    } catch (error) {
      if (isUniqueConflict(error)) {
        duplicate += 1;
        duplicateTags.push(normalized);
        continue;
      }
      throw error;
    }
  }

  return {
    created: created.length,
    duplicate,
    invalid,
    duplicates: duplicateTags,
    invalidTags,
    items: created,
  };
}

export async function findBlockedHashtagsInText(
  tenantId: string,
  socialBrandId: string | null | undefined,
  contentText: string | null | undefined,
) {
  const parsed = parseHashtagsFromText(contentText);
  if (!parsed.length) return [];
  const keys = parsed.map(hashtagKey);
  const blocked = await prisma.socialHashtag.findMany({
    where: {
      tenantId,
      status: 'BLOCKED',
      tagKey: { in: keys },
      ...(socialBrandId ? { socialBrandId } : {}),
    },
    select: { tag: true, tagKey: true },
  });
  const byKey = new Map(blocked.map((row) => [row.tagKey, row.tag]));
  return parsed.filter((tag) => byKey.has(hashtagKey(tag))).map((tag) => byKey.get(hashtagKey(tag)) ?? tag);
}

export async function assertNoBlockedHashtags(
  ctx: AccessContext,
  content: { contentText: string | null; socialBrandId: string | null },
) {
  const blocked = await findBlockedHashtagsInText(ctx.tenantId, content.socialBrandId, content.contentText);
  if (!blocked.length) return;
  throw new AppError(
    400,
    'SOCIAL_BLOCKED_HASHTAGS',
    'İçerikte kullanılması engellenmiş hashtagler bulundu.',
    { blocked },
  );
}

export async function recordHashtagUsage(params: {
  tenantId: string;
  socialBrandId: string | null | undefined;
  contentText: string | null | undefined;
  usedAt: Date;
}) {
  if (!params.socialBrandId) return 0;
  const parsed = parseHashtagsFromText(params.contentText);
  if (!parsed.length) return 0;
  const keys = [...new Set(parsed.map(hashtagKey))];
  const result = await prisma.socialHashtag.updateMany({
    where: {
      tenantId: params.tenantId,
      socialBrandId: params.socialBrandId,
      tagKey: { in: keys },
    },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: params.usedAt,
    },
  });
  return result.count;
}

export async function applyHashtagUsageOnFirstPublish(params: {
  tenantId: string;
  wasPublished: boolean;
  socialBrandId: string | null | undefined;
  contentText: string | null | undefined;
  usedAt: Date;
}) {
  if (params.wasPublished) return 0;
  return recordHashtagUsage(params);
}

export async function countUnpublishedBlockedHashtagContents(ctx: AccessContext) {
  const brandIds = await visibleBrandIds(ctx);
  if (!brandIds.length) return 0;
  const blocked = await prisma.socialHashtag.findMany({
    where: {
      tenantId: ctx.tenantId,
      socialBrandId: { in: brandIds },
      status: 'BLOCKED',
    },
    select: { socialBrandId: true, tagKey: true },
  });
  if (!blocked.length) return 0;

  const byBrand = new Map<string, Set<string>>();
  for (const row of blocked) {
    const set = byBrand.get(row.socialBrandId) ?? new Set<string>();
    set.add(row.tagKey);
    byBrand.set(row.socialBrandId, set);
  }

  const contents = await prisma.socialContent.findMany({
    where: {
      tenantId: ctx.tenantId,
      published: false,
      status: { not: 'CANCELLED' },
      socialBrandId: { in: brandIds },
      contentText: { not: null },
    },
    select: { socialBrandId: true, contentText: true },
    take: 200,
  });

  let count = 0;
  for (const content of contents) {
    if (!content.socialBrandId || !content.contentText) continue;
    const keys = byBrand.get(content.socialBrandId);
    if (!keys) continue;
    if (parseHashtagsFromText(content.contentText).some((tag) => keys.has(hashtagKey(tag)))) {
      count += 1;
    }
  }
  return count;
}
