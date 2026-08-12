import {
  createDatabaseSchema,
  createPropertySchema,
  createRowSchema,
  createViewSchema,
  databaseFilterSchema,
  databaseSortSchema,
  databaseViewConfigSchema,
  defaultStatusOptions,
  listRowsQuerySchema,
  moveRowSchema,
  reorderPropertiesSchema,
  reorderRowsSchema,
  updateCellSchema,
  updateDatabaseSchema,
  updatePropertySchema,
  updateViewSchema,
  type CreateDatabaseInput,
  type CreatePropertyInput,
  type CreateRowInput,
  type CreateViewInput,
  type DatabaseFilter,
  type DatabaseSort,
  type DatabaseViewConfig,
  type MoveRowInput,
  type ReorderPropertiesInput,
  type ReorderRowsInput,
  type UpdateCellInput,
  type UpdateDatabaseInput,
  type UpdatePropertyInput,
  type UpdateViewInput,
} from '@woonwork/shared';
import type { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import {
  applyFiltersAndSorts,
  normalizePropertyConfig,
  validateCellValue,
} from './database-cell.util';
import {
  accessibleWhere,
  assertAreaAssignable,
  assertCanEdit,
  assertCanView,
  touchRecent,
  type AccessContext,
} from './contentAccess.service';
import { moveContentSchema } from '@woonwork/shared';

const POSITION_STEP = 1000;

const databaseDetailInclude = {
  properties: { orderBy: { position: 'asc' as const } },
  views: { orderBy: { createdAt: 'asc' as const } },
  _count: { select: { rows: true } },
  workspaceArea: { select: { id: true, name: true, icon: true } },
} satisfies Prisma.DatabaseInclude;

async function assertDatabase(tenantId: string, databaseId: string) {
  const db = await prisma.database.findFirst({
    where: { id: databaseId, tenantId },
    include: databaseDetailInclude,
  });
  if (!db) throw new AppError(404, 'DATABASE_NOT_FOUND', 'Akıllı tablo bulunamadı');
  return db;
}

async function assertProperty(tenantId: string, databaseId: string, propertyId: string) {
  const property = await prisma.databaseProperty.findFirst({
    where: { id: propertyId, tenantId, databaseId },
  });
  if (!property) throw new AppError(404, 'PROPERTY_NOT_FOUND', 'Alan bulunamadı');
  return property;
}

async function assertRow(tenantId: string, databaseId: string, rowId: string) {
  const row = await prisma.databaseRow.findFirst({
    where: { id: rowId, tenantId, databaseId },
    include: { cells: true },
  });
  if (!row) throw new AppError(404, 'ROW_NOT_FOUND', 'Kayıt bulunamadı');
  return row;
}

async function assertView(tenantId: string, databaseId: string, viewId: string) {
  const view = await prisma.databaseView.findFirst({
    where: { id: viewId, tenantId, databaseId },
  });
  if (!view) throw new AppError(404, 'VIEW_NOT_FOUND', 'Görünüm bulunamadı');
  return view;
}

function cellRaw(
  cells: Array<{ propertyId: string; value: unknown }>,
  propertyId: string,
): unknown {
  return cells.find((c) => c.propertyId === propertyId)?.value ?? null;
}

function isEmptyCell(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

function parseDateBound(raw: string | undefined, endOfDay: boolean): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(400, 'INVALID_DATE_RANGE', 'Tarih aralığı geçersiz');
  }
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

async function resolveViewConfig(
  tenantId: string,
  databaseId: string,
  type: 'TABLE' | 'KANBAN' | 'CALENDAR',
  config: DatabaseViewConfig | undefined,
  properties: Array<{ id: string; type: string }>,
): Promise<DatabaseViewConfig> {
  const base: DatabaseViewConfig = {
    filters: config?.filters ?? [],
    sorts: config?.sorts ?? [],
    columnWidths: config?.columnWidths,
    columnOrder: config?.columnOrder,
    hideEmptyGroups: config?.hideEmptyGroups ?? false,
    cardPropertyIds: config?.cardPropertyIds,
    groupByPropertyId: config?.groupByPropertyId,
    datePropertyId: config?.datePropertyId,
  };

  if (type === 'KANBAN') {
    let groupId = base.groupByPropertyId;
    if (!groupId) {
      const status = properties.find((p) => p.type === 'STATUS');
      const select = properties.find((p) => p.type === 'SELECT');
      groupId = status?.id ?? select?.id;
    }
    if (!groupId) {
      throw new AppError(
        400,
        'KANBAN_GROUP_REQUIRED',
        'Kanban için STATUS veya SELECT alanı gerekli',
      );
    }
    const prop = properties.find((p) => p.id === groupId);
    if (!prop || prop.id !== groupId) {
      // re-assert tenant ownership via lookup
      await assertProperty(tenantId, databaseId, groupId);
    }
    const owned = await assertProperty(tenantId, databaseId, groupId);
    if (owned.type !== 'STATUS' && owned.type !== 'SELECT') {
      throw new AppError(
        400,
        'INVALID_GROUP_PROPERTY',
        'Kanban yalnızca STATUS veya SELECT ile gruplanabilir',
      );
    }
    base.groupByPropertyId = groupId;
    if (base.cardPropertyIds?.length) {
      for (const pid of base.cardPropertyIds) {
        await assertProperty(tenantId, databaseId, pid);
      }
    }
  }

  if (type === 'CALENDAR') {
    let dateId = base.datePropertyId;
    if (!dateId) {
      dateId = properties.find((p) => p.type === 'DATE')?.id;
    }
    if (!dateId) {
      throw new AppError(
        400,
        'CALENDAR_DATE_REQUIRED',
        'Takvim görünümü için bir Tarih alanı gerekiyor',
      );
    }
    const owned = await assertProperty(tenantId, databaseId, dateId);
    if (owned.type !== 'DATE') {
      throw new AppError(400, 'INVALID_DATE_PROPERTY', 'Takvim yalnızca DATE alanı kullanabilir');
    }
    base.datePropertyId = dateId;
  }

  return databaseViewConfigSchema.parse(base);
}

async function nextPosition(
  tenantId: string,
  databaseId: string,
  kind: 'property' | 'row',
  afterId?: string | null,
) {
  if (kind === 'property') {
    if (afterId) {
      const after = await assertProperty(tenantId, databaseId, afterId);
      const next = await prisma.databaseProperty.findFirst({
        where: { tenantId, databaseId, position: { gt: after.position } },
        orderBy: { position: 'asc' },
      });
      if (!next) return after.position + POSITION_STEP;
      return (after.position + next.position) / 2;
    }
    const last = await prisma.databaseProperty.findFirst({
      where: { tenantId, databaseId },
      orderBy: { position: 'desc' },
    });
    return (last?.position ?? 0) + POSITION_STEP;
  }

  if (afterId) {
    const after = await assertRow(tenantId, databaseId, afterId);
    const next = await prisma.databaseRow.findFirst({
      where: { tenantId, databaseId, position: { gt: after.position } },
      orderBy: { position: 'asc' },
    });
    if (!next) return after.position + POSITION_STEP;
    return (after.position + next.position) / 2;
  }
  const last = await prisma.databaseRow.findFirst({
    where: { tenantId, databaseId },
    orderBy: { position: 'desc' },
  });
  return (last?.position ?? 0) + POSITION_STEP;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function listDatabases(ctx: AccessContext) {
  const access = await accessibleWhere(ctx, 'DATABASE');
  return prisma.database.findMany({
    where: access as Prisma.DatabaseWhereInput,
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { rows: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      workspaceArea: { select: { id: true, name: true, icon: true } },
    },
  });
}

export async function getDatabase(ctx: AccessContext, databaseId: string) {
  await assertCanView(ctx, 'DATABASE', databaseId);
  void touchRecent(ctx, 'DATABASE', databaseId);
  return assertDatabase(ctx.tenantId, databaseId);
}

export async function createDatabase(ctx: AccessContext, raw: CreateDatabaseInput) {
  const input = createDatabaseSchema.parse(raw);
  const workspaceAreaId = await assertAreaAssignable(ctx, input.workspaceAreaId);

  if (input.pageId) {
    await assertCanView(ctx, 'PAGE', input.pageId);
  }

  return prisma.$transaction(async (tx) => {
    const database = await tx.database.create({
      data: {
        tenantId: ctx.tenantId,
        createdById: ctx.userId,
        name: input.name,
        description: input.description ?? null,
        pageId: input.pageId ?? null,
        workspaceAreaId: workspaceAreaId ?? null,
      },
    });

    await tx.databaseProperty.create({
      data: {
        tenantId: ctx.tenantId,
        databaseId: database.id,
        name: 'Ad',
        type: 'TITLE',
        position: POSITION_STEP,
        config: toJson({}),
      },
    });

    await tx.databaseView.create({
      data: {
        tenantId: ctx.tenantId,
        databaseId: database.id,
        name: 'Tablo',
        type: 'TABLE',
        config: toJson({ filters: [], sorts: [] }),
      },
    });

    return tx.database.findFirstOrThrow({
      where: { id: database.id },
      include: databaseDetailInclude,
    });
  });
}

export async function updateDatabase(
  ctx: AccessContext,
  databaseId: string,
  raw: UpdateDatabaseInput,
) {
  const input = updateDatabaseSchema.parse(raw);
  await assertCanEdit(ctx, 'DATABASE', databaseId);
  await assertDatabase(ctx.tenantId, databaseId);

  if (input.pageId) {
    await assertCanView(ctx, 'PAGE', input.pageId);
  }

  let workspaceAreaId = input.workspaceAreaId;
  if (workspaceAreaId !== undefined) {
    workspaceAreaId = await assertAreaAssignable(ctx, workspaceAreaId);
  }

  return prisma.database.update({
    where: { id: databaseId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.pageId !== undefined ? { pageId: input.pageId } : {}),
      ...(workspaceAreaId !== undefined ? { workspaceAreaId } : {}),
    },
    include: databaseDetailInclude,
  });
}

export async function moveDatabase(ctx: AccessContext, databaseId: string, raw: unknown) {
  const input = moveContentSchema.parse(raw);
  return updateDatabase(ctx, databaseId, { workspaceAreaId: input.workspaceAreaId });
}

export async function deleteDatabase(ctx: AccessContext, databaseId: string) {
  await assertCanEdit(ctx, 'DATABASE', databaseId);
  await assertDatabase(ctx.tenantId, databaseId);
  await prisma.block.updateMany({
    where: { tenantId: ctx.tenantId, databaseId },
    data: { databaseId: null },
  });
  await prisma.database.delete({ where: { id: databaseId } });
  return { deleted: true };
}

/** Call before row/property mutations from controllers */
export async function requireDatabaseView(ctx: AccessContext, databaseId: string) {
  await assertCanView(ctx, 'DATABASE', databaseId);
}

export async function requireDatabaseEdit(ctx: AccessContext, databaseId: string) {
  await assertCanEdit(ctx, 'DATABASE', databaseId);
}

export async function createProperty(
  tenantId: string,
  databaseId: string,
  raw: CreatePropertyInput,
) {
  const input = createPropertySchema.parse(raw);
  await assertDatabase(tenantId, databaseId);

  const position = await nextPosition(tenantId, databaseId, 'property', input.afterPropertyId);
  const config = normalizePropertyConfig(input.type, input.config ?? undefined);

  return prisma.databaseProperty.create({
    data: {
      tenantId,
      databaseId,
      name: input.name,
      type: input.type,
      position,
      config: toJson(config ?? {}),
    },
  });
}

export async function updateProperty(
  tenantId: string,
  databaseId: string,
  propertyId: string,
  raw: UpdatePropertyInput,
) {
  const input = updatePropertySchema.parse(raw);
  const property = await assertProperty(tenantId, databaseId, propertyId);

  if (property.type === 'TITLE') {
    if (input.type !== undefined && input.type !== 'TITLE') {
      throw new AppError(400, 'TITLE_IMMUTABLE', 'Ad alanı tipi değiştirilemez');
    }
  }

  if (input.type && input.type !== property.type && property.type !== 'TITLE') {
    // type change allowed for non-title; clear incompatible cells lightly by keeping raw
  }

  const nextType = input.type ?? property.type;
  if (nextType === 'TITLE' && property.type !== 'TITLE') {
    throw new AppError(400, 'INVALID_PROPERTY_TYPE', 'TITLE alanına dönüştürülemez');
  }

  const config =
    input.config !== undefined
      ? normalizePropertyConfig(nextType, input.config ?? undefined)
      : undefined;

  return prisma.databaseProperty.update({
    where: { id: propertyId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined && property.type !== 'TITLE' ? { type: input.type } : {}),
      ...(config !== undefined ? { config: toJson(config ?? {}) } : {}),
    },
  });
}

export async function deleteProperty(
  tenantId: string,
  databaseId: string,
  propertyId: string,
) {
  const property = await assertProperty(tenantId, databaseId, propertyId);
  if (property.type === 'TITLE') {
    throw new AppError(400, 'TITLE_REQUIRED', 'Ad alanı silinemez');
  }
  await prisma.databaseProperty.delete({ where: { id: propertyId } });
  return { deleted: true };
}

export async function reorderProperties(
  tenantId: string,
  databaseId: string,
  raw: ReorderPropertiesInput,
) {
  const input = reorderPropertiesSchema.parse(raw);
  await assertDatabase(tenantId, databaseId);
  const props = await prisma.databaseProperty.findMany({
    where: { tenantId, databaseId },
    select: { id: true },
  });
  const ids = new Set(props.map((p) => p.id));
  if (input.orderedIds.length !== props.length || input.orderedIds.some((id) => !ids.has(id))) {
    throw new AppError(400, 'INVALID_REORDER', 'Alan sırası geçersiz');
  }

  await prisma.$transaction(
    input.orderedIds.map((id, index) =>
      prisma.databaseProperty.update({
        where: { id },
        data: { position: (index + 1) * POSITION_STEP },
      }),
    ),
  );

  return prisma.databaseProperty.findMany({
    where: { tenantId, databaseId },
    orderBy: { position: 'asc' },
  });
}

function parseJsonArray<T>(raw: string | undefined, schema: { parse: (v: unknown) => T }): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => schema.parse(item));
  } catch {
    throw new AppError(400, 'INVALID_QUERY', 'Filtre veya sıralama geçersiz');
  }
}

export async function listRows(
  tenantId: string,
  databaseId: string,
  query: Record<string, unknown>,
) {
  const input = listRowsQuerySchema.parse(query);
  const database = await assertDatabase(tenantId, databaseId);

  let filters: DatabaseFilter[] = parseJsonArray(input.filters, databaseFilterSchema);
  let sorts: DatabaseSort[] = parseJsonArray(input.sorts, databaseSortSchema);
  let datePropertyId = input.datePropertyId;

  if (input.viewId) {
    const view = await assertView(tenantId, databaseId, input.viewId);
    const config = databaseViewConfigSchema.parse(view.config ?? { filters: [], sorts: [] });
    if (!input.filters) filters = config.filters;
    if (!input.sorts) sorts = config.sorts;
    if (!datePropertyId && config.datePropertyId) datePropertyId = config.datePropertyId;
  }

  if (datePropertyId) {
    await assertProperty(tenantId, databaseId, datePropertyId);
  }

  const allRows = await prisma.databaseRow.findMany({
    where: { tenantId, databaseId },
    include: { cells: true },
    orderBy: { position: 'asc' },
  });

  const properties = database.properties.map((p) => ({
    id: p.id,
    type: p.type as Parameters<typeof applyFiltersAndSorts>[0]['properties'][number]['type'],
  }));

  let working = allRows.map((r) => ({
    id: r.id,
    position: r.position,
    cells: r.cells.map((c) => ({ propertyId: c.propertyId, value: c.value })),
  }));

  let undatedTotal = 0;
  if (datePropertyId) {
    undatedTotal = working.filter((r) => isEmptyCell(cellRaw(r.cells, datePropertyId!))).length;

    if (input.undatedOnly) {
      working = working.filter((r) => isEmptyCell(cellRaw(r.cells, datePropertyId!)));
    } else if (input.startDate || input.endDate) {
      const start = parseDateBound(input.startDate, false);
      const end = parseDateBound(input.endDate, true);
      working = working.filter((r) => {
        const raw = cellRaw(r.cells, datePropertyId!);
        if (isEmptyCell(raw) || typeof raw !== 'string') return false;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return false;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }
  }

  const filtered = applyFiltersAndSorts({
    rows: working,
    properties,
    filters,
    sorts,
    search: input.search,
  });

  const total = filtered.length;
  const start = (input.page - 1) * input.limit;
  const pageIds = new Set(filtered.slice(start, start + input.limit).map((r) => r.id));
  const pageRows = allRows
    .filter((r) => pageIds.has(r.id))
    .sort((a, b) => {
      const ia = filtered.findIndex((r) => r.id === a.id);
      const ib = filtered.findIndex((r) => r.id === b.id);
      return ia - ib;
    });

  return {
    items: pageRows,
    total,
    page: input.page,
    limit: input.limit,
    properties: database.properties,
    undatedTotal: datePropertyId ? undatedTotal : undefined,
  };
}

export async function createRow(
  tenantId: string,
  databaseId: string,
  userId: string,
  raw: CreateRowInput = {},
) {
  const input = createRowSchema.parse(raw ?? {});
  const database = await assertDatabase(tenantId, databaseId);
  const position = await nextPosition(tenantId, databaseId, 'row', input.afterRowId);

  const row = await prisma.databaseRow.create({
    data: {
      tenantId,
      databaseId,
      createdById: userId,
      position,
    },
  });

  if (input.cells?.length) {
    for (const cell of input.cells) {
      const property = database.properties.find((p) => p.id === cell.propertyId);
      if (!property || property.tenantId !== tenantId) {
        throw new AppError(400, 'INVALID_PROPERTY', 'Alan bu tabloya ait değil');
      }
      const value = await validateCellValue(
        tenantId,
        property.type,
        property.config,
        cell.value,
      );
      await prisma.databaseCell.create({
        data: {
          tenantId,
          rowId: row.id,
          propertyId: property.id,
          value: toJson(value),
        },
      });
    }
  }

  await prisma.database.update({
    where: { id: databaseId },
    data: { updatedAt: new Date() },
  });

  return assertRow(tenantId, databaseId, row.id);
}

export async function duplicateRow(
  tenantId: string,
  databaseId: string,
  rowId: string,
  userId: string,
) {
  const source = await assertRow(tenantId, databaseId, rowId);
  const position = await nextPosition(tenantId, databaseId, 'row', source.id);

  const row = await prisma.databaseRow.create({
    data: {
      tenantId,
      databaseId,
      createdById: userId,
      position,
      cells: {
        create: source.cells.map((cell) => ({
          tenantId,
          propertyId: cell.propertyId,
          value: cell.value as Prisma.InputJsonValue,
        })),
      },
    },
    include: { cells: true },
  });

  await prisma.database.update({
    where: { id: databaseId },
    data: { updatedAt: new Date() },
  });

  return row;
}

export async function deleteRow(tenantId: string, databaseId: string, rowId: string) {
  await assertRow(tenantId, databaseId, rowId);
  await prisma.databaseRow.delete({ where: { id: rowId } });
  await prisma.database.update({
    where: { id: databaseId },
    data: { updatedAt: new Date() },
  });
  return { deleted: true };
}

export async function reorderRows(
  tenantId: string,
  databaseId: string,
  raw: ReorderRowsInput,
) {
  const input = reorderRowsSchema.parse(raw);
  await assertDatabase(tenantId, databaseId);
  const rows = await prisma.databaseRow.findMany({
    where: { tenantId, databaseId },
    select: { id: true },
  });
  const ids = new Set(rows.map((r) => r.id));
  if (input.orderedIds.length !== rows.length || input.orderedIds.some((id) => !ids.has(id))) {
    throw new AppError(400, 'INVALID_REORDER', 'Kayıt sırası geçersiz');
  }

  await prisma.$transaction(
    input.orderedIds.map((id, index) =>
      prisma.databaseRow.update({
        where: { id },
        data: { position: (index + 1) * POSITION_STEP },
      }),
    ),
  );

  return prisma.databaseRow.findMany({
    where: { tenantId, databaseId },
    include: { cells: true },
    orderBy: { position: 'asc' },
  });
}

/** Reposition a single row after another (or to start when afterRowId is null). */
export async function moveRow(tenantId: string, databaseId: string, raw: MoveRowInput) {
  const input = moveRowSchema.parse(raw);
  await assertRow(tenantId, databaseId, input.rowId);
  if (input.afterRowId) {
    if (input.afterRowId === input.rowId) {
      throw new AppError(400, 'INVALID_MOVE', 'Kayıt kendisinden sonra konumlandırılamaz');
    }
    await assertRow(tenantId, databaseId, input.afterRowId);
  }
  const position = await nextPosition(tenantId, databaseId, 'row', input.afterRowId ?? null);
  await prisma.databaseRow.update({
    where: { id: input.rowId },
    data: { position },
  });
  await prisma.database.update({
    where: { id: databaseId },
    data: { updatedAt: new Date() },
  });
  return assertRow(tenantId, databaseId, input.rowId);
}

export async function updateCell(
  tenantId: string,
  databaseId: string,
  rowId: string,
  propertyId: string,
  raw: UpdateCellInput,
) {
  const input = updateCellSchema.parse(raw);
  await assertRow(tenantId, databaseId, rowId);
  const property = await assertProperty(tenantId, databaseId, propertyId);
  const value = await validateCellValue(tenantId, property.type, property.config, input.value);

  const cell = await prisma.databaseCell.upsert({
    where: { rowId_propertyId: { rowId, propertyId } },
    create: {
      tenantId,
      rowId,
      propertyId,
      value: toJson(value),
    },
    update: {
      value: toJson(value),
    },
  });

  await prisma.database.update({
    where: { id: databaseId },
    data: { updatedAt: new Date() },
  });

  return cell;
}

export async function listViews(tenantId: string, databaseId: string) {
  await assertDatabase(tenantId, databaseId);
  return prisma.databaseView.findMany({
    where: { tenantId, databaseId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createView(
  tenantId: string,
  databaseId: string,
  raw: CreateViewInput,
) {
  const input = createViewSchema.parse(raw);
  const database = await assertDatabase(tenantId, databaseId);
  const config = await resolveViewConfig(
    tenantId,
    databaseId,
    input.type,
    input.config,
    database.properties,
  );

  return prisma.databaseView.create({
    data: {
      tenantId,
      databaseId,
      name: input.name,
      type: input.type,
      config: toJson(config),
    },
  });
}

export async function updateView(
  tenantId: string,
  databaseId: string,
  viewId: string,
  raw: UpdateViewInput,
) {
  const input = updateViewSchema.parse(raw);
  const view = await assertView(tenantId, databaseId, viewId);
  const database = await assertDatabase(tenantId, databaseId);

  let nextConfig = input.config;
  if (input.config !== undefined) {
    const existing = databaseViewConfigSchema.parse(view.config ?? { filters: [], sorts: [] });
    const merged: DatabaseViewConfig = {
      ...existing,
      ...input.config,
      filters: input.config.filters ?? existing.filters,
      sorts: input.config.sorts ?? existing.sorts,
    };
    nextConfig = await resolveViewConfig(
      tenantId,
      databaseId,
      view.type as 'TABLE' | 'KANBAN' | 'CALENDAR',
      merged,
      database.properties,
    );
  }

  return prisma.databaseView.update({
    where: { id: viewId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(nextConfig !== undefined ? { config: toJson(nextConfig) } : {}),
    },
  });
}

export async function deleteView(tenantId: string, databaseId: string, viewId: string) {
  await assertView(tenantId, databaseId, viewId);
  const count = await prisma.databaseView.count({ where: { tenantId, databaseId } });
  if (count <= 1) {
    throw new AppError(400, 'LAST_VIEW_REQUIRED', 'En az bir görünüm kalmalıdır');
  }
  await prisma.databaseView.delete({ where: { id: viewId } });
  return { deleted: true };
}

export async function duplicateView(tenantId: string, databaseId: string, viewId: string) {
  const view = await assertView(tenantId, databaseId, viewId);
  const config = databaseViewConfigSchema.parse(view.config ?? { filters: [], sorts: [] });
  return prisma.databaseView.create({
    data: {
      tenantId,
      databaseId,
      name: `${view.name} (kopya)`,
      type: view.type,
      config: toJson(config),
    },
  });
}

export { defaultStatusOptions };
