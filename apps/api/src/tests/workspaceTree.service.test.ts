import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import { PrismaClient, TenantRole } from '@prisma/client';
import * as pageService from '../services/page.service';
import * as workspaceArea from '../services/workspaceArea.service';
import * as treeService from '../services/workspaceTree.service';
import { AppError } from '../lib/errors';

const prisma = new PrismaClient();

const ids = {
  tenantA: '',
  tenantB: '',
  ownerA: '',
  memberA: '',
  outsiderA: '',
  ownerB: '',
  area: '',
  privatePage: '',
  areaPage: '',
  childPage: '',
  otherAreaPage: '',
  pageB: '',
};

function ownerA() {
  return { tenantId: ids.tenantA, userId: ids.ownerA, tenantRole: TenantRole.OWNER };
}
function memberA() {
  return { tenantId: ids.tenantA, userId: ids.memberA, tenantRole: TenantRole.MEMBER };
}
function outsiderA() {
  return { tenantId: ids.tenantA, userId: ids.outsiderA, tenantRole: TenantRole.MEMBER };
}
function ownerB() {
  return { tenantId: ids.tenantB, userId: ids.ownerB, tenantRole: TenantRole.OWNER };
}

beforeAll(async () => {
  const passwordHash = await bcrypt.hash('TestPass123!', 10);
  const stamp = Date.now();

  const owner = await prisma.user.create({
    data: { email: `tree-o-${stamp}@test.local`, passwordHash, firstName: 'Tree', lastName: 'O' },
  });
  const member = await prisma.user.create({
    data: { email: `tree-m-${stamp}@test.local`, passwordHash, firstName: 'Tree', lastName: 'M' },
  });
  const outsider = await prisma.user.create({
    data: { email: `tree-x-${stamp}@test.local`, passwordHash, firstName: 'Tree', lastName: 'X' },
  });
  const ownerBUser = await prisma.user.create({
    data: { email: `tree-b-${stamp}@test.local`, passwordHash, firstName: 'Tree', lastName: 'B' },
  });

  const tenantA = await prisma.tenant.create({
    data: { name: 'Tenant A Tree', slug: `tenant-a-tree-${stamp}` },
  });
  const tenantB = await prisma.tenant.create({
    data: { name: 'Tenant B Tree', slug: `tenant-b-tree-${stamp}` },
  });

  await prisma.tenantMember.createMany({
    data: [
      { userId: owner.id, tenantId: tenantA.id, role: TenantRole.OWNER },
      { userId: member.id, tenantId: tenantA.id, role: TenantRole.MEMBER },
      { userId: outsider.id, tenantId: tenantA.id, role: TenantRole.MEMBER },
      { userId: ownerBUser.id, tenantId: tenantB.id, role: TenantRole.OWNER },
    ],
  });

  ids.tenantA = tenantA.id;
  ids.tenantB = tenantB.id;
  ids.ownerA = owner.id;
  ids.memberA = member.id;
  ids.outsiderA = outsider.id;
  ids.ownerB = ownerBUser.id;

  const privatePage = await pageService.createPage(ownerA(), { title: 'Özel Kök' });
  ids.privatePage = privatePage.id;

  const area = await workspaceArea.createArea(ownerA(), {
    name: 'Bilirkişi Hesap',
    visibility: 'MEMBERS',
  });
  await workspaceArea.upsertAreaMember(ownerA(), area.id, {
    userId: member.id,
    role: 'MEMBER',
  });
  ids.area = area.id;

  const areaPage = await pageService.createPage(ownerA(), {
    title: 'İçerik Planı',
    workspaceAreaId: area.id,
  });
  ids.areaPage = areaPage.id;

  const child = await pageService.createPage(ownerA(), {
    title: '2026 Plan',
    parentId: areaPage.id,
  });
  ids.childPage = child.id;

  const otherArea = await workspaceArea.createArea(ownerA(), {
    name: 'Woontegra',
    visibility: 'TENANT',
  });
  const otherPage = await pageService.createPage(ownerA(), {
    title: 'Toplantılar',
    workspaceAreaId: otherArea.id,
  });
  ids.otherAreaPage = otherPage.id;

  const pageB = await pageService.createPage(ownerB(), { title: 'Tenant B Sayfa' });
  ids.pageB = pageB.id;
});

afterAll(async () => {
  await prisma.block.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.page.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.workspaceAreaMember.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.workspaceArea.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.tenantMember.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.tenant.deleteMany({ where: { id: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.ownerA, ids.memberA, ids.outsiderA, ids.ownerB] } },
  });
  await prisma.$disconnect();
});

describe('workspace tree access', () => {
  it('owner tree private + area nested pages içerir', async () => {
    const tree = await treeService.getWorkspaceTree(ownerA());
    expect(tree.private.pages.some((p) => p.id === ids.privatePage)).toBe(true);
    const area = tree.areas.find((a) => a.id === ids.area);
    expect(area).toBeTruthy();
    const plan = area?.pages.find((p) => p.id === ids.areaPage);
    expect(plan?.children?.some((c) => c.id === ids.childPage)).toBe(true);
  });

  it('private sayfa area üyesine tree private içinde düşmez', async () => {
    const tree = await treeService.getWorkspaceTree(memberA());
    expect(tree.private.pages.some((p) => p.id === ids.privatePage)).toBe(false);
    const area = tree.areas.find((a) => a.id === ids.area);
    expect(area?.pages.some((p) => p.id === ids.areaPage)).toBe(true);
  });

  it('area dışı üye MEMBERS alanını tree’de görmez', async () => {
    const tree = await treeService.getWorkspaceTree(outsiderA());
    expect(tree.areas.some((a) => a.id === ids.area)).toBe(false);
    expect(
      tree.areas.flatMap((a) => a.pages).some((p) => p.id === ids.areaPage),
    ).toBe(false);
  });

  it('nested page erişimi area üyesine açık, outsider’a kapalı', async () => {
    await expect(pageService.getPage(memberA(), ids.childPage)).resolves.toMatchObject({
      id: ids.childPage,
    });
    await expect(pageService.getPage(outsiderA(), ids.childPage)).rejects.toBeInstanceOf(AppError);
  });

  it('tenant B tree A içeriğini görmez', async () => {
    const tree = await treeService.getWorkspaceTree(ownerB());
    expect(tree.private.pages.some((p) => p.id === ids.privatePage)).toBe(false);
    expect(tree.areas.some((a) => a.id === ids.area)).toBe(false);
    expect(tree.private.pages.some((p) => p.id === ids.pageB)).toBe(true);
    await expect(pageService.getPage(ownerB(), ids.privatePage)).rejects.toBeInstanceOf(AppError);
  });
});

describe('page move + cycle', () => {
  it('sayfayı başka alana taşır', async () => {
    const moved = await pageService.movePage(ownerA(), ids.childPage, {
      workspaceAreaId: null,
      parentId: null,
    });
    expect(moved.workspaceAreaId).toBeNull();
    expect(moved.parentId).toBeNull();

    await pageService.movePage(ownerA(), ids.childPage, {
      workspaceAreaId: ids.area,
      parentId: ids.areaPage,
    });
    const restored = await pageService.getPage(ownerA(), ids.childPage);
    expect(restored.workspaceAreaId).toBe(ids.area);
    expect(restored.parentId).toBe(ids.areaPage);
  });

  it('döngüsel taşımayı reddeder', async () => {
    await expect(
      pageService.movePage(ownerA(), ids.areaPage, { parentId: ids.childPage }),
    ).rejects.toMatchObject({ code: 'INVALID_PARENT' } satisfies Partial<AppError>);
    await expect(
      pageService.movePage(ownerA(), ids.areaPage, { parentId: ids.areaPage }),
    ).rejects.toMatchObject({ code: 'INVALID_PARENT' });
  });

  it('alt sayfa oluşturur', async () => {
    const result = await pageService.createSubpage(ownerA(), ids.areaPage, {
      title: 'Slash alt sayfa',
    });
    expect(result.page.parentId).toBe(ids.areaPage);
    expect(result.block.type).toBe('SUBPAGE');
    const content = result.block.content as { pageId?: string };
    expect(content.pageId).toBe(result.page.id);
  });
});
