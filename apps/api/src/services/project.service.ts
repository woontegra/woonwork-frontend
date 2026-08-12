import {
  createProjectSchema,
  updateProjectSchema,
  moveContentSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '@woonwork/shared';
import type { Prisma, ProjectStatus } from '@prisma/client';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import {
  accessibleWhere,
  assertAreaAssignable,
  assertCanEdit,
  assertCanView,
  touchRecent,
  type AccessContext,
} from './contentAccess.service';

export async function listProjects(
  ctx: AccessContext,
  filters?: { status?: string; q?: string },
) {
  const access = (await accessibleWhere(ctx, 'PROJECT')) as Prisma.ProjectWhereInput;
  return prisma.project.findMany({
    where: {
      ...access,
      ...(filters?.status ? { status: filters.status as ProjectStatus } : {}),
      ...(filters?.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: 'insensitive' } },
              { description: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      workspaceArea: { select: { id: true, name: true, icon: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getProject(ctx: AccessContext, id: string) {
  await assertCanView(ctx, 'PROJECT', id);
  const project = await prisma.project.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      workspaceArea: { select: { id: true, name: true, icon: true } },
      _count: { select: { tasks: true } },
    },
  });

  if (!project) {
    throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proje bulunamadı');
  }

  void touchRecent(ctx, 'PROJECT', id);
  return project;
}

export async function createProject(ctx: AccessContext, raw: CreateProjectInput) {
  const input = createProjectSchema.parse(raw);
  const workspaceAreaId = await assertAreaAssignable(ctx, input.workspaceAreaId);
  return prisma.project.create({
    data: {
      tenantId: ctx.tenantId,
      createdById: ctx.userId,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? 'ACTIVE',
      workspaceAreaId: workspaceAreaId ?? null,
    },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      workspaceArea: { select: { id: true, name: true, icon: true } },
      _count: { select: { tasks: true } },
    },
  });
}

export async function updateProject(ctx: AccessContext, id: string, raw: UpdateProjectInput) {
  const input = updateProjectSchema.parse(raw);
  await assertCanEdit(ctx, 'PROJECT', id);

  let workspaceAreaId = input.workspaceAreaId;
  if (workspaceAreaId !== undefined) {
    workspaceAreaId = await assertAreaAssignable(ctx, workspaceAreaId);
  }

  return prisma.project.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(workspaceAreaId !== undefined ? { workspaceAreaId } : {}),
    },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      workspaceArea: { select: { id: true, name: true, icon: true } },
      _count: { select: { tasks: true } },
    },
  });
}

export async function moveProject(ctx: AccessContext, id: string, raw: unknown) {
  const input = moveContentSchema.parse(raw);
  return updateProject(ctx, id, { workspaceAreaId: input.workspaceAreaId });
}

export async function deleteProject(ctx: AccessContext, id: string) {
  await assertCanEdit(ctx, 'PROJECT', id);
  await prisma.project.delete({ where: { id } });
}
