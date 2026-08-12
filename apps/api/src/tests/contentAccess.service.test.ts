import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import { PrismaClient, TenantRole } from '@prisma/client';
import * as contentAccess from '../services/contentAccess.service';
import * as workspaceArea from '../services/workspaceArea.service';
import * as shareService from '../services/share.service';
import * as pageService from '../services/page.service';
import * as libraryService from '../services/library.service';
import { AppError } from '../lib/errors';

const prisma = new PrismaClient();

const ids = {
  tenant: '',
  owner: '',
  member: '',
  outsider: '',
  privatePage: '',
  areaPage: '',
  area: '',
};

beforeAll(async () => {
  const passwordHash = await bcrypt.hash('TestPass123!', 10);
  const stamp = Date.now();

  const owner = await prisma.user.create({
    data: {
      email: `lib-owner-${stamp}@test.local`,
      passwordHash,
      firstName: 'Owner',
      lastName: 'Lib',
    },
  });
  const member = await prisma.user.create({
    data: {
      email: `lib-member-${stamp}@test.local`,
      passwordHash,
      firstName: 'Member',
      lastName: 'Lib',
    },
  });
  const outsider = await prisma.user.create({
    data: {
      email: `lib-out-${stamp}@test.local`,
      passwordHash,
      firstName: 'Out',
      lastName: 'Lib',
    },
  });

  const tenant = await prisma.tenant.create({
    data: { name: 'Lib Tenant', slug: `lib-tenant-${stamp}` },
  });

  await prisma.tenantMember.createMany({
    data: [
      { userId: owner.id, tenantId: tenant.id, role: TenantRole.OWNER },
      { userId: member.id, tenantId: tenant.id, role: TenantRole.MEMBER },
      { userId: outsider.id, tenantId: tenant.id, role: TenantRole.MEMBER },
    ],
  });

  const ownerCtx = {
    tenantId: tenant.id,
    userId: owner.id,
    tenantRole: TenantRole.OWNER,
  };

  const privatePage = await pageService.createPage(ownerCtx, {
    title: 'Özel Sayfa',
    workspaceAreaId: null,
  });

  const area = await workspaceArea.createArea(ownerCtx, {
    name: 'Pazarlama',
    visibility: 'MEMBERS',
  });

  await workspaceArea.upsertAreaMember(ownerCtx, area.id, {
    userId: member.id,
    role: 'MEMBER',
  });

  const areaPage = await pageService.createPage(ownerCtx, {
    title: 'Alan Sayfası',
    workspaceAreaId: area.id,
  });

  ids.tenant = tenant.id;
  ids.owner = owner.id;
  ids.member = member.id;
  ids.outsider = outsider.id;
  ids.privatePage = privatePage.id;
  ids.areaPage = areaPage.id;
  ids.area = area.id;
});

afterAll(async () => {
  await prisma.contentShare.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.favorite.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.recentItem.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.workspaceAreaMember.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.page.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.workspaceArea.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.tenantMember.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.tenant.delete({ where: { id: ids.tenant } });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.owner, ids.member, ids.outsider] } },
  });
  await prisma.$disconnect();
});

describe('content access — private / area / share', () => {
  const memberCtx = () => ({
    tenantId: ids.tenant,
    userId: ids.member,
    tenantRole: TenantRole.MEMBER,
  });
  const outsiderCtx = () => ({
    tenantId: ids.tenant,
    userId: ids.outsider,
    tenantRole: TenantRole.MEMBER,
  });
  const ownerCtx = () => ({
    tenantId: ids.tenant,
    userId: ids.owner,
    tenantRole: TenantRole.OWNER,
  });

  it('özel içerik yalnızca sahibi ve tenant admin görür', async () => {
    expect(await contentAccess.resolveAccess(ownerCtx(), 'PAGE', ids.privatePage)).toBe('EDIT');
    expect(await contentAccess.resolveAccess(memberCtx(), 'PAGE', ids.privatePage)).toBe('NONE');
    await expect(
      pageService.getPage(memberCtx(), ids.privatePage),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('alan üyesi alan içeriğini görür, üye olmayan görmez', async () => {
    expect(await contentAccess.resolveAccess(memberCtx(), 'PAGE', ids.areaPage)).toBe('EDIT');
    expect(await contentAccess.resolveAccess(outsiderCtx(), 'PAGE', ids.areaPage)).toBe('NONE');
  });

  it('üye olmayan alan dizininde alanı görmez', async () => {
    const visible = await contentAccess.listVisibleAreas(outsiderCtx());
    expect(visible.some((a) => a.id === ids.area)).toBe(false);
    const memberAreas = await contentAccess.listVisibleAreas(memberCtx());
    expect(memberAreas.some((a) => a.id === ids.area)).toBe(true);
  });

  it('share VIEW erişim verir, EDIT vermez', async () => {
    await shareService.createShare(ownerCtx(), {
      resourceType: 'PAGE',
      resourceId: ids.privatePage,
      sharedWithUserId: ids.outsider,
      permission: 'VIEW',
    });
    expect(await contentAccess.resolveAccess(outsiderCtx(), 'PAGE', ids.privatePage)).toBe('VIEW');
    await expect(
      contentAccess.assertCanEdit(outsiderCtx(), 'PAGE', ids.privatePage),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('library private view yalnızca kendi özel içeriklerini listeler', async () => {
    const result = await libraryService.listLibrary(memberCtx(), {
      view: 'private',
      page: 1,
      limit: 50,
    });
    expect(result.items.every((i) => i.workspaceAreaId === null)).toBe(true);
    expect(result.items.some((i) => i.id === ids.privatePage)).toBe(false);
  });
});
