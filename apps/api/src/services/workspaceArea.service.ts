import {
  createWorkspaceAreaSchema,
  updateWorkspaceAreaSchema,
  upsertAreaMemberSchema,
  type CreateWorkspaceAreaInput,
  type UpdateWorkspaceAreaInput,
  type UpsertAreaMemberInput,
} from '@woonwork/shared';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import {
  assertCanAccessArea,
  listVisibleAreas,
  type AccessContext,
} from './contentAccess.service';

export async function listAreas(ctx: AccessContext) {
  return listVisibleAreas(ctx);
}

export async function getArea(ctx: AccessContext, areaId: string) {
  const { area } = await assertCanAccessArea(ctx, areaId, 'VIEWER');
  return prisma.workspaceArea.findFirstOrThrow({
    where: { id: area.id },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { pages: true, databases: true, projects: true, members: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function createArea(ctx: AccessContext, raw: CreateWorkspaceAreaInput) {
  const input = createWorkspaceAreaSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const area = await tx.workspaceArea.create({
      data: {
        tenantId: ctx.tenantId,
        createdById: ctx.userId,
        name: input.name,
        description: input.description ?? null,
        icon: input.icon ?? null,
        visibility: input.visibility,
      },
    });
    await tx.workspaceAreaMember.create({
      data: {
        tenantId: ctx.tenantId,
        areaId: area.id,
        userId: ctx.userId,
        role: 'OWNER',
      },
    });
    return tx.workspaceArea.findFirstOrThrow({
      where: { id: area.id },
      include: {
        _count: { select: { pages: true, databases: true, projects: true, members: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  });
}

export async function updateArea(
  ctx: AccessContext,
  areaId: string,
  raw: UpdateWorkspaceAreaInput,
) {
  const input = updateWorkspaceAreaSchema.parse(raw);
  await assertCanAccessArea(ctx, areaId, 'OWNER');
  return prisma.workspaceArea.update({
    where: { id: areaId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    },
    include: {
      _count: { select: { pages: true, databases: true, projects: true, members: true } },
    },
  });
}

export async function deleteArea(ctx: AccessContext, areaId: string) {
  await assertCanAccessArea(ctx, areaId, 'OWNER');
  await prisma.workspaceArea.delete({ where: { id: areaId } });
  return { deleted: true };
}

export async function listAreaMembers(ctx: AccessContext, areaId: string) {
  await assertCanAccessArea(ctx, areaId, 'VIEWER');
  return prisma.workspaceAreaMember.findMany({
    where: { tenantId: ctx.tenantId, areaId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function upsertAreaMember(
  ctx: AccessContext,
  areaId: string,
  raw: UpsertAreaMemberInput,
) {
  const input = upsertAreaMemberSchema.parse(raw);
  await assertCanAccessArea(ctx, areaId, 'OWNER');

  const tenantMember = await prisma.tenantMember.findUnique({
    where: { userId_tenantId: { userId: input.userId, tenantId: ctx.tenantId } },
  });
  if (!tenantMember) {
    throw new AppError(400, 'INVALID_MEMBER', 'Kullanıcı bu çalışma alanının üyesi değil');
  }

  return prisma.workspaceAreaMember.upsert({
    where: { areaId_userId: { areaId, userId: input.userId } },
    create: {
      tenantId: ctx.tenantId,
      areaId,
      userId: input.userId,
      role: input.role,
    },
    update: { role: input.role },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}

export async function removeAreaMember(ctx: AccessContext, areaId: string, userId: string) {
  await assertCanAccessArea(ctx, areaId, 'OWNER');
  const member = await prisma.workspaceAreaMember.findUnique({
    where: { areaId_userId: { areaId, userId } },
  });
  if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Üye bulunamadı');
  if (member.role === 'OWNER') {
    const owners = await prisma.workspaceAreaMember.count({
      where: { areaId, role: 'OWNER' },
    });
    if (owners <= 1) {
      throw new AppError(400, 'LAST_OWNER', 'Son yönetici kaldırılamaz');
    }
  }
  await prisma.workspaceAreaMember.delete({ where: { id: member.id } });
  return { deleted: true };
}

export async function getAreaContents(ctx: AccessContext, areaId: string) {
  await assertCanAccessArea(ctx, areaId, 'VIEWER');
  const [pages, databases, projects] = await Promise.all([
    prisma.page.findMany({
      where: { tenantId: ctx.tenantId, workspaceAreaId: areaId },
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.database.findMany({
      where: { tenantId: ctx.tenantId, workspaceAreaId: areaId },
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { rows: true } },
      },
    }),
    prisma.project.findMany({
      where: { tenantId: ctx.tenantId, workspaceAreaId: areaId },
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { tasks: true } },
      },
    }),
  ]);
  return { pages, databases, projects };
}
