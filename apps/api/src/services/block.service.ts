import {
  BlockType,
  categoryForBlockType,
  createBlockSchema,
  defaultBlockContent,
  reorderBlocksSchema,
  updateBlockSchema,
  type CreateBlockInput,
  type ReorderBlocksInput,
  type UpdateBlockInput,
} from '@woonwork/shared';
import type { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';

export const POSITION_STEP = 1000;
const MIN_GAP = 0.001;

const blockInclude = {
  mediaAsset: true,
  database: {
    include: {
      properties: { orderBy: { position: 'asc' as const } },
      views: { orderBy: { createdAt: 'asc' as const } },
      _count: { select: { rows: true } },
    },
  },
} satisfies Prisma.BlockInclude;

async function assertPageInTenant(tenantId: string, pageId: string, userId?: string) {
  const page = await prisma.page.findFirst({
    where: { id: pageId, tenantId },
    select: { id: true },
  });
  if (!page) {
    throw new AppError(404, 'PAGE_NOT_FOUND', 'Sayfa bulunamadı');
  }
  if (userId) {
    const membership = await prisma.tenantMember.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    if (!membership) {
      throw new AppError(404, 'PAGE_NOT_FOUND', 'Sayfa bulunamadı');
    }
    const { resolveAccess } = await import('./contentAccess.service');
    const level = await resolveAccess(
      { tenantId, userId, tenantRole: membership.role },
      'PAGE',
      pageId,
    );
    if (level === 'NONE') {
      throw new AppError(404, 'PAGE_NOT_FOUND', 'Sayfa bulunamadı');
    }
  }
  return page;
}

async function getBlockInPage(tenantId: string, pageId: string, blockId: string) {
  const block = await prisma.block.findFirst({
    where: { id: blockId, tenantId, pageId },
    include: blockInclude,
  });
  if (!block) {
    throw new AppError(404, 'BLOCK_NOT_FOUND', 'Blok bulunamadı');
  }
  return block;
}

async function assertParentBlock(
  tenantId: string,
  pageId: string,
  parentBlockId: string | null | undefined,
) {
  if (!parentBlockId) return null;
  return getBlockInPage(tenantId, pageId, parentBlockId);
}

async function assertMediaForBlock(
  tenantId: string,
  blockType: string,
  mediaAssetId: string | null | undefined,
) {
  if (mediaAssetId === undefined) return undefined;
  if (mediaAssetId === null) return null;

  const asset = await prisma.mediaAsset.findFirst({
    where: { id: mediaAssetId, tenantId },
  });
  if (!asset) {
    throw new AppError(400, 'INVALID_MEDIA', 'Medya bu çalışma alanına ait değil');
  }

  if (blockType === BlockType.FILE) {
    if (asset.category !== 'DOCUMENT' && asset.category !== 'OTHER') {
      throw new AppError(400, 'INVALID_MEDIA_CATEGORY', 'Dosya bloğu yalnız belge kabul eder');
    }
    return mediaAssetId;
  }

  const required = categoryForBlockType(blockType as (typeof BlockType)[keyof typeof BlockType]);
  if (required && asset.category !== required) {
    throw new AppError(400, 'INVALID_MEDIA_CATEGORY', 'Medya türü bu blokla uyumlu değil');
  }

  return mediaAssetId;
}

async function assertDatabaseForBlock(
  tenantId: string,
  blockType: string,
  databaseId: string | null | undefined,
) {
  if (databaseId === undefined) return undefined;
  if (databaseId === null) return null;

  if (blockType !== BlockType.DATABASE) {
    throw new AppError(400, 'INVALID_DATABASE', 'Yalnız akıllı tablo bloğu tablo bağlayabilir');
  }

  const database = await prisma.database.findFirst({
    where: { id: databaseId, tenantId },
    select: { id: true },
  });
  if (!database) {
    throw new AppError(400, 'INVALID_DATABASE', 'Akıllı tablo bu çalışma alanına ait değil');
  }
  return databaseId;
}

function toJsonContent(content: unknown): Prisma.InputJsonValue {
  return (content ?? {}) as Prisma.InputJsonValue;
}

export async function ensureDefaultParagraph(
  tenantId: string,
  pageId: string,
  userId: string,
) {
  const count = await prisma.block.count({ where: { tenantId, pageId } });
  if (count > 0) return null;

  return prisma.block.create({
    data: {
      tenantId,
      pageId,
      type: BlockType.PARAGRAPH,
      content: toJsonContent(defaultBlockContent(BlockType.PARAGRAPH)),
      position: POSITION_STEP,
      createdById: userId,
    },
    include: blockInclude,
  });
}

export async function listBlocks(tenantId: string, pageId: string, userId: string) {
  await assertPageInTenant(tenantId, pageId, userId);
  await ensureDefaultParagraph(tenantId, pageId, userId);

  return prisma.block.findMany({
    where: { tenantId, pageId },
    orderBy: { position: 'asc' },
    include: blockInclude,
  });
}

async function computePosition(
  tenantId: string,
  pageId: string,
  afterBlockId?: string | null,
  parentBlockId?: string | null,
): Promise<number> {
  const siblings = await prisma.block.findMany({
    where: {
      tenantId,
      pageId,
      parentBlockId: parentBlockId ?? null,
    },
    orderBy: { position: 'asc' },
    select: { id: true, position: true },
  });

  if (!siblings.length) return POSITION_STEP;

  if (!afterBlockId) {
    return siblings[0].position / 2;
  }

  const index = siblings.findIndex((b) => b.id === afterBlockId);
  if (index === -1) {
    throw new AppError(400, 'INVALID_AFTER_BLOCK', 'afterBlockId bu sayfada geçersiz');
  }

  const current = siblings[index];
  const next = siblings[index + 1];

  if (!next) {
    return current.position + POSITION_STEP;
  }

  const gap = next.position - current.position;
  if (gap <= MIN_GAP) {
    await normalizePositions(tenantId, pageId, parentBlockId ?? null);
    return computePosition(tenantId, pageId, afterBlockId, parentBlockId);
  }

  return current.position + gap / 2;
}

export async function normalizePositions(
  tenantId: string,
  pageId: string,
  parentBlockId: string | null = null,
) {
  const blocks = await prisma.block.findMany({
    where: { tenantId, pageId, parentBlockId },
    orderBy: { position: 'asc' },
    select: { id: true },
  });

  await prisma.$transaction(
    blocks.map((block, index) =>
      prisma.block.update({
        where: { id: block.id },
        data: { position: (index + 1) * POSITION_STEP },
      }),
    ),
  );
}

export async function createBlock(
  tenantId: string,
  pageId: string,
  userId: string,
  raw: CreateBlockInput,
) {
  const input = createBlockSchema.parse(raw);
  await assertPageInTenant(tenantId, pageId, userId);
  await assertParentBlock(tenantId, pageId, input.parentBlockId);

  if (input.afterBlockId) {
    await getBlockInPage(tenantId, pageId, input.afterBlockId);
  }

  const position = await computePosition(
    tenantId,
    pageId,
    input.afterBlockId,
    input.parentBlockId,
  );

  const content = input.content ?? defaultBlockContent(input.type);
  const mediaAssetId = await assertMediaForBlock(tenantId, input.type, input.mediaAssetId);
  const databaseId = await assertDatabaseForBlock(tenantId, input.type, input.databaseId);

  return prisma.block.create({
    data: {
      tenantId,
      pageId,
      createdById: userId,
      type: input.type,
      content: toJsonContent(content),
      position,
      parentBlockId: input.parentBlockId ?? null,
      mediaAssetId: mediaAssetId ?? null,
      databaseId: databaseId ?? null,
    },
    include: blockInclude,
  });
}

export async function updateBlock(
  tenantId: string,
  pageId: string,
  blockId: string,
  userId: string,
  raw: UpdateBlockInput,
) {
  const input = updateBlockSchema.parse(raw);
  await assertPageInTenant(tenantId, pageId, userId);
  const existing = await getBlockInPage(tenantId, pageId, blockId);

  if (input.parentBlockId !== undefined && input.parentBlockId !== null) {
    if (input.parentBlockId === blockId) {
      throw new AppError(400, 'INVALID_PARENT_BLOCK', 'Blok kendi üst bloğu olamaz');
    }
    await assertParentBlock(tenantId, pageId, input.parentBlockId);
  }

  const nextType = input.type ?? existing.type;
  const mediaAssetId =
    input.mediaAssetId !== undefined
      ? await assertMediaForBlock(tenantId, nextType, input.mediaAssetId)
      : undefined;
  const databaseId =
    input.databaseId !== undefined
      ? await assertDatabaseForBlock(tenantId, nextType, input.databaseId)
      : undefined;

  return prisma.block.update({
    where: { id: blockId },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.content !== undefined ? { content: toJsonContent(input.content) } : {}),
      ...(input.parentBlockId !== undefined ? { parentBlockId: input.parentBlockId } : {}),
      ...(mediaAssetId !== undefined ? { mediaAssetId } : {}),
      ...(databaseId !== undefined ? { databaseId } : {}),
    },
    include: blockInclude,
  });
}

export async function deleteBlock(
  tenantId: string,
  pageId: string,
  blockId: string,
  userId: string,
) {
  await assertPageInTenant(tenantId, pageId, userId);
  await getBlockInPage(tenantId, pageId, blockId);

  const remaining = await prisma.block.count({
    where: { tenantId, pageId, NOT: { id: blockId } },
  });

  await prisma.block.delete({ where: { id: blockId } });

  if (remaining === 0) {
    const created = await ensureDefaultParagraph(tenantId, pageId, userId);
    return { deleted: true, emptied: true, block: created };
  }

  return { deleted: true, emptied: false };
}

export async function reorderBlocks(
  tenantId: string,
  pageId: string,
  userId: string,
  raw: ReorderBlocksInput,
) {
  const input = reorderBlocksSchema.parse(raw);
  await assertPageInTenant(tenantId, pageId, userId);

  const existing = await prisma.block.findMany({
    where: { tenantId, pageId, parentBlockId: null },
    select: { id: true },
  });

  const existingIds = new Set(existing.map((b) => b.id));
  if (
    input.orderedIds.length !== existingIds.size ||
    input.orderedIds.some((id) => !existingIds.has(id))
  ) {
    throw new AppError(
      400,
      'INVALID_REORDER',
      'Sıralama listesi bu sayfanın üst seviye bloklarıyla eşleşmiyor',
    );
  }

  await prisma.$transaction(
    input.orderedIds.map((id, index) =>
      prisma.block.update({
        where: { id },
        data: { position: (index + 1) * POSITION_STEP },
      }),
    ),
  );

  return prisma.block.findMany({
    where: { tenantId, pageId },
    orderBy: { position: 'asc' },
    include: blockInclude,
  });
}

export async function duplicateBlock(
  tenantId: string,
  pageId: string,
  blockId: string,
  userId: string,
) {
  await assertPageInTenant(tenantId, pageId, userId);
  const source = await getBlockInPage(tenantId, pageId, blockId);

  const position = await computePosition(
    tenantId,
    pageId,
    source.id,
    source.parentBlockId,
  );

  return prisma.block.create({
    data: {
      tenantId,
      pageId,
      createdById: userId,
      type: source.type,
      content: source.content as Prisma.InputJsonValue,
      position,
      parentBlockId: source.parentBlockId,
      mediaAssetId: source.mediaAssetId,
      databaseId: source.databaseId,
    },
    include: blockInclude,
  });
}
