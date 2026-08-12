import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import { PrismaClient, TenantRole } from '@prisma/client';
import { AppError } from '../lib/errors';
import * as brandService from '../services/socialBrand.service';
import * as contentService from '../services/socialContent.service';
import * as hashtagService from '../services/socialHashtag.service';
import * as publishService from '../services/socialPublish.service';

const prisma = new PrismaClient();

const ids = {
  tenantA: '',
  tenantB: '',
  userA: '',
  userB: '',
  brandA: '',
  brandA2: '',
  brandB: '',
};

function ctxA() {
  return { tenantId: ids.tenantA, userId: ids.userA, tenantRole: TenantRole.OWNER };
}
function ctxB() {
  return { tenantId: ids.tenantB, userId: ids.userB, tenantRole: TenantRole.OWNER };
}

beforeAll(async () => {
  const passwordHash = await bcrypt.hash('TestPass123!', 10);
  const stamp = Date.now();

  const userA = await prisma.user.create({
    data: { email: `ht-a-${stamp}@test.local`, passwordHash, firstName: 'Ht', lastName: 'A' },
  });
  const userB = await prisma.user.create({
    data: { email: `ht-b-${stamp}@test.local`, passwordHash, firstName: 'Ht', lastName: 'B' },
  });
  const tenantA = await prisma.tenant.create({
    data: { name: 'Tenant A Hashtag', slug: `tenant-a-ht-${stamp}` },
  });
  const tenantB = await prisma.tenant.create({
    data: { name: 'Tenant B Hashtag', slug: `tenant-b-ht-${stamp}` },
  });
  await prisma.tenantMember.createMany({
    data: [
      { userId: userA.id, tenantId: tenantA.id, role: TenantRole.OWNER },
      { userId: userB.id, tenantId: tenantB.id, role: TenantRole.OWNER },
    ],
  });

  ids.tenantA = tenantA.id;
  ids.tenantB = tenantB.id;
  ids.userA = userA.id;
  ids.userB = userB.id;

  const brandA = await brandService.createBrand(ctxA(), { name: 'Bilirkişi Hesap' });
  const brandA2 = await brandService.createBrand(ctxA(), { name: 'İkinci Marka' });
  const brandB = await brandService.createBrand(ctxB(), { name: 'Yabancı Marka' });
  ids.brandA = brandA.id;
  ids.brandA2 = brandA2.id;
  ids.brandB = brandB.id;
});

afterAll(async () => {
  await prisma.socialHashtag.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.socialContent.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.socialBrand.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.tenantMember.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.userA, ids.userB] } } });
  await prisma.$disconnect();
});

describe('SocialHashtag security', () => {
  it('tenant isolation: diğer tenant hashtag göremez', async () => {
    const created = await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA,
      tag: '#tenant_a_only',
    });
    await expect(hashtagService.getHashtag(ctxB(), created.id)).rejects.toMatchObject({
      code: 'HASHTAG_NOT_FOUND',
    } satisfies Partial<AppError>);
    const listB = await hashtagService.listHashtags(ctxB(), { brandId: ids.brandB });
    expect(listB.items.some((item) => item.id === created.id)).toBe(false);
  });

  it('cross-tenant hashtag bağlanamaz', async () => {
    await expect(
      hashtagService.createHashtag(ctxA(), { socialBrandId: ids.brandB, tag: '#kacirma' }),
    ).rejects.toMatchObject({ code: 'INVALID_BRAND' } satisfies Partial<AppError>);
  });

  it('brand isolation: aynı tenantta diğer markanın listesine karışmaz', async () => {
    const a = await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA,
      tag: '#marka_a_ozel',
    });
    const b = await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA2,
      tag: '#marka_b_ozel',
    });
    const listA = await hashtagService.listHashtags(ctxA(), { brandId: ids.brandA, limit: 200 });
    expect(listA.items.some((item) => item.id === a.id)).toBe(true);
    expect(listA.items.some((item) => item.id === b.id)).toBe(false);
  });
});

describe('SocialHashtag normalize + duplicate', () => {
  it('normalize ederek kaydeder ve duplicate engeller', async () => {
    const created = await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA,
      tag: 'BilirkisiHesap',
    });
    expect(created.tag).toBe('#bilirkisihesap');
    await expect(
      hashtagService.createHashtag(ctxA(), { socialBrandId: ids.brandA, tag: '#bilirkisihesap' }),
    ).rejects.toMatchObject({ code: 'HASHTAG_DUPLICATE' } satisfies Partial<AppError>);
    await expect(
      hashtagService.createHashtag(ctxA(), { socialBrandId: ids.brandA, tag: '##bilirkisihesap' }),
    ).rejects.toMatchObject({ code: 'HASHTAG_DUPLICATE' } satisfies Partial<AppError>);
  });

  it('aynı tag farklı markada oluşturulabilir', async () => {
    const row = await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA2,
      tag: '#bilirkisihesap',
    });
    expect(row.socialBrandId).toBe(ids.brandA2);
  });
});

describe('SocialHashtag status lists', () => {
  it('ACTIVE / BLOCKED / DISABLED ayrı listelenir', async () => {
    const active = await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA,
      tag: '#aktif_tag',
      status: 'ACTIVE',
    });
    const blocked = await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA,
      tag: '#yasak_tag',
      status: 'BLOCKED',
    });
    const disabled = await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA,
      tag: '#pasif_tag',
      status: 'DISABLED',
    });

    const activeList = await hashtagService.listHashtags(ctxA(), {
      brandId: ids.brandA,
      status: 'ACTIVE',
      limit: 200,
    });
    const blockedList = await hashtagService.listHashtags(ctxA(), {
      brandId: ids.brandA,
      status: 'BLOCKED',
      limit: 200,
    });
    const disabledList = await hashtagService.listHashtags(ctxA(), {
      brandId: ids.brandA,
      status: 'DISABLED',
      limit: 200,
    });

    expect(activeList.items.some((item) => item.id === active.id)).toBe(true);
    expect(activeList.items.some((item) => item.id === blocked.id)).toBe(false);
    expect(blockedList.items.some((item) => item.id === blocked.id)).toBe(true);
    expect(disabledList.items.some((item) => item.id === disabled.id)).toBe(true);
    expect(disabledList.items.some((item) => item.id === active.id)).toBe(false);
  });
});

describe('SocialHashtag bulk add', () => {
  it('eklenen / zaten var / geçersiz sayılarını döner', async () => {
    await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA,
      tag: '#bulk_var',
    });
    const result = await hashtagService.bulkCreateHashtags(ctxA(), {
      socialBrandId: ids.brandA,
      text: '#bulk_yeni\n#bulk_var\n#foo-bar\n#bulk_ikinci',
    });
    expect(result.created).toBe(2);
    expect(result.duplicate).toBe(1);
    expect(result.invalid).toBe(1);
    expect(result.items.map((item) => item.tag).sort()).toEqual(['#bulk_ikinci', '#bulk_yeni']);
    expect(result.duplicates).toEqual(['#bulk_var']);
    expect(result.invalidTags).toEqual(['#foo-bar']);
  });

  it('boşluk ve virgülle yapıştırılan listeyi ayırır', async () => {
    const spaced = await hashtagService.bulkCreateHashtags(ctxA(), {
      socialBrandId: ids.brandA,
      text: '#space_a #space_b',
      category: 'Genel',
      status: 'ACTIVE',
    });
    expect(spaced.created).toBe(2);
    const comma = await hashtagService.bulkCreateHashtags(ctxA(), {
      socialBrandId: ids.brandA,
      text: '#comma_a, #comma_b, #space_a',
    });
    expect(comma.created).toBe(2);
    expect(comma.duplicate).toBe(1);
    expect(comma.duplicates).toEqual(['#space_a']);
  });

  it('hashtags dizisi ile de ekler', async () => {
    const result = await hashtagService.bulkCreateHashtags(ctxA(), {
      socialBrandId: ids.brandA,
      hashtags: ['#dizi_a', '##dizi_a', '#işhukuku_bulk'],
    });
    expect(result.created).toBe(2);
    expect(result.duplicate).toBe(1);
  });

  it('cross-tenant brand ile bulk reddedilir', async () => {
    await expect(
      hashtagService.bulkCreateHashtags(ctxA(), {
        socialBrandId: ids.brandB,
        text: '#kacirma_bulk',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_BRAND' } satisfies Partial<AppError>);
  });

  it('tekli Yeni Hashtag oluşturma bozulmaz', async () => {
    const row = await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA,
      tag: '#tekli_regression',
    });
    expect(row.tag).toBe('#tekli_regression');
  });
});

describe('blocked publish validation + usage', () => {
  it('BLOCKED hashtag publish öncesi SOCIAL_BLOCKED_HASHTAGS döner', async () => {
    await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA,
      tag: '#yasakpublish',
      status: 'BLOCKED',
    });
    const content = await contentService.createContent(ctxA(), {
      title: 'Blocked publish',
      socialBrandId: ids.brandA,
      contentText: 'Metin #yasakpublish #serbest',
      platforms: ['LINKEDIN'],
    });
    await contentService.updateContent(ctxA(), content.id, {
      edited: true,
      approved: true,
      readyToPublish: true,
    });

    await expect(publishService.publishContent(ctxA(), content.id)).rejects.toMatchObject({
      code: 'SOCIAL_BLOCKED_HASHTAGS',
      details: { blocked: ['#yasakpublish'] },
    } satisfies Partial<AppError>);
  });

  it('taslak kaydı usageCount artırmaz', async () => {
    const tag = await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA,
      tag: '#taslak_kullanim',
    });
    const content = await contentService.createContent(ctxA(), {
      title: 'Draft usage',
      socialBrandId: ids.brandA,
      contentText: 'Taslak #taslak_kullanim',
      platforms: ['LINKEDIN'],
    });
    await contentService.updateContent(ctxA(), content.id, {
      contentText: 'Güncel taslak #taslak_kullanim',
    });
    const after = await hashtagService.getHashtag(ctxA(), tag.id);
    expect(after.usageCount).toBe(0);
    expect(after.lastUsedAt).toBeNull();
  });

  it('başarılı ilk yayın usageCount ve lastUsedAt günceller, tekrar yayın artırmaz', async () => {
    const tag = await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA,
      tag: '#yayin_kullanim',
    });
    const usedAt = new Date('2026-08-10T10:00:00.000Z');
    const updated = await hashtagService.applyHashtagUsageOnFirstPublish({
      tenantId: ids.tenantA,
      wasPublished: false,
      socialBrandId: ids.brandA,
      contentText: 'Paylaşım #yayin_kullanim #yokboylebirsey',
      usedAt,
    });
    expect(updated).toBe(1);
    const after = await hashtagService.getHashtag(ctxA(), tag.id);
    expect(after.usageCount).toBe(1);
    expect(after.lastUsedAt?.toISOString()).toBe(usedAt.toISOString());

    await hashtagService.applyHashtagUsageOnFirstPublish({
      tenantId: ids.tenantA,
      wasPublished: true,
      socialBrandId: ids.brandA,
      contentText: 'Paylaşım #yayin_kullanim',
      usedAt: new Date('2026-08-11T10:00:00.000Z'),
    });
    const again = await hashtagService.getHashtag(ctxA(), tag.id);
    expect(again.usageCount).toBe(1);
    expect(again.lastUsedAt?.toISOString()).toBe(usedAt.toISOString());
  });

  it('silinen hashtag içerik metnine dokunmaz', async () => {
    const tag = await hashtagService.createHashtag(ctxA(), {
      socialBrandId: ids.brandA,
      tag: '#silinecek',
    });
    const content = await contentService.createContent(ctxA(), {
      title: 'Keep text',
      socialBrandId: ids.brandA,
      contentText: 'Metin #silinecek kalsın',
    });
    await hashtagService.deleteHashtag(ctxA(), tag.id);
    const kept = await contentService.getContent(ctxA(), content.id);
    expect(kept.contentText).toBe('Metin #silinecek kalsın');
  });
});
