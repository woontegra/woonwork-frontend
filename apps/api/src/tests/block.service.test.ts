import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import { PrismaClient, TenantRole } from '@prisma/client';
import * as blockService from '../services/block.service';
import { AppError } from '../lib/errors';
import type { Block } from '@prisma/client';

const prisma = new PrismaClient();

const ids = {
  tenantA: '',
  tenantB: '',
  userA: '',
  userB: '',
  pageA: '',
  pageB: '',
};

beforeAll(async () => {
  const passwordHash = await bcrypt.hash('TestPass123!', 10);

  const userA = await prisma.user.create({
    data: {
      email: `block-a-${Date.now()}@test.local`,
      passwordHash,
      firstName: 'A',
      lastName: 'User',
    },
  });
  const userB = await prisma.user.create({
    data: {
      email: `block-b-${Date.now()}@test.local`,
      passwordHash,
      firstName: 'B',
      lastName: 'User',
    },
  });

  const tenantA = await prisma.tenant.create({
    data: { name: 'Tenant A Blocks', slug: `tenant-a-blocks-${Date.now()}` },
  });
  const tenantB = await prisma.tenant.create({
    data: { name: 'Tenant B Blocks', slug: `tenant-b-blocks-${Date.now()}` },
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
      title: 'Page A',
    },
  });
  const pageB = await prisma.page.create({
    data: {
      tenantId: tenantB.id,
      createdById: userB.id,
      title: 'Page B',
    },
  });

  ids.tenantA = tenantA.id;
  ids.tenantB = tenantB.id;
  ids.userA = userA.id;
  ids.userB = userB.id;
  ids.pageA = pageA.id;
  ids.pageB = pageB.id;
});

afterAll(async () => {
  await prisma.block.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.page.deleteMany({
    where: { id: { in: [ids.pageA, ids.pageB] } },
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

describe('block service tenant isolation', () => {
  it('tenant A başka tenant pageId ile block oluşturamaz', async () => {
    await expect(
      blockService.createBlock(ids.tenantA, ids.pageB, ids.userA, {
        type: 'PARAGRAPH',
        content: { text: 'kaçak' },
      }),
    ).rejects.toMatchObject({ code: 'PAGE_NOT_FOUND' } satisfies Partial<AppError>);
  });

  it('tenant A başka tenant blockId ile güncelleyemez', async () => {
    const foreign = await blockService.createBlock(ids.tenantB, ids.pageB, ids.userB, {
      type: 'PARAGRAPH',
      content: { text: 'B bloğu' },
    });

    await expect(
      blockService.updateBlock(ids.tenantA, ids.pageA, foreign.id, ids.userA, {
        content: { text: 'hack' },
      }),
    ).rejects.toMatchObject({ code: 'BLOCK_NOT_FOUND' });
  });

  it('block create / update / delete / reorder çalışır', async () => {
    const first = await blockService.createBlock(ids.tenantA, ids.pageA, ids.userA, {
      type: 'PARAGRAPH',
      content: { text: 'Bir' },
    });
    expect(first.position).toBeGreaterThan(0);

    const second = await blockService.createBlock(ids.tenantA, ids.pageA, ids.userA, {
      type: 'HEADING_1',
      content: { text: 'İki' },
      afterBlockId: first.id,
    });
    expect(second.position).toBeGreaterThan(first.position);

    const updated = await blockService.updateBlock(ids.tenantA, ids.pageA, first.id, ids.userA, {
      content: { text: 'Bir güncellendi' },
    });
    expect((updated.content as { text: string }).text).toBe('Bir güncellendi');

    const reordered = await blockService.reorderBlocks(ids.tenantA, ids.pageA, ids.userA, {
      orderedIds: [second.id, first.id],
    });
    expect(reordered.map((b: Block) => b.id)).toEqual([second.id, first.id]);

    await blockService.deleteBlock(ids.tenantA, ids.pageA, second.id, ids.userA);
    const remaining = await blockService.listBlocks(ids.tenantA, ids.pageA, ids.userA);
    expect(remaining.some((b: Block) => b.id === second.id)).toBe(false);
    expect(remaining.length).toBeGreaterThan(0);
  });

  it('yanlış tenant parentBlockId kullanılamaz', async () => {
    const foreign = await blockService.createBlock(ids.tenantB, ids.pageB, ids.userB, {
      type: 'PARAGRAPH',
      content: { text: 'parent adayı' },
    });

    await expect(
      blockService.createBlock(ids.tenantA, ids.pageA, ids.userA, {
        type: 'PARAGRAPH',
        content: { text: 'child' },
        parentBlockId: foreign.id,
      }),
    ).rejects.toMatchObject({ code: 'BLOCK_NOT_FOUND' });
  });
});
