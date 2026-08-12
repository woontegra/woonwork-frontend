import {
  createShareSchema,
  updateShareSchema,
  type ContentResourceType,
  type CreateShareInput,
  type UpdateShareInput,
} from '@woonwork/shared';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { assertCanEdit, type AccessContext } from './contentAccess.service';

async function assertResourceExists(
  ctx: AccessContext,
  resourceType: ContentResourceType,
  resourceId: string,
) {
  if (resourceType === 'PAGE') {
    const r = await prisma.page.findFirst({ where: { id: resourceId, tenantId: ctx.tenantId } });
    if (!r) throw new AppError(404, 'NOT_FOUND', 'İçerik bulunamadı');
    return;
  }
  if (resourceType === 'DATABASE') {
    const r = await prisma.database.findFirst({
      where: { id: resourceId, tenantId: ctx.tenantId },
    });
    if (!r) throw new AppError(404, 'NOT_FOUND', 'İçerik bulunamadı');
    return;
  }
  const r = await prisma.project.findFirst({
    where: { id: resourceId, tenantId: ctx.tenantId },
  });
  if (!r) throw new AppError(404, 'NOT_FOUND', 'İçerik bulunamadı');
}

export async function listShares(
  ctx: AccessContext,
  resourceType: ContentResourceType,
  resourceId: string,
) {
  await assertCanEdit(ctx, resourceType, resourceId);
  return prisma.contentShare.findMany({
    where: { tenantId: ctx.tenantId, resourceType, resourceId },
    include: {
      sharedWithUser: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createShare(ctx: AccessContext, raw: CreateShareInput) {
  const input = createShareSchema.parse(raw);
  await assertCanEdit(ctx, input.resourceType, input.resourceId);
  await assertResourceExists(ctx, input.resourceType, input.resourceId);

  if (input.sharedWithUserId === ctx.userId) {
    throw new AppError(400, 'INVALID_SHARE', 'Kendinizle paylaşamazsınız');
  }

  const member = await prisma.tenantMember.findUnique({
    where: {
      userId_tenantId: { userId: input.sharedWithUserId, tenantId: ctx.tenantId },
    },
  });
  if (!member) {
    throw new AppError(400, 'INVALID_MEMBER', 'Kullanıcı bu çalışma alanının üyesi değil');
  }

  return prisma.contentShare.upsert({
    where: {
      tenantId_resourceType_resourceId_sharedWithUserId: {
        tenantId: ctx.tenantId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        sharedWithUserId: input.sharedWithUserId,
      },
    },
    create: {
      tenantId: ctx.tenantId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      sharedWithUserId: input.sharedWithUserId,
      permission: input.permission,
      createdById: ctx.userId,
    },
    update: { permission: input.permission },
    include: {
      sharedWithUser: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });
}

export async function updateShare(ctx: AccessContext, shareId: string, raw: UpdateShareInput) {
  const input = updateShareSchema.parse(raw);
  const share = await prisma.contentShare.findFirst({
    where: { id: shareId, tenantId: ctx.tenantId },
  });
  if (!share) throw new AppError(404, 'SHARE_NOT_FOUND', 'Paylaşım bulunamadı');
  await assertCanEdit(ctx, share.resourceType, share.resourceId);
  return prisma.contentShare.update({
    where: { id: shareId },
    data: { permission: input.permission },
    include: {
      sharedWithUser: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });
}

export async function deleteShare(ctx: AccessContext, shareId: string) {
  const share = await prisma.contentShare.findFirst({
    where: { id: shareId, tenantId: ctx.tenantId },
  });
  if (!share) throw new AppError(404, 'SHARE_NOT_FOUND', 'Paylaşım bulunamadı');
  await assertCanEdit(ctx, share.resourceType, share.resourceId);
  await prisma.contentShare.delete({ where: { id: shareId } });
  return { deleted: true };
}
