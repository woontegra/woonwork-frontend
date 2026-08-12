import {
  createPageSchema,
  updatePageSchema,
  movePageSchema,
  defaultBlockContent,
  BlockType,
  type CreatePageInput,
  type UpdatePageInput,
} from '@woonwork/shared';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { POSITION_STEP } from './block.service';
import type { Prisma } from '@prisma/client';
import {
  accessibleWhere,
  assertAreaAssignable,
  assertCanEdit,
  assertCanView,
  touchRecent,
  type AccessContext,
} from './contentAccess.service';

function toJsonContent(content: unknown): Prisma.InputJsonValue {
  return (content ?? {}) as Prisma.InputJsonValue;
}

async function assertParentAccessible(
  ctx: AccessContext,
  parentId: string | null | undefined,
) {
  if (!parentId) return;
  await assertCanView(ctx, 'PAGE', parentId);
}

async function assertNoCycle(tenantId: string, pageId: string, newParentId: string | null) {
  if (!newParentId) return;
  if (newParentId === pageId) {
    throw new AppError(400, 'INVALID_PARENT', 'Sayfa kendi üst sayfası olamaz');
  }
  let cursor: string | null = newParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === pageId) {
      throw new AppError(400, 'INVALID_PARENT', 'Sayfa kendi alt sayfasının altına taşınamaz');
    }
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const parent: { parentId: string | null } | null = await prisma.page.findFirst({
      where: { id: cursor, tenantId },
      select: { parentId: true },
    });
    cursor = parent?.parentId ?? null;
  }
}

async function collectDescendantIds(tenantId: string, pageId: string): Promise<string[]> {
  const children = await prisma.page.findMany({
    where: { tenantId, parentId: pageId },
    select: { id: true },
  });
  const ids = children.map((c) => c.id);
  for (const child of children) {
    ids.push(...(await collectDescendantIds(tenantId, child.id)));
  }
  return ids;
}

async function getAncestorChain(tenantId: string, pageId: string) {
  const chain: Array<{ id: string; title: string; icon: string | null; workspaceAreaId: string | null }> =
    [];
  let cursor: string | null = pageId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const page: {
      id: string;
      title: string;
      icon: string | null;
      parentId: string | null;
      workspaceAreaId: string | null;
    } | null = await prisma.page.findFirst({
      where: { id: cursor, tenantId },
      select: { id: true, title: true, icon: true, parentId: true, workspaceAreaId: true },
    });
    if (!page) break;
    if (page.id !== pageId) chain.push(page);
    cursor = page.parentId;
  }
  return chain.reverse();
}

export async function listPages(
  ctx: AccessContext,
  filters?: { parentId?: string | null; q?: string },
) {
  const access = (await accessibleWhere(ctx, 'PAGE')) as Prisma.PageWhereInput;
  const parentFilter =
    filters?.parentId === undefined
      ? {}
      : filters.parentId === null || filters.parentId === 'null'
        ? { parentId: null }
        : { parentId: filters.parentId };

  return prisma.page.findMany({
    where: {
      ...access,
      ...parentFilter,
      ...(filters?.q ? { title: { contains: filters.q, mode: 'insensitive' } } : {}),
    },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      workspaceArea: { select: { id: true, name: true, icon: true } },
      _count: { select: { children: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getPage(ctx: AccessContext, id: string) {
  await assertCanView(ctx, 'PAGE', id);
  const page = await prisma.page.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      workspaceArea: { select: { id: true, name: true, icon: true } },
      children: {
        orderBy: { title: 'asc' },
        select: {
          id: true,
          title: true,
          icon: true,
          parentId: true,
          updatedAt: true,
        },
      },
      parent: {
        select: { id: true, title: true, icon: true },
      },
    },
  });

  if (!page) {
    throw new AppError(404, 'PAGE_NOT_FOUND', 'Sayfa bulunamadı');
  }

  const ancestors = await getAncestorChain(ctx.tenantId, id);
  void touchRecent(ctx, 'PAGE', id);
  return { ...page, ancestors };
}

export async function createPage(ctx: AccessContext, raw: CreatePageInput) {
  const input = createPageSchema.parse(raw);
  await assertParentAccessible(ctx, input.parentId);
  const workspaceAreaId = await assertAreaAssignable(ctx, input.workspaceAreaId);

  let inheritedArea = workspaceAreaId ?? null;
  if (input.parentId && inheritedArea === null && input.workspaceAreaId === undefined) {
    const parent = await prisma.page.findFirst({
      where: { id: input.parentId, tenantId: ctx.tenantId },
      select: { workspaceAreaId: true },
    });
    inheritedArea = parent?.workspaceAreaId ?? null;
  }

  return prisma.$transaction(async (tx) => {
    const page = await tx.page.create({
      data: {
        tenantId: ctx.tenantId,
        createdById: ctx.userId,
        title: input.title,
        parentId: input.parentId ?? null,
        icon: input.icon ?? null,
        coverUrl: input.coverUrl ?? null,
        workspaceAreaId: inheritedArea,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        workspaceArea: { select: { id: true, name: true, icon: true } },
        _count: { select: { children: true } },
      },
    });

    await tx.block.create({
      data: {
        tenantId: ctx.tenantId,
        pageId: page.id,
        createdById: ctx.userId,
        type: BlockType.PARAGRAPH,
        content: toJsonContent(defaultBlockContent(BlockType.PARAGRAPH)),
        position: POSITION_STEP,
      },
    });

    return page;
  });
}

export async function updatePage(ctx: AccessContext, id: string, raw: UpdatePageInput) {
  const input = updatePageSchema.parse(raw);
  await assertCanEdit(ctx, 'PAGE', id);

  if (input.parentId !== undefined) {
    await assertNoCycle(ctx.tenantId, id, input.parentId ?? null);
    await assertParentAccessible(ctx, input.parentId);
  }

  let workspaceAreaId = input.workspaceAreaId;
  if (workspaceAreaId !== undefined) {
    workspaceAreaId = await assertAreaAssignable(ctx, workspaceAreaId);
  } else if (input.parentId) {
    const parent = await prisma.page.findFirst({
      where: { id: input.parentId, tenantId: ctx.tenantId },
      select: { workspaceAreaId: true },
    });
    workspaceAreaId = parent?.workspaceAreaId ?? null;
  }

  let nextParentId = input.parentId;
  if (workspaceAreaId !== undefined && input.parentId === undefined) {
    const current = await prisma.page.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { parentId: true },
    });
    if (current?.parentId) {
      const parent = await prisma.page.findFirst({
        where: { id: current.parentId, tenantId: ctx.tenantId },
        select: { workspaceAreaId: true },
      });
      if ((parent?.workspaceAreaId ?? null) !== (workspaceAreaId ?? null)) {
        nextParentId = null;
      }
    }
  }

  const updated = await prisma.page.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(nextParentId !== undefined ? { parentId: nextParentId } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
      ...(workspaceAreaId !== undefined ? { workspaceAreaId } : {}),
    },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      workspaceArea: { select: { id: true, name: true, icon: true } },
      children: {
        orderBy: { title: 'asc' },
        select: {
          id: true,
          title: true,
          icon: true,
          parentId: true,
          updatedAt: true,
        },
      },
      parent: { select: { id: true, title: true, icon: true } },
    },
  });

  if (workspaceAreaId !== undefined) {
    const descendants = await collectDescendantIds(ctx.tenantId, id);
    if (descendants.length) {
      await prisma.page.updateMany({
        where: { id: { in: descendants }, tenantId: ctx.tenantId },
        data: { workspaceAreaId },
      });
    }
  }

  return updated;
}

export async function movePage(ctx: AccessContext, id: string, raw: unknown) {
  const input = movePageSchema.parse(raw);
  return updatePage(ctx, id, {
    ...(input.workspaceAreaId !== undefined ? { workspaceAreaId: input.workspaceAreaId } : {}),
    ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
  });
}

export async function duplicatePage(ctx: AccessContext, id: string) {
  const source = await getPage(ctx, id);
  await assertCanEdit(ctx, 'PAGE', id);

  const blocks = await prisma.block.findMany({
    where: { tenantId: ctx.tenantId, pageId: id, parentBlockId: null },
    orderBy: { position: 'asc' },
  });

  return prisma.$transaction(async (tx) => {
    const copy = await tx.page.create({
      data: {
        tenantId: ctx.tenantId,
        createdById: ctx.userId,
        title: `${source.title} (kopya)`,
        icon: source.icon,
        coverUrl: source.coverUrl,
        parentId: source.parentId,
        workspaceAreaId: source.workspaceAreaId,
      },
    });

    let position = POSITION_STEP;
    for (const block of blocks) {
      if (block.type === 'DATABASE' || block.type === 'SUBPAGE') continue;
      await tx.block.create({
        data: {
          tenantId: ctx.tenantId,
          pageId: copy.id,
          createdById: ctx.userId,
          type: block.type,
          content: toJsonContent(block.content),
          position,
          mediaAssetId: block.mediaAssetId,
        },
      });
      position += POSITION_STEP;
    }

    if (!blocks.some((b) => b.type !== 'DATABASE' && b.type !== 'SUBPAGE')) {
      await tx.block.create({
        data: {
          tenantId: ctx.tenantId,
          pageId: copy.id,
          createdById: ctx.userId,
          type: BlockType.PARAGRAPH,
          content: toJsonContent(defaultBlockContent(BlockType.PARAGRAPH)),
          position: POSITION_STEP,
        },
      });
    }

    return tx.page.findFirstOrThrow({
      where: { id: copy.id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        workspaceArea: { select: { id: true, name: true, icon: true } },
        _count: { select: { children: true } },
      },
    });
  });
}

export async function createSubpage(
  ctx: AccessContext,
  parentPageId: string,
  raw?: { title?: string; afterBlockId?: string },
) {
  await assertCanEdit(ctx, 'PAGE', parentPageId);
  const parent = await prisma.page.findFirst({
    where: { id: parentPageId, tenantId: ctx.tenantId },
    select: { id: true, workspaceAreaId: true },
  });
  if (!parent) throw new AppError(404, 'PAGE_NOT_FOUND', 'Sayfa bulunamadı');

  const title = raw?.title?.trim() || 'Adsız sayfa';
  const child = await createPage(ctx, {
    title,
    parentId: parentPageId,
    workspaceAreaId: parent.workspaceAreaId,
  });

  let afterPosition: number | null = null;
  if (raw?.afterBlockId) {
    const after = await prisma.block.findFirst({
      where: { id: raw.afterBlockId, tenantId: ctx.tenantId, pageId: parentPageId },
      select: { position: true },
    });
    afterPosition = after?.position ?? null;
  }

  const next = await prisma.block.findFirst({
    where: {
      tenantId: ctx.tenantId,
      pageId: parentPageId,
      ...(afterPosition !== null ? { position: { gt: afterPosition } } : {}),
    },
    orderBy: { position: 'asc' },
    select: { position: true },
  });

  const position =
    afterPosition === null
      ? ((await prisma.block.aggregate({
          where: { tenantId: ctx.tenantId, pageId: parentPageId },
          _max: { position: true },
        }))._max.position ?? 0) + POSITION_STEP
      : next
        ? (afterPosition + next.position) / 2
        : afterPosition + POSITION_STEP;

  const block = await prisma.block.create({
    data: {
      tenantId: ctx.tenantId,
      pageId: parentPageId,
      createdById: ctx.userId,
      type: BlockType.SUBPAGE,
      content: toJsonContent({ pageId: child.id, text: child.title }),
      position,
    },
  });

  return { page: child, block };
}

export async function deletePage(ctx: AccessContext, id: string) {
  await assertCanEdit(ctx, 'PAGE', id);
  await prisma.page.delete({ where: { id } });
}
