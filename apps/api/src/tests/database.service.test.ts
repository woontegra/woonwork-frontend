import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import { PrismaClient, TenantRole } from '@prisma/client';
import * as databaseService from '../services/database.service';
import * as blockService from '../services/block.service';
import { AppError } from '../lib/errors';
import { validateCellValue } from '../services/database-cell.util';

const prisma = new PrismaClient();

const ids = {
  tenantA: '',
  tenantB: '',
  userA: '',
  userB: '',
  pageA: '',
  dbA: '',
  dbB: '',
  titlePropA: '',
  numberPropA: '',
  selectPropA: '',
  personPropA: '',
  optionId: '',
  rowA: '',
};

beforeAll(async () => {
  const passwordHash = await bcrypt.hash('TestPass123!', 10);
  const stamp = Date.now();

  const userA = await prisma.user.create({
    data: {
      email: `db-a-${stamp}@test.local`,
      passwordHash,
      firstName: 'Db',
      lastName: 'A',
    },
  });
  const userB = await prisma.user.create({
    data: {
      email: `db-b-${stamp}@test.local`,
      passwordHash,
      firstName: 'Db',
      lastName: 'B',
    },
  });

  const tenantA = await prisma.tenant.create({
    data: { name: 'Tenant A DB', slug: `tenant-a-db-${stamp}` },
  });
  const tenantB = await prisma.tenant.create({
    data: { name: 'Tenant B DB', slug: `tenant-b-db-${stamp}` },
  });

  await prisma.tenantMember.createMany({
    data: [
      { userId: userA.id, tenantId: tenantA.id, role: TenantRole.OWNER },
      { userId: userB.id, tenantId: tenantB.id, role: TenantRole.OWNER },
    ],
  });

  const pageA = await prisma.page.create({
    data: { tenantId: tenantA.id, createdById: userA.id, title: 'DB Page' },
  });

  const ctxA = { tenantId: tenantA.id, userId: userA.id, tenantRole: TenantRole.OWNER as const };
  const ctxB = { tenantId: tenantB.id, userId: userB.id, tenantRole: TenantRole.OWNER as const };

  const dbA = await databaseService.createDatabase(ctxA, {
    name: 'Tablo A',
  });
  const dbB = await databaseService.createDatabase(ctxB, {
    name: 'Tablo B',
  });

  const titlePropA = dbA.properties.find((p) => p.type === 'TITLE')!;
  const numberPropA = await databaseService.createProperty(tenantA.id, dbA.id, {
    name: 'Sayı',
    type: 'NUMBER',
  });
  ids.optionId = 'opt-1';
  const selectPropA = await databaseService.createProperty(tenantA.id, dbA.id, {
    name: 'Seçim',
    type: 'SELECT',
    config: {
      options: [{ id: ids.optionId, name: 'Bekliyor', color: 'gray' }],
    },
  });
  const personPropA = await databaseService.createProperty(tenantA.id, dbA.id, {
    name: 'Kişi',
    type: 'PERSON',
  });

  const rowA = await databaseService.createRow(tenantA.id, dbA.id, userA.id, {
    cells: [
      { propertyId: titlePropA.id, value: 'Alpha' },
      { propertyId: numberPropA.id, value: 10 },
      { propertyId: selectPropA.id, value: ids.optionId },
    ],
  });
  await databaseService.createRow(tenantA.id, dbA.id, userA.id, {
    cells: [
      { propertyId: titlePropA.id, value: 'Beta' },
      { propertyId: numberPropA.id, value: 5 },
    ],
  });

  ids.tenantA = tenantA.id;
  ids.tenantB = tenantB.id;
  ids.userA = userA.id;
  ids.userB = userB.id;
  ids.pageA = pageA.id;
  ids.dbA = dbA.id;
  ids.dbB = dbB.id;
  ids.titlePropA = titlePropA.id;
  ids.numberPropA = numberPropA.id;
  ids.selectPropA = selectPropA.id;
  ids.personPropA = personPropA.id;
  ids.rowA = rowA.id;
});

afterAll(async () => {
  await prisma.block.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.database.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.page.deleteMany({ where: { id: ids.pageA } });
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

describe('database tenant isolation', () => {
  it('tenant A başka tenant database görmez', async () => {
    const list = await databaseService.listDatabases({
      tenantId: ids.tenantA,
      userId: ids.userA,
      tenantRole: TenantRole.OWNER,
    });
    expect(list.every((d) => d.tenantId === ids.tenantA)).toBe(true);
    expect(list.some((d) => d.id === ids.dbB)).toBe(false);
  });

  it('tenant A başka tenant database get edemez', async () => {
    await expect(
      databaseService.getDatabase(
        { tenantId: ids.tenantA, userId: ids.userA, tenantRole: TenantRole.OWNER },
        ids.dbB,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('tenant A başka tenant property güncelleyemez', async () => {
    const props = await prisma.databaseProperty.findMany({ where: { databaseId: ids.dbB } });
    await expect(
      databaseService.updateProperty(ids.tenantA, ids.dbB, props[0].id, { name: 'Hack' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('tenant A başka tenant row silemez', async () => {
    const row = await prisma.databaseRow.findFirst({ where: { databaseId: ids.dbB } });
    if (!row) {
      const created = await databaseService.createRow(ids.tenantB, ids.dbB, ids.userB, {});
      await expect(
        databaseService.deleteRow(ids.tenantA, ids.dbB, created.id),
      ).rejects.toBeInstanceOf(AppError);
      return;
    }
    await expect(
      databaseService.deleteRow(ids.tenantA, ids.dbB, row.id),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('tenant A başka tenant cell güncelleyemez', async () => {
    await expect(
      databaseService.updateCell(ids.tenantA, ids.dbB, ids.rowA, ids.titlePropA, {
        value: 'x',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('database title rules', () => {
  it('TITLE silinemez', async () => {
    await expect(
      databaseService.deleteProperty(ids.tenantA, ids.dbA, ids.titlePropA),
    ).rejects.toMatchObject({ code: 'TITLE_REQUIRED' });
  });

  it('TITLE tipi değişemez', async () => {
    await expect(
      databaseService.updateProperty(ids.tenantA, ids.dbA, ids.titlePropA, {
        type: 'TEXT',
      }),
    ).rejects.toMatchObject({ code: 'TITLE_IMMUTABLE' });
  });
});

describe('cell validation', () => {
  it('NUMBER validation', async () => {
    await expect(
      validateCellValue(ids.tenantA, 'NUMBER', {}, 'abc'),
    ).rejects.toMatchObject({ code: 'INVALID_CELL' });
    await expect(validateCellValue(ids.tenantA, 'NUMBER', {}, 12)).resolves.toBe(12);
  });

  it('SELECT option validation', async () => {
    const prop = await prisma.databaseProperty.findUniqueOrThrow({
      where: { id: ids.selectPropA },
    });
    await expect(
      validateCellValue(ids.tenantA, 'SELECT', prop.config, 'missing'),
    ).rejects.toMatchObject({ code: 'INVALID_CELL' });
  });

  it('PERSON tenant validation', async () => {
    await expect(
      validateCellValue(ids.tenantA, 'PERSON', {}, ids.userB),
    ).rejects.toMatchObject({ code: 'INVALID_CELL' });
    await expect(
      validateCellValue(ids.tenantA, 'PERSON', {}, ids.userA),
    ).resolves.toBe(ids.userA);
  });
});

describe('filter sort search pagination', () => {
  it('search TITLE', async () => {
    const result = await databaseService.listRows(ids.tenantA, ids.dbA, {
      search: 'Alp',
      page: 1,
      limit: 50,
    });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe(ids.rowA);
  });

  it('filter number >=', async () => {
    const filters = JSON.stringify([
      { propertyId: ids.numberPropA, operator: 'gte', value: 10 },
    ]);
    const result = await databaseService.listRows(ids.tenantA, ids.dbA, {
      filters,
      page: 1,
      limit: 50,
    });
    expect(result.total).toBe(1);
  });

  it('sort number asc', async () => {
    const sorts = JSON.stringify([
      { propertyId: ids.numberPropA, direction: 'asc' },
    ]);
    const result = await databaseService.listRows(ids.tenantA, ids.dbA, {
      sorts,
      page: 1,
      limit: 50,
    });
    const values = result.items.map(
      (row) => row.cells.find((c) => c.propertyId === ids.numberPropA)?.value,
    );
    expect(values[0]).toBe(5);
    expect(values[1]).toBe(10);
  });

  it('pagination', async () => {
    const page1 = await databaseService.listRows(ids.tenantA, ids.dbA, {
      page: 1,
      limit: 1,
    });
    expect(page1.items).toHaveLength(1);
    expect(page1.total).toBeGreaterThanOrEqual(2);
  });

  it('başka tenant database blocka bağlanamaz', async () => {
    await expect(
      blockService.createBlock(ids.tenantA, ids.pageA, ids.userA, {
        type: 'DATABASE',
        databaseId: ids.dbB,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_DATABASE' });
  });
});

describe('database views kanban calendar', () => {
  it('KANBAN view create with SELECT group', async () => {
    const view = await databaseService.createView(ids.tenantA, ids.dbA, {
      name: 'İçerik Akışı',
      type: 'KANBAN',
      config: {
        filters: [],
        sorts: [],
        groupByPropertyId: ids.selectPropA,
      },
    });
    expect(view.type).toBe('KANBAN');
    expect((view.config as { groupByPropertyId?: string }).groupByPropertyId).toBe(
      ids.selectPropA,
    );
  });

  it('invalid group property rejected', async () => {
    await expect(
      databaseService.createView(ids.tenantA, ids.dbA, {
        name: 'Bad Kanban',
        type: 'KANBAN',
        config: {
          filters: [],
          sorts: [],
          groupByPropertyId: ids.numberPropA,
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_GROUP_PROPERTY' });
  });

  it('cross tenant property cannot group kanban', async () => {
    const foreign = await prisma.databaseProperty.findFirst({
      where: { databaseId: ids.dbB, type: 'TITLE' },
    });
    await expect(
      databaseService.createView(ids.tenantA, ids.dbA, {
        name: 'Hack Kanban',
        type: 'KANBAN',
        config: {
          filters: [],
          sorts: [],
          groupByPropertyId: foreign!.id,
        },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('CALENDAR view create + date range query', async () => {
    const dateProp = await databaseService.createProperty(ids.tenantA, ids.dbA, {
      name: 'Tarih',
      type: 'DATE',
    });
    const view = await databaseService.createView(ids.tenantA, ids.dbA, {
      name: 'Yayın Takvimi',
      type: 'CALENDAR',
      config: {
        filters: [],
        sorts: [],
        datePropertyId: dateProp.id,
      },
    });
    expect(view.type).toBe('CALENDAR');

    await databaseService.updateCell(ids.tenantA, ids.dbA, ids.rowA, dateProp.id, {
      value: '2026-08-15T09:00:00.000Z',
    });

    const ranged = await databaseService.listRows(ids.tenantA, ids.dbA, {
      viewId: view.id,
      datePropertyId: dateProp.id,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      page: 1,
      limit: 50,
    });
    expect(ranged.total).toBeGreaterThanOrEqual(1);
    expect(ranged.items.some((r) => r.id === ids.rowA)).toBe(true);

    const undated = await databaseService.listRows(ids.tenantA, ids.dbA, {
      datePropertyId: dateProp.id,
      undatedOnly: 'true',
      page: 1,
      limit: 50,
    });
    expect(undated.items.every((r) => r.id !== ids.rowA)).toBe(true);
  });

  it('invalid date property rejected', async () => {
    await expect(
      databaseService.createView(ids.tenantA, ids.dbA, {
        name: 'Bad Cal',
        type: 'CALENDAR',
        config: {
          filters: [],
          sorts: [],
          datePropertyId: ids.numberPropA,
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_DATE_PROPERTY' });
  });

  it('Kanban drag cell update + null group', async () => {
    await databaseService.updateCell(ids.tenantA, ids.dbA, ids.rowA, ids.selectPropA, {
      value: ids.optionId,
    });
    const cleared = await databaseService.updateCell(
      ids.tenantA,
      ids.dbA,
      ids.rowA,
      ids.selectPropA,
      { value: null },
    );
    expect(cleared.value).toBeNull();
  });

  it('Calendar drag date update preserves time-ish ISO', async () => {
    const dateProp = await prisma.databaseProperty.findFirst({
      where: { databaseId: ids.dbA, type: 'DATE' },
    });
    expect(dateProp).toBeTruthy();
    const updated = await databaseService.updateCell(
      ids.tenantA,
      ids.dbA,
      ids.rowA,
      dateProp!.id,
      { value: '2026-08-20T14:30:00.000Z' },
    );
    expect(updated.value).toBe('2026-08-20T14:30:00.000Z');
  });

  it('cross tenant view update rejected', async () => {
    const viewB = await prisma.databaseView.findFirst({ where: { databaseId: ids.dbB } });
    await expect(
      databaseService.updateView(ids.tenantA, ids.dbB, viewB!.id, { name: 'Hack' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('last view cannot be deleted', async () => {
    const db = await databaseService.createDatabase(
      { tenantId: ids.tenantA, userId: ids.userA, tenantRole: TenantRole.OWNER },
      { name: 'Tek View' },
    );
    const only = db.views[0];
    await expect(
      databaseService.deleteView(ids.tenantA, db.id, only.id),
    ).rejects.toMatchObject({ code: 'LAST_VIEW_REQUIRED' });
  });

  it('filters per view', async () => {
    const view = await databaseService.createView(ids.tenantA, ids.dbA, {
      name: 'Filtreli',
      type: 'TABLE',
      config: {
        filters: [{ propertyId: ids.numberPropA, operator: 'gte', value: 10 }],
        sorts: [],
      },
    });
    const result = await databaseService.listRows(ids.tenantA, ids.dbA, {
      viewId: view.id,
      page: 1,
      limit: 50,
    });
    expect(result.total).toBe(1);
  });

  it('moveRow repositions within tenant', async () => {
    const rows = await prisma.databaseRow.findMany({
      where: { databaseId: ids.dbA },
      orderBy: { position: 'asc' },
    });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const moved = await databaseService.moveRow(ids.tenantA, ids.dbA, {
      rowId: rows[0].id,
      afterRowId: rows[1].id,
    });
    expect(moved.position).toBeGreaterThan(rows[1].position);
  });
});
