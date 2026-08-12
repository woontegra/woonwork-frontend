import type {
  DatabaseFilter,
  DatabasePropertyType,
  DatabaseSort,
  DatabaseViewConfig,
  DatabaseViewType,
  PropertyConfig,
} from '@woonwork/shared';
import { apiRequest } from './api';

export interface DatabasePropertyDto {
  id: string;
  tenantId: string;
  databaseId: string;
  name: string;
  type: DatabasePropertyType;
  position: number;
  config: PropertyConfig | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseViewDto {
  id: string;
  tenantId: string;
  databaseId: string;
  name: string;
  type: DatabaseViewType;
  config: DatabaseViewConfig;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseDto {
  id: string;
  tenantId: string;
  pageId: string | null;
  name: string;
  description: string | null;
  createdById: string;
  workspaceAreaId?: string | null;
  createdAt: string;
  updatedAt: string;
  properties?: DatabasePropertyDto[];
  views?: DatabaseViewDto[];
  workspaceArea?: { id: string; name: string; icon: string | null } | null;
  _count?: { rows: number };
  createdBy?: { id: string; firstName: string; lastName: string };
}

export interface DatabaseCellDto {
  id: string;
  tenantId: string;
  rowId: string;
  propertyId: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseRowDto {
  id: string;
  tenantId: string;
  databaseId: string;
  position: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  cells: DatabaseCellDto[];
}

export interface RowsResult {
  items: DatabaseRowDto[];
  total: number;
  page: number;
  limit: number;
  properties: DatabasePropertyDto[];
  undatedTotal?: number;
}

export interface TenantMemberOption {
  id: string;
  role: string;
  user: { id: string; firstName: string; lastName: string; email: string };
}

export function cellValue(row: DatabaseRowDto, propertyId: string): unknown {
  return row.cells.find((c) => c.propertyId === propertyId)?.value ?? null;
}

export function lastViewStorageKey(tenantId: string, databaseId: string) {
  return `woonwork:lastDatabaseView:${tenantId}:${databaseId}`;
}

export function readLastViewId(tenantId: string, databaseId: string): string | null {
  try {
    return localStorage.getItem(lastViewStorageKey(tenantId, databaseId));
  } catch {
    return null;
  }
}

export function writeLastViewId(tenantId: string, databaseId: string, viewId: string) {
  try {
    localStorage.setItem(lastViewStorageKey(tenantId, databaseId), viewId);
  } catch {
    // ignore
  }
}

export async function listDatabases() {
  return apiRequest<DatabaseDto[]>('/databases');
}

export async function getDatabase(id: string) {
  return apiRequest<DatabaseDto>(`/databases/${id}`);
}

export async function createDatabase(body: {
  name: string;
  description?: string | null;
  pageId?: string | null;
  workspaceAreaId?: string | null;
}) {
  return apiRequest<DatabaseDto>('/databases', { method: 'POST', body });
}

export async function updateDatabase(
  id: string,
  body: { name?: string; description?: string | null },
) {
  return apiRequest<DatabaseDto>(`/databases/${id}`, { method: 'PATCH', body });
}

export async function deleteDatabase(id: string) {
  return apiRequest<{ deleted: boolean }>(`/databases/${id}`, { method: 'DELETE' });
}

export async function createProperty(
  databaseId: string,
  body: {
    name: string;
    type: Exclude<DatabasePropertyType, 'TITLE'>;
    config?: PropertyConfig | null;
  },
) {
  return apiRequest<DatabasePropertyDto>(`/databases/${databaseId}/properties`, {
    method: 'POST',
    body,
  });
}

export async function updateProperty(
  databaseId: string,
  propertyId: string,
  body: { name?: string; type?: DatabasePropertyType; config?: PropertyConfig | null },
) {
  return apiRequest<DatabasePropertyDto>(
    `/databases/${databaseId}/properties/${propertyId}`,
    { method: 'PATCH', body },
  );
}

export async function deleteProperty(databaseId: string, propertyId: string) {
  return apiRequest<{ deleted: boolean }>(
    `/databases/${databaseId}/properties/${propertyId}`,
    { method: 'DELETE' },
  );
}

export async function reorderProperties(databaseId: string, orderedIds: string[]) {
  return apiRequest<DatabasePropertyDto[]>(`/databases/${databaseId}/properties/reorder`, {
    method: 'POST',
    body: { orderedIds },
  });
}

export async function listRows(
  databaseId: string,
  params: {
    page?: number;
    limit?: number;
    search?: string;
    viewId?: string;
    filters?: DatabaseFilter[];
    sorts?: DatabaseSort[];
    startDate?: string;
    endDate?: string;
    datePropertyId?: string;
    undatedOnly?: boolean;
  } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.search) q.set('search', params.search);
  if (params.viewId) q.set('viewId', params.viewId);
  if (params.filters?.length) q.set('filters', JSON.stringify(params.filters));
  if (params.sorts?.length) q.set('sorts', JSON.stringify(params.sorts));
  if (params.startDate) q.set('startDate', params.startDate);
  if (params.endDate) q.set('endDate', params.endDate);
  if (params.datePropertyId) q.set('datePropertyId', params.datePropertyId);
  if (params.undatedOnly) q.set('undatedOnly', 'true');
  const qs = q.toString();
  return apiRequest<RowsResult>(`/databases/${databaseId}/rows${qs ? `?${qs}` : ''}`);
}

export async function createRow(
  databaseId: string,
  body: {
    afterRowId?: string | null;
    cells?: Array<{ propertyId: string; value: unknown }>;
  } = {},
) {
  return apiRequest<DatabaseRowDto>(`/databases/${databaseId}/rows`, {
    method: 'POST',
    body,
  });
}

export async function duplicateRow(databaseId: string, rowId: string) {
  return apiRequest<DatabaseRowDto>(`/databases/${databaseId}/rows/${rowId}/duplicate`, {
    method: 'POST',
    body: {},
  });
}

export async function deleteRow(databaseId: string, rowId: string) {
  return apiRequest<{ deleted: boolean }>(`/databases/${databaseId}/rows/${rowId}`, {
    method: 'DELETE',
  });
}

export async function moveRow(
  databaseId: string,
  body: { rowId: string; afterRowId?: string | null },
) {
  return apiRequest<DatabaseRowDto>(`/databases/${databaseId}/rows/move`, {
    method: 'POST',
    body,
  });
}

export async function updateCell(
  databaseId: string,
  rowId: string,
  propertyId: string,
  value: unknown,
) {
  return apiRequest<DatabaseCellDto>(
    `/databases/${databaseId}/rows/${rowId}/cells/${propertyId}`,
    { method: 'PATCH', body: { value } },
  );
}

export async function createView(
  databaseId: string,
  body: {
    name: string;
    type: DatabaseViewType;
    config?: DatabaseViewConfig;
  },
) {
  return apiRequest<DatabaseViewDto>(`/databases/${databaseId}/views`, {
    method: 'POST',
    body,
  });
}

export async function updateView(
  databaseId: string,
  viewId: string,
  body: { name?: string; config?: DatabaseViewConfig },
) {
  return apiRequest<DatabaseViewDto>(`/databases/${databaseId}/views/${viewId}`, {
    method: 'PATCH',
    body,
  });
}

export async function deleteView(databaseId: string, viewId: string) {
  return apiRequest<{ deleted: boolean }>(`/databases/${databaseId}/views/${viewId}`, {
    method: 'DELETE',
  });
}

export async function duplicateView(databaseId: string, viewId: string) {
  return apiRequest<DatabaseViewDto>(`/databases/${databaseId}/views/${viewId}/duplicate`, {
    method: 'POST',
    body: {},
  });
}

export async function listTenantMembers(tenantId: string) {
  return apiRequest<TenantMemberOption[]>(`/tenants/${tenantId}/members`);
}
