import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import { PrismaClient, TenantRole } from '@prisma/client';
import * as brandService from '../services/socialBrand.service';
import * as contentService from '../services/socialContent.service';
import * as workspaceArea from '../services/workspaceArea.service';
import { AppError } from '../lib/errors';

const prisma = new PrismaClient();

const ids = {
  tenantA: '',
  tenantB: '',
  userA: '',
  userB: '',
  member: '',
  outsider: '',
  area: '',
  brandA: '',
  brandB: '',
  mediaA: '',
  mediaA2: '',
  mediaB: '',
  contentA: '',
};

function ctxA() {
  return { tenantId: ids.tenantA, userId: ids.userA, tenantRole: TenantRole.OWNER };
}
function ctxB() {
  return { tenantId: ids.tenantB, userId: ids.userB, tenantRole: TenantRole.OWNER };
}
function memberCtx() {
  return { tenantId: ids.tenantA, userId: ids.member, tenantRole: TenantRole.MEMBER };
}
function outsiderCtx() {
  return { tenantId: ids.tenantA, userId: ids.outsider, tenantRole: TenantRole.MEMBER };
}

beforeAll(async () => {
  const passwordHash = await bcrypt.hash('TestPass123!', 10);
  const stamp = Date.now();

  const userA = await prisma.user.create({
    data: { email: `soc-a-${stamp}@test.local`, passwordHash, firstName: 'Soc', lastName: 'A' },
  });
  const userB = await prisma.user.create({
    data: { email: `soc-b-${stamp}@test.local`, passwordHash, firstName: 'Soc', lastName: 'B' },
  });
  const member = await prisma.user.create({
    data: { email: `soc-m-${stamp}@test.local`, passwordHash, firstName: 'Soc', lastName: 'M' },
  });
  const outsider = await prisma.user.create({
    data: { email: `soc-o-${stamp}@test.local`, passwordHash, firstName: 'Soc', lastName: 'O' },
  });

  const tenantA = await prisma.tenant.create({
    data: { name: 'Tenant A Social', slug: `tenant-a-soc-${stamp}` },
  });
  const tenantB = await prisma.tenant.create({
    data: { name: 'Tenant B Social', slug: `tenant-b-soc-${stamp}` },
  });

  await prisma.tenantMember.createMany({
    data: [
      { userId: userA.id, tenantId: tenantA.id, role: TenantRole.OWNER },
      { userId: member.id, tenantId: tenantA.id, role: TenantRole.MEMBER },
      { userId: outsider.id, tenantId: tenantA.id, role: TenantRole.MEMBER },
      { userId: userB.id, tenantId: tenantB.id, role: TenantRole.OWNER },
    ],
  });

  ids.tenantA = tenantA.id;
  ids.tenantB = tenantB.id;
  ids.userA = userA.id;
  ids.userB = userB.id;
  ids.member = member.id;
  ids.outsider = outsider.id;

  const area = await workspaceArea.createArea(ctxA(), {
    name: 'Bilirkişi Hesap Alanı',
    visibility: 'MEMBERS',
  });
  await workspaceArea.upsertAreaMember(ctxA(), area.id, {
    userId: member.id,
    role: 'MEMBER',
  });
  ids.area = area.id;

  const mediaA = await prisma.mediaAsset.create({
    data: {
      tenantId: tenantA.id,
      uploadedById: userA.id,
      originalFileName: 'cover.png',
      fileName: 'cover.png',
      mimeType: 'image/png',
      size: 1024,
      storageProvider: 'vercel-blob',
      storageKey: `tenants/${tenantA.id}/media/2026/08/soc-cover.png`,
      url: 'https://example.com/soc-cover.png',
      category: 'IMAGE',
    },
  });
  const mediaA2 = await prisma.mediaAsset.create({
    data: {
      tenantId: tenantA.id,
      uploadedById: userA.id,
      originalFileName: 'slide.png',
      fileName: 'slide.png',
      mimeType: 'image/png',
      size: 2048,
      storageProvider: 'vercel-blob',
      storageKey: `tenants/${tenantA.id}/media/2026/08/soc-slide.png`,
      url: 'https://example.com/soc-slide.png',
      category: 'IMAGE',
    },
  });
  const mediaB = await prisma.mediaAsset.create({
    data: {
      tenantId: tenantB.id,
      uploadedById: userB.id,
      originalFileName: 'secret.png',
      fileName: 'secret.png',
      mimeType: 'image/png',
      size: 512,
      storageProvider: 'vercel-blob',
      storageKey: `tenants/${tenantB.id}/media/2026/08/soc-secret.png`,
      url: 'https://example.com/soc-secret.png',
      category: 'IMAGE',
    },
  });
  ids.mediaA = mediaA.id;
  ids.mediaA2 = mediaA2.id;
  ids.mediaB = mediaB.id;
});

afterAll(async () => {
  await prisma.socialContentDestination.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.socialAccount.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.socialConnection.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.socialOAuthSession.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.socialContentMedia.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.socialContentPlatform.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.socialContent.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.socialHashtag.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.socialBrand.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.mediaAsset.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.workspaceAreaMember.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.workspaceArea.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.tenantMember.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.tenant.deleteMany({ where: { id: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.userA, ids.userB, ids.member, ids.outsider] } },
  });
  await prisma.$disconnect();
});

describe('SocialBrand CRUD', () => {
  it('marka oluşturur, günceller ve listeler', async () => {
    const created = await brandService.createBrand(ctxA(), {
      name: 'Bilirkişi Hesap',
      description: 'Uzman hesap',
      color: '#1f2937',
    });
    ids.brandA = created.id;
    expect(created.tenantId).toBe(ids.tenantA);
    expect(created.isActive).toBe(true);

    const updated = await brandService.updateBrand(ctxA(), created.id, { name: 'Bilirkişi' });
    expect(updated.name).toBe('Bilirkişi');

    const list = await brandService.listBrands(ctxA());
    expect(list.some((b) => b.id === created.id)).toBe(true);

    const brandB = await brandService.createBrand(ctxB(), { name: 'Yabancı Marka' });
    ids.brandB = brandB.id;
    const listB = await brandService.listBrands(ctxB());
    expect(listB.every((b) => b.tenantId === ids.tenantB)).toBe(true);
    expect(listB.some((b) => b.id === created.id)).toBe(false);
  });

  it('başka tenant markasını okuyamaz / silemez', async () => {
    await expect(brandService.getBrand(ctxB(), ids.brandA)).rejects.toMatchObject({
      code: 'BRAND_NOT_FOUND',
    } satisfies Partial<AppError>);
    await expect(brandService.deleteBrand(ctxB(), ids.brandA)).rejects.toMatchObject({
      code: 'BRAND_NOT_FOUND',
    });
  });

  it('boş marka silinebilir; listBrands stats içerir', async () => {
    const empty = await brandService.createBrand(ctxA(), { name: 'Geçici Boş' });
    const list = await brandService.listBrands(ctxA());
    const row = list.find((b) => b.id === empty.id);
    expect(row?.stats).toMatchObject({
      contents: 0,
      planned: 0,
      published: 0,
      hashtags: 0,
      accounts: 0,
    });
    await expect(brandService.deleteBrand(ctxA(), empty.id)).resolves.toEqual({ deleted: true });
  });
});

describe('SocialContent CRUD & isolation', () => {
  it('içerik oluşturur ve okur', async () => {
    const content = await contentService.createContent(ctxA(), {
      title: 'Ağustos planı',
      contentText: 'Kısa metin',
      contentType: 'POST',
      socialBrandId: ids.brandA,
      platforms: ['INSTAGRAM', 'LINKEDIN'],
      scheduledAt: new Date(2026, 7, 12, 10, 0, 0).toISOString(),
    });
    ids.contentA = content.id;
    expect(content.platforms.map((p) => p.platform).sort()).toEqual(['INSTAGRAM', 'LINKEDIN']);
    expect(content.brand?.id).toBe(ids.brandA);
    expect(content.status).toBe('DRAFT');

    const fetched = await contentService.getContent(ctxA(), content.id);
    expect(fetched.title).toBe('Ağustos planı');
  });

  it('tenant B içeriği okuyamaz / güncelleyemez / silemez', async () => {
    await expect(contentService.getContent(ctxB(), ids.contentA)).rejects.toMatchObject({
      code: 'CONTENT_NOT_FOUND',
    } satisfies Partial<AppError>);
    await expect(
      contentService.updateContent(ctxB(), ids.contentA, { title: 'Hack' }),
    ).rejects.toMatchObject({ code: 'CONTENT_NOT_FOUND' });
    await expect(contentService.deleteContent(ctxB(), ids.contentA)).rejects.toMatchObject({
      code: 'CONTENT_NOT_FOUND',
    });
  });

  it('geçersiz tenant markasını reddeder', async () => {
    await expect(
      contentService.createContent(ctxA(), {
        title: 'Yanlış marka',
        socialBrandId: ids.brandB,
        platforms: ['INSTAGRAM'],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_BRAND' } satisfies Partial<AppError>);
  });

  it('ilişkili marka hard-delete reddedilir; pasife alınabilir', async () => {
    await expect(brandService.deleteBrand(ctxA(), ids.brandA)).rejects.toMatchObject({
      code: 'BRAND_HAS_RELATIONS',
    });
    const deactivated = await brandService.updateBrand(ctxA(), ids.brandA, { isActive: false });
    expect(deactivated.isActive).toBe(false);
    await brandService.updateBrand(ctxA(), ids.brandA, { isActive: true });
  });

  it('geçersiz tenant medyasını reddeder', async () => {
    await expect(
      contentService.addMedia(ctxA(), ids.contentA, { mediaAssetId: ids.mediaB }),
    ).rejects.toMatchObject({ code: 'INVALID_MEDIA' } satisfies Partial<AppError>);
  });
});

describe('SocialContent media', () => {
  it('medya ekler ve sıralamayı kaydeder', async () => {
    const withFirst = await contentService.addMedia(ctxA(), ids.contentA, {
      mediaAssetId: ids.mediaA,
    });
    const withSecond = await contentService.addMedia(ctxA(), ids.contentA, {
      mediaAssetId: ids.mediaA2,
    });
    expect(withSecond.media).toHaveLength(2);
    expect(withSecond.media[0].mediaAssetId).toBe(ids.mediaA);
    expect(withSecond.media[1].mediaAssetId).toBe(ids.mediaA2);
    expect(withSecond.media[0].position).toBeLessThan(withSecond.media[1].position);

    const reordered = await contentService.reorderMedia(ctxA(), ids.contentA, {
      orderedIds: [withSecond.media[1].id, withSecond.media[0].id],
    });
    expect(reordered.media.map((m) => m.mediaAssetId)).toEqual([ids.mediaA2, ids.mediaA]);
    expect(reordered.media[0].position).toBeLessThan(reordered.media[1].position);
    expect(withFirst.media).toHaveLength(1);
  });
});

describe('SocialContent workflow', () => {
  it('onaysız yayına hazırı reddeder', async () => {
    await expect(
      contentService.updateContent(ctxA(), ids.contentA, { readyToPublish: true }),
    ).rejects.toMatchObject({ code: 'WORKFLOW_INVALID' } satisfies Partial<AppError>);
  });

  it('hazır olmadan yayınlamayı reddeder', async () => {
    await contentService.updateContent(ctxA(), ids.contentA, { approved: true });
    await expect(
      contentService.updateContent(ctxA(), ids.contentA, { published: true }),
    ).rejects.toMatchObject({ code: 'WORKFLOW_INVALID' });
  });

  it('yayınlanınca publishedAt set eder, geri alınca temizler', async () => {
    const ready = await contentService.updateContent(ctxA(), ids.contentA, {
      readyToPublish: true,
    });
    expect(ready.approved).toBe(true);
    expect(ready.readyToPublish).toBe(true);

    const published = await contentService.updateContent(ctxA(), ids.contentA, {
      published: true,
    });
    expect(published.published).toBe(true);
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).toBeTruthy();

    const unpublished = await contentService.updateContent(ctxA(), ids.contentA, {
      published: false,
    });
    expect(unpublished.published).toBe(false);
    expect(unpublished.publishedAt).toBeNull();
  });

  it('duplicate iş akışını sıfırlar, medya ve platform kopyalar', async () => {
    await contentService.updateContent(ctxA(), ids.contentA, {
      approved: true,
      readyToPublish: true,
      published: true,
      edited: true,
    });
    const copy = await contentService.duplicateContent(ctxA(), ids.contentA);
    expect(copy.title).toContain('kopya');
    expect(copy.scheduledAt).toBeNull();
    expect(copy.published).toBe(false);
    expect(copy.publishedAt).toBeNull();
    expect(copy.approved).toBe(false);
    expect(copy.readyToPublish).toBe(false);
    expect(copy.edited).toBe(false);
    expect(copy.status).toBe('DRAFT');
    expect(copy.socialBrandId).toBe(ids.brandA);
    expect(copy.platforms.map((p) => p.platform).sort()).toEqual(['INSTAGRAM', 'LINKEDIN']);
    expect(copy.media).toHaveLength(2);
  });
});

describe('SocialContent filters & calendar', () => {
  it('marka / platform / durum / tarih aralığı filtreler', async () => {
    const otherBrand = await brandService.createBrand(ctxA(), { name: 'Woontegra' });
    const other = await contentService.createContent(ctxA(), {
      title: 'LinkedIn makale',
      contentText: 'Makale gövdesi',
      contentType: 'ARTICLE',
      socialBrandId: otherBrand.id,
      platforms: ['FACEBOOK'],
      status: 'DRAFT',
      scheduledAt: new Date(2026, 8, 1, 9, 0, 0).toISOString(),
    });

    const byBrand = await contentService.listContents(ctxA(), { brandId: ids.brandA, limit: 50 });
    expect(byBrand.items.every((i) => i.socialBrandId === ids.brandA)).toBe(true);
    expect(byBrand.items.some((i) => i.id === other.id)).toBe(false);

    const byPlatform = await contentService.listContents(ctxA(), {
      platform: 'FACEBOOK',
      limit: 50,
    });
    expect(byPlatform.items.every((i) => i.platforms.some((p) => p.platform === 'FACEBOOK'))).toBe(
      true,
    );
    expect(byPlatform.items.some((i) => i.id === other.id)).toBe(true);

    const byStatus = await contentService.listContents(ctxA(), { status: 'DRAFT', limit: 50 });
    expect(byStatus.items.every((i) => i.status === 'DRAFT')).toBe(true);

    const from = new Date(2026, 7, 1).toISOString();
    const to = new Date(2026, 7, 31, 23, 59, 59).toISOString();
    const byDate = await contentService.listContents(ctxA(), {
      dateFrom: from,
      dateTo: to,
      limit: 50,
    });
    expect(byDate.items.some((i) => i.id === ids.contentA)).toBe(true);
    expect(byDate.items.some((i) => i.id === other.id)).toBe(false);
  });

  it('takvim aralığında yalnız ilgili dönemi getirir', async () => {
    const start = new Date(2026, 7, 1).toISOString();
    const end = new Date(2026, 7, 31, 23, 59, 59).toISOString();
    const cal = await contentService.listCalendar(ctxA(), { startDate: start, endDate: end });
    expect(cal.every((i) => i.scheduledAt && i.scheduledAt >= new Date(start) && i.scheduledAt <= new Date(end))).toBe(
      true,
    );
    expect(cal.some((i) => i.id === ids.contentA)).toBe(true);
    expect(cal.every((i) => i.tenantId === ids.tenantA)).toBe(true);
  });
});

describe('SocialContent area access', () => {
  it('alan üyesine açık, üye olmayana kapalı', async () => {
    const areaContent = await contentService.createContent(ctxA(), {
      title: 'Alan içeriği',
      workspaceAreaId: ids.area,
      platforms: ['INSTAGRAM'],
    });

    const memberList = await contentService.listContents(memberCtx(), { limit: 50 });
    expect(memberList.items.some((i) => i.id === areaContent.id)).toBe(true);
    await expect(contentService.getContent(memberCtx(), areaContent.id)).resolves.toMatchObject({
      id: areaContent.id,
    });

    const outsiderList = await contentService.listContents(outsiderCtx(), { limit: 50 });
    expect(outsiderList.items.some((i) => i.id === areaContent.id)).toBe(false);
    await expect(contentService.getContent(outsiderCtx(), areaContent.id)).rejects.toMatchObject({
      code: 'AREA_NOT_FOUND',
    } satisfies Partial<AppError>);
  });
});
