import type { Prisma, SocialContentStatus, SocialPlatform } from '@prisma/client';
import {
  addSocialMediaSchema,
  createSocialContentSchema,
  reorderSocialMediaSchema,
  socialCalendarQuerySchema,
  socialContentQuerySchema,
  updateSocialContentSchema,
  type CreateSocialContentInput,
  type UpdateSocialContentInput,
} from '@woonwork/shared';
import { hasMinRole } from '@woonwork/shared';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import {
  assertAreaAssignable,
  assertCanAccessArea,
  type AccessContext,
} from './contentAccess.service';
import { assertBrandInTenant } from './socialBrand.service';
import { countUnpublishedBlockedHashtagContents } from './socialHashtag.service';
import {
  applySocialWorkflow,
  resetWorkflowOnDuplicate,
  type WorkflowState,
} from './social-workflow.util';

const POSITION_STEP = 1000;

const contentInclude = {
  brand: { select: { id: true, name: true, color: true, isActive: true } },
  workspaceArea: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  platforms: { orderBy: { platform: 'asc' as const } },
  destinations: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      account: {
        select: {
          id: true,
          platform: true,
          name: true,
          username: true,
          profilePictureUrl: true,
          isActive: true,
          connectionStatus: true,
          socialBrandId: true,
        },
      },
    },
  },
  media: {
    orderBy: { position: 'asc' as const },
    include: {
      mediaAsset: {
        select: {
          id: true,
          url: true,
          originalFileName: true,
          mimeType: true,
          category: true,
          size: true,
        },
      },
    },
  },
} satisfies Prisma.SocialContentInclude;

function parseDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(400, 'INVALID_DATE', 'Geçersiz tarih');
  }
  return d;
}

async function accessibleContentWhere(ctx: AccessContext): Promise<Prisma.SocialContentWhereInput> {
  if (hasMinRole(ctx.tenantRole, 'ADMIN')) {
    return { tenantId: ctx.tenantId };
  }

  const memberships = await prisma.workspaceAreaMember.findMany({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
    select: { areaId: true },
  });
  const tenantAreas = await prisma.workspaceArea.findMany({
    where: { tenantId: ctx.tenantId, visibility: 'TENANT' },
    select: { id: true },
  });
  const areaIds = [...new Set([...memberships.map((m) => m.areaId), ...tenantAreas.map((a) => a.id)])];

  return {
    tenantId: ctx.tenantId,
    OR: [
      { workspaceAreaId: null },
      ...(areaIds.length ? [{ workspaceAreaId: { in: areaIds } }] : []),
    ],
  };
}

async function assertContentView(ctx: AccessContext, id: string) {
  const content = await prisma.socialContent.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: contentInclude,
  });
  if (!content) throw new AppError(404, 'CONTENT_NOT_FOUND', 'İçerik bulunamadı');
  if (content.workspaceAreaId) {
    await assertCanAccessArea(ctx, content.workspaceAreaId, 'VIEWER');
  }
  return content;
}

async function assertContentEdit(ctx: AccessContext, id: string) {
  if (!hasMinRole(ctx.tenantRole, 'MEMBER')) {
    throw new AppError(403, 'FORBIDDEN', 'Bu içeriği düzenleme yetkiniz yok');
  }
  const content = await assertContentView(ctx, id);
  if (content.workspaceAreaId) {
    await assertCanAccessArea(ctx, content.workspaceAreaId, 'MEMBER');
  }
  return content;
}

function toWorkflow(content: {
  status: SocialContentStatus;
  edited: boolean;
  approved: boolean;
  readyToPublish: boolean;
  published: boolean;
  publishedAt: Date | null;
  scheduledAt: Date | null;
}): WorkflowState {
  return {
    status: content.status,
    edited: content.edited,
    approved: content.approved,
    readyToPublish: content.readyToPublish,
    published: content.published,
    publishedAt: content.publishedAt,
    scheduledAt: content.scheduledAt,
  };
}

async function replacePlatforms(
  tx: Prisma.TransactionClient,
  tenantId: string,
  socialContentId: string,
  platforms: SocialPlatform[],
) {
  const unique = [...new Set(platforms)];
  await tx.socialContentPlatform.deleteMany({ where: { tenantId, socialContentId } });
  if (!unique.length) return;
  await tx.socialContentPlatform.createMany({
    data: unique.map((platform) => ({ tenantId, socialContentId, platform })),
  });
}

async function replaceDestinations(
  tx: Prisma.TransactionClient,
  tenantId: string,
  socialContentId: string,
  accountIds: string[],
) {
  const uniqueIds = [...new Set(accountIds)];
  const accounts = await tx.socialAccount.findMany({
    where: { tenantId, id: { in: uniqueIds }, isActive: true },
  });
  if (accounts.length !== uniqueIds.length) {
    throw new AppError(400, 'ACCOUNT_NOT_FOUND', 'Bir veya daha fazla sosyal hesap bulunamadı');
  }

  const existing = await tx.socialContentDestination.findMany({
    where: { tenantId, socialContentId },
  });
  const keep = new Set(uniqueIds);
  for (const dest of existing) {
    if (!keep.has(dest.socialAccountId) && dest.publicationStatus !== 'PUBLISHED') {
      await tx.socialContentDestination.delete({ where: { id: dest.id } });
    }
  }

  for (const account of accounts) {
    await tx.socialContentDestination.upsert({
      where: {
        socialContentId_socialAccountId: {
          socialContentId,
          socialAccountId: account.id,
        },
      },
      create: {
        tenantId,
        socialContentId,
        socialAccountId: account.id,
        platform: account.platform,
        publicationStatus: 'PENDING',
      },
      update: {
        platform: account.platform,
      },
    });
  }

  await replacePlatforms(
    tx,
    tenantId,
    socialContentId,
    accounts.map((a) => a.platform),
  );
}

export async function listContents(ctx: AccessContext, query: Record<string, unknown>) {
  const input = socialContentQuerySchema.parse(query);
  const access = await accessibleContentWhere(ctx);

  const where: Prisma.SocialContentWhereInput = {
    ...access,
    ...(input.brandId ? { socialBrandId: input.brandId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.contentType ? { contentType: input.contentType } : {}),
    ...(input.approved !== undefined ? { approved: input.approved } : {}),
    ...(input.readyToPublish !== undefined ? { readyToPublish: input.readyToPublish } : {}),
    ...(input.published !== undefined ? { published: input.published } : {}),
    ...(input.platform
      ? { platforms: { some: { platform: input.platform, tenantId: ctx.tenantId } } }
      : {}),
    ...(input.search
      ? {
          OR: [
            { title: { contains: input.search, mode: 'insensitive' } },
            { contentText: { contains: input.search, mode: 'insensitive' } },
            { description: { contains: input.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  if (input.dateFrom || input.dateTo) {
    where.scheduledAt = {
      ...(input.dateFrom ? { gte: parseDate(input.dateFrom) ?? undefined } : {}),
      ...(input.dateTo ? { lte: parseDate(input.dateTo) ?? undefined } : {}),
    };
  }

  const skip = (input.page - 1) * input.limit;
  const orderBy: Prisma.SocialContentOrderByWithRelationInput =
    input.sortBy === 'title'
      ? { title: input.sortDirection }
      : { [input.sortBy]: input.sortDirection };

  const [items, total] = await Promise.all([
    prisma.socialContent.findMany({
      where,
      include: contentInclude,
      orderBy: [orderBy, { createdAt: 'desc' }],
      skip,
      take: input.limit,
    }),
    prisma.socialContent.count({ where }),
  ]);

  return { items, total, page: input.page, limit: input.limit };
}

export async function getContent(ctx: AccessContext, id: string) {
  return assertContentView(ctx, id);
}

export async function createContent(ctx: AccessContext, raw: CreateSocialContentInput) {
  if (!hasMinRole(ctx.tenantRole, 'MEMBER')) {
    throw new AppError(403, 'FORBIDDEN', 'İçerik oluşturma yetkiniz yok');
  }
  const input = createSocialContentSchema.parse(raw);
  const workspaceAreaId = await assertAreaAssignable(ctx, input.workspaceAreaId);
  await assertBrandInTenant(ctx, input.socialBrandId);

  const scheduledAt = parseDate(input.scheduledAt ?? undefined) ?? null;
  const applied = applySocialWorkflow(
    {
      status: input.status ?? 'DRAFT',
      edited: input.edited ?? false,
      approved: false,
      readyToPublish: false,
      published: false,
      publishedAt: null,
      scheduledAt,
    },
    {
      approved: input.approved,
      readyToPublish: input.readyToPublish,
      published: input.published,
      status: input.status,
      scheduledAt,
    },
  );

  return prisma.$transaction(async (tx) => {
    const content = await tx.socialContent.create({
      data: {
        tenantId: ctx.tenantId,
        createdById: ctx.userId,
        title: input.title,
        description: input.description ?? null,
        contentText: input.contentText ?? null,
        internalNotes: input.internalNotes ?? null,
        contentType: input.contentType,
        timezone: input.timezone ?? 'Europe/Istanbul',
        socialBrandId: input.socialBrandId ?? null,
        workspaceAreaId,
        status: applied.status,
        edited: applied.edited,
        approved: applied.approved,
        readyToPublish: applied.readyToPublish,
        published: applied.published,
        publishedAt: applied.publishedAt,
        scheduledAt: applied.scheduledAt,
      },
    });
    if (input.accountIds?.length) {
      await replaceDestinations(tx, ctx.tenantId, content.id, input.accountIds);
    } else {
      await replacePlatforms(tx, ctx.tenantId, content.id, input.platforms ?? []);
    }
    return tx.socialContent.findFirstOrThrow({
      where: { id: content.id },
      include: contentInclude,
    });
  });
}

export async function updateContent(
  ctx: AccessContext,
  id: string,
  raw: UpdateSocialContentInput,
) {
  const existing = await assertContentEdit(ctx, id);
  const input = updateSocialContentSchema.parse(raw);

  if (input.workspaceAreaId !== undefined) {
    await assertAreaAssignable(ctx, input.workspaceAreaId);
  }
  if (input.socialBrandId !== undefined) {
    await assertBrandInTenant(ctx, input.socialBrandId);
  }

  const scheduledAt =
    input.scheduledAt !== undefined ? parseDate(input.scheduledAt) ?? null : existing.scheduledAt;

  const applied = applySocialWorkflow(toWorkflow(existing), {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.edited !== undefined ? { edited: input.edited } : {}),
    ...(input.approved !== undefined ? { approved: input.approved } : {}),
    ...(input.readyToPublish !== undefined ? { readyToPublish: input.readyToPublish } : {}),
    ...(input.published !== undefined ? { published: input.published } : {}),
    ...(input.scheduledAt !== undefined ? { scheduledAt } : {}),
  });

  return prisma.$transaction(async (tx) => {
    await tx.socialContent.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.contentText !== undefined ? { contentText: input.contentText } : {}),
        ...(input.internalNotes !== undefined ? { internalNotes: input.internalNotes } : {}),
        ...(input.contentType !== undefined ? { contentType: input.contentType } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.socialBrandId !== undefined ? { socialBrandId: input.socialBrandId } : {}),
        ...(input.workspaceAreaId !== undefined ? { workspaceAreaId: input.workspaceAreaId } : {}),
        status: applied.status,
        edited: applied.edited,
        approved: applied.approved,
        readyToPublish: applied.readyToPublish,
        published: applied.published,
        publishedAt: applied.publishedAt,
        scheduledAt: applied.scheduledAt,
      },
    });
    if (input.accountIds) {
      await replaceDestinations(tx, ctx.tenantId, id, input.accountIds);
    } else if (input.platforms) {
      await replacePlatforms(tx, ctx.tenantId, id, input.platforms);
    }
    return tx.socialContent.findFirstOrThrow({
      where: { id },
      include: contentInclude,
    });
  });
}

export async function deleteContent(ctx: AccessContext, id: string) {
  if (!hasMinRole(ctx.tenantRole, 'EDITOR')) {
    throw new AppError(403, 'FORBIDDEN', 'İçerik silme yetkiniz yok');
  }
  await assertContentEdit(ctx, id);
  await prisma.socialContent.delete({ where: { id } });
  return { deleted: true };
}

export async function duplicateContent(ctx: AccessContext, id: string) {
  const source = await assertContentEdit(ctx, id);
  const reset = resetWorkflowOnDuplicate(source);

  return prisma.$transaction(async (tx) => {
    const copy = await tx.socialContent.create({
      data: {
        tenantId: ctx.tenantId,
        createdById: ctx.userId,
        title: `${source.title} (kopya)`,
        description: source.description,
        contentText: source.contentText,
        internalNotes: source.internalNotes,
        contentType: source.contentType,
        timezone: source.timezone,
        socialBrandId: source.socialBrandId,
        workspaceAreaId: source.workspaceAreaId,
        status: reset.status,
        edited: reset.edited,
        approved: reset.approved,
        readyToPublish: reset.readyToPublish,
        published: reset.published,
        publishedAt: reset.publishedAt,
        scheduledAt: reset.scheduledAt,
      },
    });
    if (source.platforms.length) {
      await tx.socialContentPlatform.createMany({
        data: source.platforms.map((p) => ({
          tenantId: ctx.tenantId,
          socialContentId: copy.id,
          platform: p.platform,
        })),
      });
    }
    if (source.destinations.length) {
      await tx.socialContentDestination.createMany({
        data: source.destinations.map((d) => ({
          tenantId: ctx.tenantId,
          socialContentId: copy.id,
          socialAccountId: d.socialAccountId,
          platform: d.platform,
          publicationStatus: 'PENDING',
        })),
      });
    }
    if (source.media.length) {
      await tx.socialContentMedia.createMany({
        data: source.media.map((m) => ({
          tenantId: ctx.tenantId,
          socialContentId: copy.id,
          mediaAssetId: m.mediaAssetId,
          position: m.position,
          role: m.role,
        })),
      });
    }
    return tx.socialContent.findFirstOrThrow({
      where: { id: copy.id },
      include: contentInclude,
    });
  });
}

export async function listCalendar(ctx: AccessContext, query: Record<string, unknown>) {
  const input = socialCalendarQuerySchema.parse(query);
  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  if (!start || !end) throw new AppError(400, 'INVALID_DATE', 'Takvim aralığı gerekli');
  const access = await accessibleContentWhere(ctx);

  const items = await prisma.socialContent.findMany({
    where: {
      ...access,
      scheduledAt: { gte: start, lte: end },
    },
    include: contentInclude,
    orderBy: { scheduledAt: 'asc' },
  });
  return items;
}

export async function listUnscheduled(ctx: AccessContext) {
  const access = await accessibleContentWhere(ctx);
  return prisma.socialContent.findMany({
    where: { ...access, scheduledAt: null, published: false, status: { not: 'CANCELLED' } },
    include: contentInclude,
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
}

export async function overview(ctx: AccessContext) {
  const access = await accessibleContentWhere(ctx);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfTomorrow = new Date(endOfToday);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - ((startOfToday.getDay() + 6) % 7)));

  const [today, tomorrow, week, approval, readyToPublish, drafts, upcoming, blockedHashtagWarningCount] =
    await Promise.all([
    prisma.socialContent.findMany({
      where: { ...access, scheduledAt: { gte: startOfToday, lt: endOfToday } },
      include: contentInclude,
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    }),
    prisma.socialContent.findMany({
      where: { ...access, scheduledAt: { gte: endOfToday, lt: endOfTomorrow } },
      include: contentInclude,
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    }),
    prisma.socialContent.findMany({
      where: {
        ...access,
        scheduledAt: { gte: startOfToday, lt: endOfWeek },
        published: false,
      },
      include: contentInclude,
      orderBy: { scheduledAt: 'asc' },
      take: 30,
    }),
    prisma.socialContent.findMany({
      where: { ...access, edited: true, approved: false, published: false, status: { not: 'CANCELLED' } },
      include: contentInclude,
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.socialContent.findMany({
      where: { ...access, readyToPublish: true, published: false, status: { not: 'CANCELLED' } },
      include: contentInclude,
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.socialContent.findMany({
      where: { ...access, status: { in: ['IDEA', 'DRAFT'] }, published: false },
      include: contentInclude,
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.socialContent.findMany({
      where: {
        ...access,
        scheduledAt: { gte: endOfToday },
        published: false,
        status: { not: 'CANCELLED' },
      },
      include: contentInclude,
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    }),
    countUnpublishedBlockedHashtagContents(ctx),
  ]);

  // failed: content with at least one FAILED destination
  const failed = [...today, ...tomorrow, ...week, ...upcoming, ...readyToPublish, ...drafts]
    .filter(
      (item, index, arr) =>
        arr.findIndex((x) => x.id === item.id) === index &&
        item.destinations?.some((d: { publicationStatus: string }) => d.publicationStatus === 'FAILED'),
    )
    .slice(0, 20);

  return { today, tomorrow, week, approval, readyToPublish, drafts, upcoming, failed, blockedHashtagWarningCount };
}

export async function addMedia(ctx: AccessContext, contentId: string, raw: unknown) {
  const content = await assertContentEdit(ctx, contentId);
  const input = addSocialMediaSchema.parse(raw);

  const asset = await prisma.mediaAsset.findFirst({
    where: { id: input.mediaAssetId, tenantId: ctx.tenantId },
  });
  if (!asset) throw new AppError(400, 'INVALID_MEDIA', 'Medya bu çalışma alanına ait değil');

  const last = await prisma.socialContentMedia.findFirst({
    where: { tenantId: ctx.tenantId, socialContentId: content.id },
    orderBy: { position: 'desc' },
  });
  const position = (last?.position ?? 0) + POSITION_STEP;

  try {
    await prisma.socialContentMedia.create({
      data: {
        tenantId: ctx.tenantId,
        socialContentId: content.id,
        mediaAssetId: asset.id,
        position,
        role: input.role ?? null,
      },
    });
  } catch {
    throw new AppError(400, 'MEDIA_ALREADY_ATTACHED', 'Bu medya zaten ekli');
  }

  return assertContentView(ctx, contentId);
}

export async function removeMedia(ctx: AccessContext, contentId: string, mediaId: string) {
  await assertContentEdit(ctx, contentId);
  const rel = await prisma.socialContentMedia.findFirst({
    where: { id: mediaId, tenantId: ctx.tenantId, socialContentId: contentId },
  });
  if (!rel) throw new AppError(404, 'MEDIA_LINK_NOT_FOUND', 'Medya bağlantısı bulunamadı');
  await prisma.socialContentMedia.delete({ where: { id: mediaId } });
  return assertContentView(ctx, contentId);
}

export async function reorderMedia(ctx: AccessContext, contentId: string, raw: unknown) {
  await assertContentEdit(ctx, contentId);
  const input = reorderSocialMediaSchema.parse(raw);
  const existing = await prisma.socialContentMedia.findMany({
    where: { tenantId: ctx.tenantId, socialContentId: contentId },
  });
  const byId = new Map(existing.map((m) => [m.id, m]));
  if (input.orderedIds.length !== existing.length || input.orderedIds.some((id) => !byId.has(id))) {
    throw new AppError(400, 'INVALID_REORDER', 'Sıralama geçersiz');
  }
  await prisma.$transaction(
    input.orderedIds.map((id, index) =>
      prisma.socialContentMedia.update({
        where: { id },
        data: { position: (index + 1) * POSITION_STEP },
      }),
    ),
  );
  return assertContentView(ctx, contentId);
}
