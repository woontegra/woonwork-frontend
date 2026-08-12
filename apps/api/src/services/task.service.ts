import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@woonwork/shared';
import type { TaskPriority, TaskStatus } from '@prisma/client';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import {
  accessibleWhere,
  assertCanEdit,
  assertCanView,
  type AccessContext,
} from './contentAccess.service';

async function assertAssigneeInTenant(tenantId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return;
  const member = await prisma.tenantMember.findUnique({
    where: { userId_tenantId: { userId: assigneeId, tenantId } },
  });
  if (!member) {
    throw new AppError(400, 'INVALID_ASSIGNEE', 'Sorumlu bu çalışma alanının üyesi değil');
  }
}

async function assertTaskAccess(ctx: AccessContext, taskId: string, mode: 'VIEW' | 'EDIT') {
  const task = await prisma.task.findFirst({
    where: { id: taskId, tenantId: ctx.tenantId },
    select: { id: true, projectId: true, createdById: true },
  });
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Görev bulunamadı');

  if (task.projectId) {
    if (mode === 'EDIT') await assertCanEdit(ctx, 'PROJECT', task.projectId);
    else await assertCanView(ctx, 'PROJECT', task.projectId);
    return task;
  }

  // Projectless tasks: creator or tenant admin
  if (task.createdById === ctx.userId) return task;
  const { hasMinRole } = await import('@woonwork/shared');
  if (hasMinRole(ctx.tenantRole, 'ADMIN')) return task;
  throw new AppError(404, 'TASK_NOT_FOUND', 'Görev bulunamadı');
}

export async function listTasks(
  ctx: AccessContext,
  filters?: {
    status?: string;
    priority?: string;
    projectId?: string;
    assigneeId?: string;
    q?: string;
  },
) {
  const projectAccess = await accessibleWhere(ctx, 'PROJECT');
  const accessibleProjects = await prisma.project.findMany({
    where: projectAccess as object,
    select: { id: true },
  });
  const projectIds = accessibleProjects.map((p) => p.id);

  if (filters?.projectId) {
    if (!projectIds.includes(filters.projectId)) {
      return [];
    }
  }

  return prisma.task.findMany({
    where: {
      tenantId: ctx.tenantId,
      AND: [
        {
          OR: [
            { projectId: { in: projectIds } },
            { projectId: null, createdById: ctx.userId },
          ],
        },
        ...(filters?.status ? [{ status: filters.status as TaskStatus }] : []),
        ...(filters?.priority ? [{ priority: filters.priority as TaskPriority }] : []),
        ...(filters?.projectId ? [{ projectId: filters.projectId }] : []),
        ...(filters?.assigneeId ? [{ assigneeId: filters.assigneeId }] : []),
        ...(filters?.q
          ? [
              {
                OR: [
                  { title: { contains: filters.q, mode: 'insensitive' as const } },
                  { description: { contains: filters.q, mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
      ],
    },
    include: {
      project: { select: { id: true, name: true } },
      assignee: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
  });
}

export async function getTask(ctx: AccessContext, id: string) {
  await assertTaskAccess(ctx, id, 'VIEW');
  const task = await prisma.task.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      project: { select: { id: true, name: true } },
      assignee: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!task) {
    throw new AppError(404, 'TASK_NOT_FOUND', 'Görev bulunamadı');
  }

  return task;
}

export async function createTask(ctx: AccessContext, raw: CreateTaskInput) {
  const input = createTaskSchema.parse(raw);
  if (input.projectId) {
    await assertCanEdit(ctx, 'PROJECT', input.projectId);
  }
  await assertAssigneeInTenant(ctx.tenantId, input.assigneeId);

  return prisma.task.create({
    data: {
      tenantId: ctx.tenantId,
      createdById: ctx.userId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'TODO',
      priority: input.priority ?? 'MEDIUM',
      projectId: input.projectId ?? null,
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
    include: {
      project: { select: { id: true, name: true } },
      assignee: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });
}

export async function updateTask(ctx: AccessContext, id: string, raw: UpdateTaskInput) {
  const input = updateTaskSchema.parse(raw);
  await assertTaskAccess(ctx, id, 'EDIT');

  if (input.projectId) {
    await assertCanEdit(ctx, 'PROJECT', input.projectId);
  }
  if (input.assigneeId !== undefined) {
    await assertAssigneeInTenant(ctx.tenantId, input.assigneeId);
  }

  return prisma.task.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
      assignee: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });
}

export async function deleteTask(ctx: AccessContext, id: string) {
  await assertTaskAccess(ctx, id, 'EDIT');
  await prisma.task.delete({ where: { id } });
}
