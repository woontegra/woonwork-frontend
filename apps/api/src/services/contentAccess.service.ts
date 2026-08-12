import type {
  ContentResourceType,
  Prisma,
  SharePermission,
  TenantRole,
  WorkspaceAreaRole,
} from '@prisma/client';
import { hasMinAreaRole, hasMinRole } from '@woonwork/shared';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';

export type AccessContext = {
  tenantId: string;
  userId: string;
  tenantRole: TenantRole;
};

export type AccessLevel = 'NONE' | 'VIEW' | 'EDIT';

const AREA_EDIT_ROLES: WorkspaceAreaRole[] = ['OWNER', 'EDITOR', 'MEMBER'];

function isTenantAdmin(role: TenantRole) {
  return hasMinRole(role, 'ADMIN');
}

export async function getAccessibleAreaIds(ctx: AccessContext): Promise<string[]> {
  const [memberships, tenantAreas] = await Promise.all([
    prisma.workspaceAreaMember.findMany({
      where: { tenantId: ctx.tenantId, userId: ctx.userId },
      select: { areaId: true },
    }),
    prisma.workspaceArea.findMany({
      where: { tenantId: ctx.tenantId, visibility: 'TENANT' },
      select: { id: true },
    }),
  ]);
  return [...new Set([...memberships.map((m) => m.areaId), ...tenantAreas.map((a) => a.id)])];
}

export async function getSharedResourceIds(
  ctx: AccessContext,
  resourceType: ContentResourceType,
  minPermission: SharePermission = 'VIEW',
): Promise<string[]> {
  const shares = await prisma.contentShare.findMany({
    where: {
      tenantId: ctx.tenantId,
      sharedWithUserId: ctx.userId,
      resourceType,
      ...(minPermission === 'EDIT' ? { permission: 'EDIT' } : {}),
    },
    select: { resourceId: true },
  });
  return shares.map((s) => s.resourceId);
}

/** Prisma where for list queries — tenant admins see all. */
export async function accessibleWhere(
  ctx: AccessContext,
  resourceType: ContentResourceType,
): Promise<Prisma.PageWhereInput | Prisma.DatabaseWhereInput | Prisma.ProjectWhereInput> {
  if (isTenantAdmin(ctx.tenantRole)) {
    return { tenantId: ctx.tenantId };
  }

  const [areaIds, sharedIds] = await Promise.all([
    getAccessibleAreaIds(ctx),
    getSharedResourceIds(ctx, resourceType, 'VIEW'),
  ]);

  return {
    tenantId: ctx.tenantId,
    OR: [
      { createdById: ctx.userId, workspaceAreaId: null },
      ...(areaIds.length ? [{ workspaceAreaId: { in: areaIds } }] : []),
      ...(sharedIds.length ? [{ id: { in: sharedIds } }] : []),
    ],
  };
}

async function loadResource(
  resourceType: ContentResourceType,
  tenantId: string,
  resourceId: string,
) {
  if (resourceType === 'PAGE') {
    return prisma.page.findFirst({
      where: { id: resourceId, tenantId },
      select: {
        id: true,
        tenantId: true,
        createdById: true,
        workspaceAreaId: true,
      },
    });
  }
  if (resourceType === 'DATABASE') {
    return prisma.database.findFirst({
      where: { id: resourceId, tenantId },
      select: {
        id: true,
        tenantId: true,
        createdById: true,
        workspaceAreaId: true,
      },
    });
  }
  return prisma.project.findFirst({
    where: { id: resourceId, tenantId },
    select: {
      id: true,
      tenantId: true,
      createdById: true,
      workspaceAreaId: true,
    },
  });
}

export async function resolveAccess(
  ctx: AccessContext,
  resourceType: ContentResourceType,
  resourceId: string,
): Promise<AccessLevel> {
  const resource = await loadResource(resourceType, ctx.tenantId, resourceId);
  if (!resource) return 'NONE';

  if (isTenantAdmin(ctx.tenantRole)) return 'EDIT';

  if (resource.createdById === ctx.userId && !resource.workspaceAreaId) {
    return 'EDIT';
  }

  const share = await prisma.contentShare.findUnique({
    where: {
      tenantId_resourceType_resourceId_sharedWithUserId: {
        tenantId: ctx.tenantId,
        resourceType,
        resourceId,
        sharedWithUserId: ctx.userId,
      },
    },
  });
  if (share) {
    return share.permission === 'EDIT' ? 'EDIT' : 'VIEW';
  }

  if (resource.workspaceAreaId) {
    const area = await prisma.workspaceArea.findFirst({
      where: { id: resource.workspaceAreaId, tenantId: ctx.tenantId },
    });
    if (!area) return 'NONE';

    const membership = await prisma.workspaceAreaMember.findUnique({
      where: {
        areaId_userId: { areaId: area.id, userId: ctx.userId },
      },
    });

    if (membership) {
      if (AREA_EDIT_ROLES.includes(membership.role)) return 'EDIT';
      return 'VIEW';
    }

    // TENANT-wide areas: all tenant members can edit collaboratively
    if (area.visibility === 'TENANT') return 'EDIT';
    return 'NONE';
  }

  return 'NONE';
}

export async function assertCanView(
  ctx: AccessContext,
  resourceType: ContentResourceType,
  resourceId: string,
) {
  const level = await resolveAccess(ctx, resourceType, resourceId);
  if (level === 'NONE') {
    throw new AppError(404, 'NOT_FOUND', 'İçerik bulunamadı');
  }
  return level;
}

export async function assertCanEdit(
  ctx: AccessContext,
  resourceType: ContentResourceType,
  resourceId: string,
) {
  const level = await resolveAccess(ctx, resourceType, resourceId);
  if (level !== 'EDIT') {
    if (level === 'NONE') {
      throw new AppError(404, 'NOT_FOUND', 'İçerik bulunamadı');
    }
    throw new AppError(403, 'FORBIDDEN', 'Bu içerikte düzenleme yetkiniz yok');
  }
  return level;
}

export async function assertCanAccessArea(
  ctx: AccessContext,
  areaId: string,
  minRole: WorkspaceAreaRole = 'VIEWER',
) {
  const area = await prisma.workspaceArea.findFirst({
    where: { id: areaId, tenantId: ctx.tenantId },
  });
  if (!area) throw new AppError(404, 'AREA_NOT_FOUND', 'Alan bulunamadı');

  if (isTenantAdmin(ctx.tenantRole)) return { area, role: 'OWNER' as WorkspaceAreaRole };

  const membership = await prisma.workspaceAreaMember.findUnique({
    where: { areaId_userId: { areaId, userId: ctx.userId } },
  });
  if (membership && hasMinAreaRole(membership.role, minRole)) {
    return { area, role: membership.role };
  }

  if (area.visibility === 'TENANT' && hasMinAreaRole('MEMBER', minRole)) {
    return { area, role: 'MEMBER' as WorkspaceAreaRole };
  }
  if (area.visibility === 'TENANT' && minRole === 'VIEWER') {
    return { area, role: 'VIEWER' as WorkspaceAreaRole };
  }

  throw new AppError(404, 'AREA_NOT_FOUND', 'Alan bulunamadı');
}

/** Areas visible in directory (PRIVATE hidden from non-members). */
export async function listVisibleAreas(ctx: AccessContext) {
  if (isTenantAdmin(ctx.tenantRole)) {
    return prisma.workspaceArea.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { members: true, pages: true, databases: true, projects: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  const memberships = await prisma.workspaceAreaMember.findMany({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
    select: { areaId: true },
  });
  const memberAreaIds = memberships.map((m) => m.areaId);

  return prisma.workspaceArea.findMany({
    where: {
      tenantId: ctx.tenantId,
      OR: [
        { visibility: 'TENANT' },
        { visibility: 'MEMBERS', id: { in: memberAreaIds } },
        { visibility: 'PRIVATE', id: { in: memberAreaIds } },
      ],
    },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { members: true, pages: true, databases: true, projects: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function assertAreaAssignable(ctx: AccessContext, areaId: string | null | undefined) {
  if (!areaId) return null;
  await assertCanAccessArea(ctx, areaId, 'MEMBER');
  return areaId;
}

export async function touchRecent(
  ctx: AccessContext,
  resourceType: ContentResourceType,
  resourceId: string,
) {
  const level = await resolveAccess(ctx, resourceType, resourceId);
  if (level === 'NONE') return;
  await prisma.recentItem.upsert({
    where: {
      tenantId_userId_resourceType_resourceId: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        resourceType,
        resourceId,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      resourceType,
      resourceId,
      lastOpenedAt: new Date(),
    },
    update: { lastOpenedAt: new Date() },
  });
}

export function accessCtxFromReq(req: {
  tenant: { id: string };
  user: { id: string };
  membership: { role: TenantRole };
}): AccessContext {
  return {
    tenantId: req.tenant.id,
    userId: req.user.id,
    tenantRole: req.membership.role,
  };
}
