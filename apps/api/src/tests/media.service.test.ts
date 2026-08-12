import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import { PrismaClient, TenantRole } from '@prisma/client';
import * as mediaService from '../services/media.service';
import * as blockService from '../services/block.service';
import { AppError } from '../lib/errors';
import { env } from '../config/env';

const prisma = new PrismaClient();

const ids = {
  tenantA: '',
  tenantB: '',
  userA: '',
  userB: '',
  pageA: '',
  mediaA: '',
  mediaB: '',
  mediaDoc: '',
};

beforeAll(async () => {
  const passwordHash = await bcrypt.hash('TestPass123!', 10);
  const stamp = Date.now();

  const userA = await prisma.user.create({
    data: {
      email: `media-a-${stamp}@test.local`,
      passwordHash,
      firstName: 'Media',
      lastName: 'A',
    },
  });
  const userB = await prisma.user.create({
    data: {
      email: `media-b-${stamp}@test.local`,
      passwordHash,
      firstName: 'Media',
      lastName: 'B',
    },
  });

  const tenantA = await prisma.tenant.create({
    data: { name: 'Tenant A Media', slug: `tenant-a-media-${stamp}` },
  });
  const tenantB = await prisma.tenant.create({
    data: { name: 'Tenant B Media', slug: `tenant-b-media-${stamp}` },
  });

  await prisma.tenantMember.createMany({
    data: [
      { userId: userA.id, tenantId: tenantA.id, role: TenantRole.OWNER },
      { userId: userB.id, tenantId: tenantB.id, role: TenantRole.OWNER },
    ],
  });

  const pageA = await prisma.page.create({
    data: {
      tenantId: tenantA.id,
      createdById: userA.id,
      title: 'Media Page A',
    },
  });

  const mediaA = await prisma.mediaAsset.create({
    data: {
      tenantId: tenantA.id,
      uploadedById: userA.id,
      originalFileName: 'photo.png',
      fileName: 'photo.png',
      mimeType: 'image/png',
      size: 2048,
      storageProvider: 'vercel-blob',
      storageKey: `tenants/${tenantA.id}/media/2026/08/test-photo.png`,
      url: 'https://example.com/photo.png',
      category: 'IMAGE',
    },
  });

  const mediaDoc = await prisma.mediaAsset.create({
    data: {
      tenantId: tenantA.id,
      uploadedById: userA.id,
      originalFileName: 'brief.pdf',
      fileName: 'brief.pdf',
      mimeType: 'application/pdf',
      size: 4096,
      storageProvider: 'vercel-blob',
      storageKey: `tenants/${tenantA.id}/media/2026/08/test-brief.pdf`,
      url: 'https://example.com/brief.pdf',
      category: 'DOCUMENT',
    },
  });

  const mediaB = await prisma.mediaAsset.create({
    data: {
      tenantId: tenantB.id,
      uploadedById: userB.id,
      originalFileName: 'secret.png',
      fileName: 'secret.png',
      mimeType: 'image/png',
      size: 1024,
      storageProvider: 'vercel-blob',
      storageKey: `tenants/${tenantB.id}/media/2026/08/test-secret.png`,
      url: 'https://example.com/secret.png',
      category: 'IMAGE',
    },
  });

  ids.tenantA = tenantA.id;
  ids.tenantB = tenantB.id;
  ids.userA = userA.id;
  ids.userB = userB.id;
  ids.pageA = pageA.id;
  ids.mediaA = mediaA.id;
  ids.mediaB = mediaB.id;
  ids.mediaDoc = mediaDoc.id;
});

afterAll(async () => {
  await prisma.block.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.mediaAsset.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.page.deleteMany({
    where: { id: { in: [ids.pageA] } },
  });
  await prisma.tenantMember.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.tenant.deleteMany({
    where: { id: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.userA, ids.userB] } },
  });
  await prisma.$disconnect();
});

describe('media isolation & validation', () => {
  it('tenant A başka tenant medyasını listelemez', async () => {
    const result = await mediaService.listMedia(ids.tenantA, {});
    expect(result.items.every((item) => item.tenantId === ids.tenantA)).toBe(true);
    expect(result.items.some((item) => item.id === ids.mediaB)).toBe(false);
  });

  it('tenant A başka tenant medya metadata erişemez', async () => {
    await expect(mediaService.getMedia(ids.tenantA, ids.mediaB)).rejects.toMatchObject({
      statusCode: 404,
      code: 'MEDIA_NOT_FOUND',
    } satisfies Partial<AppError>);
  });

  it('MIME validation reddeder', () => {
    expect(() =>
      mediaService.assertAllowedFile('application/x-msdownload', 'virus.exe', 100),
    ).toThrow(AppError);
  });

  it('uzantı ve MIME uyuşmazlığını reddeder', () => {
    expect(() =>
      mediaService.assertAllowedFile('image/png', 'notes.pdf', 100),
    ).toThrow(AppError);
  });

  it('boyut limitini env üzerinden uygular', () => {
    const over = env.MAX_IMAGE_UPLOAD_MB * 1024 * 1024 + 1;
    expect(() =>
      mediaService.assertAllowedFile('image/png', 'big.png', over),
    ).toThrow(AppError);
  });

  it('usage yalnız kendi tenant verisini sayar', async () => {
    const usageA = await mediaService.getUsage(ids.tenantA);
    const usageB = await mediaService.getUsage(ids.tenantB);
    expect(usageA.assetCount).toBeGreaterThanOrEqual(2);
    expect(usageB.assetCount).toBeGreaterThanOrEqual(1);
    expect(usageA.totalBytes).toBeGreaterThanOrEqual(2048 + 4096);
    expect(usageB.totalBytes).toBe(1024);
    expect(usageA.imageBytes).toBeGreaterThanOrEqual(2048);
    expect(usageA.documentBytes).toBeGreaterThanOrEqual(4096);
  });

  it('finalize tenant path dışını reddeder', async () => {
    await expect(
      mediaService.finalizeMedia(ids.tenantA, ids.userA, {
        url: 'https://example.com/x.png',
        storageKey: `tenants/${ids.tenantB}/media/2026/08/hack.png`,
        originalFileName: 'hack.png',
        mimeType: 'image/png',
        size: 10,
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'INVALID_STORAGE_KEY' });
  });

  it('in-use delete 409 döner', async () => {
    await blockService.createBlock(ids.tenantA, ids.pageA, ids.userA, {
      type: 'IMAGE',
      mediaAssetId: ids.mediaA,
    });

    try {
      await mediaService.deleteMedia(ids.tenantA, ids.mediaA, false);
      throw new Error('expected 409');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const err = error as AppError;
      expect(err.statusCode).toBe(409);
      expect(err.details).toMatchObject({ inUse: true, references: expect.any(Number) });
    }
  });

  it('force delete kullanımdayken siler', async () => {
    await mediaService.deleteMedia(ids.tenantA, ids.mediaA, true);
    await expect(mediaService.getMedia(ids.tenantA, ids.mediaA)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('başka tenant mediaAssetId blocka bağlanamaz', async () => {
    await expect(
      blockService.createBlock(ids.tenantA, ids.pageA, ids.userA, {
        type: 'IMAGE',
        mediaAssetId: ids.mediaB,
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_MEDIA' });
  });

  it('yanlış media category blocka bağlanamaz', async () => {
    await expect(
      blockService.createBlock(ids.tenantA, ids.pageA, ids.userA, {
        type: 'IMAGE',
        mediaAssetId: ids.mediaDoc,
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_MEDIA_CATEGORY' });
  });
});
