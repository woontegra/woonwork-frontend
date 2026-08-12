import { randomUUID } from 'crypto';
import {
  DatabasePropertyType,
  DATABASE_OPTION_COLORS,
  defaultStatusOptions,
  propertyConfigSchema,
  type DatabaseFilter,
  type DatabasePropertyType as PropertyType,
  type DatabaseSort,
  type PropertyConfig,
  type SelectOption,
} from '@woonwork/shared';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmptyValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function getOptions(config: unknown): SelectOption[] {
  const parsed = propertyConfigSchema.safeParse(config ?? {});
  return parsed.success ? parsed.data.options ?? [] : [];
}

export function normalizePropertyConfig(
  type: PropertyType,
  config: PropertyConfig | null | undefined,
): PropertyConfig | null {
  if (
    type === DatabasePropertyType.SELECT ||
    type === DatabasePropertyType.MULTI_SELECT ||
    type === DatabasePropertyType.STATUS
  ) {
    const options =
      config?.options?.map((opt) => ({
        id: opt.id || randomUUID(),
        name: opt.name,
        color: DATABASE_OPTION_COLORS.includes(opt.color as (typeof DATABASE_OPTION_COLORS)[number])
          ? opt.color
          : 'gray',
      })) ??
      (type === DatabasePropertyType.STATUS ? defaultStatusOptions() : []);
    return { options };
  }
  return config ?? null;
}

export async function validateCellValue(
  tenantId: string,
  type: PropertyType,
  config: unknown,
  raw: unknown,
): Promise<unknown> {
  if (raw === null || raw === undefined) {
    if (type === DatabasePropertyType.CHECKBOX) return false;
    if (type === DatabasePropertyType.MULTI_SELECT) return [];
    return null;
  }

  switch (type) {
    case DatabasePropertyType.TITLE:
    case DatabasePropertyType.TEXT:
    case DatabasePropertyType.PHONE: {
      if (typeof raw !== 'string') {
        throw new AppError(400, 'INVALID_CELL', 'Metin değeri bekleniyor');
      }
      return raw;
    }
    case DatabasePropertyType.NUMBER: {
      if (typeof raw !== 'number' || Number.isNaN(raw)) {
        throw new AppError(400, 'INVALID_CELL', 'Sayı değeri bekleniyor');
      }
      return raw;
    }
    case DatabasePropertyType.CHECKBOX: {
      if (typeof raw !== 'boolean') {
        throw new AppError(400, 'INVALID_CELL', 'Onay kutusu değeri bekleniyor');
      }
      return raw;
    }
    case DatabasePropertyType.DATE: {
      if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) {
        throw new AppError(400, 'INVALID_CELL', 'Geçerli bir tarih bekleniyor');
      }
      return new Date(raw).toISOString();
    }
    case DatabasePropertyType.URL: {
      if (typeof raw !== 'string') {
        throw new AppError(400, 'INVALID_CELL', 'Bağlantı değeri bekleniyor');
      }
      try {
        // eslint-disable-next-line no-new
        new URL(raw);
      } catch {
        throw new AppError(400, 'INVALID_CELL', 'Geçerli bir URL girin');
      }
      return raw;
    }
    case DatabasePropertyType.EMAIL: {
      if (typeof raw !== 'string' || !emailRe.test(raw)) {
        throw new AppError(400, 'INVALID_CELL', 'Geçerli bir e-posta girin');
      }
      return raw;
    }
    case DatabasePropertyType.SELECT:
    case DatabasePropertyType.STATUS: {
      if (typeof raw !== 'string') {
        throw new AppError(400, 'INVALID_CELL', 'Seçenek kimliği bekleniyor');
      }
      const options = getOptions(config);
      if (!options.some((o) => o.id === raw)) {
        throw new AppError(400, 'INVALID_CELL', 'Geçersiz seçenek');
      }
      return raw;
    }
    case DatabasePropertyType.MULTI_SELECT: {
      if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string')) {
        throw new AppError(400, 'INVALID_CELL', 'Seçenek listesi bekleniyor');
      }
      const options = getOptions(config);
      const ids = new Set(options.map((o) => o.id));
      for (const id of raw as string[]) {
        if (!ids.has(id)) {
          throw new AppError(400, 'INVALID_CELL', 'Geçersiz seçenek');
        }
      }
      return raw;
    }
    case DatabasePropertyType.PERSON: {
      if (typeof raw !== 'string') {
        throw new AppError(400, 'INVALID_CELL', 'Kişi kimliği bekleniyor');
      }
      const member = await prisma.tenantMember.findFirst({
        where: { tenantId, userId: raw },
        select: { id: true },
      });
      if (!member) {
        throw new AppError(400, 'INVALID_CELL', 'Kişi bu çalışma alanına ait değil');
      }
      return raw;
    }
    default:
      throw new AppError(400, 'INVALID_CELL', 'Desteklenmeyen alan tipi');
  }
}

export function cellMatchesFilter(
  value: unknown,
  type: PropertyType,
  filter: DatabaseFilter,
): boolean {
  const empty = isEmptyValue(value);

  switch (filter.operator) {
    case 'is_empty':
      return empty;
    case 'is_not_empty':
      return !empty;
    case 'is_checked':
      return value === true;
    case 'is_unchecked':
      return value === false || value === null || value === undefined;
    case 'contains':
      return typeof value === 'string' && typeof filter.value === 'string'
        ? value.toLocaleLowerCase('tr-TR').includes(filter.value.toLocaleLowerCase('tr-TR'))
        : false;
    case 'not_contains':
      return typeof value === 'string' && typeof filter.value === 'string'
        ? !value.toLocaleLowerCase('tr-TR').includes(filter.value.toLocaleLowerCase('tr-TR'))
        : true;
    case 'equals':
      if (type === DatabasePropertyType.NUMBER) return value === filter.value;
      if (type === DatabasePropertyType.DATE) {
        if (typeof value !== 'string' || typeof filter.value !== 'string') return false;
        return value.slice(0, 10) === filter.value.slice(0, 10);
      }
      return value === filter.value;
    case 'not_equals':
      return value !== filter.value;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (typeof value !== 'number' || typeof filter.value !== 'number') return false;
      if (filter.operator === 'gt') return value > filter.value;
      if (filter.operator === 'gte') return value >= filter.value;
      if (filter.operator === 'lt') return value < filter.value;
      return value <= filter.value;
    }
    case 'before':
    case 'after': {
      if (typeof value !== 'string' || typeof filter.value !== 'string') return false;
      const a = Date.parse(value);
      const b = Date.parse(filter.value);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      return filter.operator === 'before' ? a < b : a > b;
    }
    default:
      return true;
  }
}

export function compareCellValues(
  a: unknown,
  b: unknown,
  type: PropertyType,
  direction: 'asc' | 'desc',
): number {
  const emptyA = isEmptyValue(a);
  const emptyB = isEmptyValue(b);
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  let result = 0;
  if (type === DatabasePropertyType.NUMBER) {
    result = Number(a) - Number(b);
  } else if (type === DatabasePropertyType.CHECKBOX) {
    result = Number(Boolean(a)) - Number(Boolean(b));
  } else if (type === DatabasePropertyType.DATE) {
    result = Date.parse(String(a)) - Date.parse(String(b));
  } else if (Array.isArray(a) || Array.isArray(b)) {
    result = String(JSON.stringify(a)).localeCompare(String(JSON.stringify(b)), 'tr');
  } else {
    result = String(a).localeCompare(String(b), 'tr', { sensitivity: 'base' });
  }

  return direction === 'asc' ? result : -result;
}

export function applyFiltersAndSorts(params: {
  rows: Array<{
    id: string;
    position: number;
    cells: Array<{ propertyId: string; value: unknown }>;
  }>;
  properties: Array<{ id: string; type: PropertyType }>;
  filters: DatabaseFilter[];
  sorts: DatabaseSort[];
  search?: string;
}) {
  const propMap = new Map(params.properties.map((p) => [p.id, p]));
  const titleOrTextIds = params.properties
    .filter((p) => p.type === 'TITLE' || p.type === 'TEXT')
    .map((p) => p.id);

  let rows = params.rows;

  if (params.search?.trim()) {
    const q = params.search.trim().toLocaleLowerCase('tr-TR');
    rows = rows.filter((row) =>
      row.cells.some(
        (cell) =>
          titleOrTextIds.includes(cell.propertyId) &&
          typeof cell.value === 'string' &&
          cell.value.toLocaleLowerCase('tr-TR').includes(q),
      ),
    );
  }

  for (const filter of params.filters) {
    const prop = propMap.get(filter.propertyId);
    if (!prop) continue;
    rows = rows.filter((row) => {
      const cell = row.cells.find((c) => c.propertyId === filter.propertyId);
      return cellMatchesFilter(cell?.value, prop.type, filter);
    });
  }

  if (params.sorts.length) {
    rows = [...rows].sort((ra, rb) => {
      for (const sort of params.sorts) {
        const prop = propMap.get(sort.propertyId);
        if (!prop) continue;
        const va = ra.cells.find((c) => c.propertyId === sort.propertyId)?.value;
        const vb = rb.cells.find((c) => c.propertyId === sort.propertyId)?.value;
        const cmp = compareCellValues(va, vb, prop.type, sort.direction);
        if (cmp !== 0) return cmp;
      }
      return ra.position - rb.position;
    });
  } else {
    rows = [...rows].sort((a, b) => a.position - b.position);
  }

  return rows;
}
