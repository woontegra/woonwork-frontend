import type {
  ContentResourceType,
  SharePermission,
  WorkspaceAreaRole,
  WorkspaceAreaVisibility,
} from '@woonwork/shared';
import { apiRequest } from './api';

export interface LibraryItem {
  id: string;
  resourceType: ContentResourceType;
  name: string;
  icon: string | null;
  workspaceAreaId: string | null;
  areaName: string | null;
  owner: { id: string; firstName: string; lastName: string } | null;
  updatedAt: string;
  sharedPermission?: string | null;
}

export interface LibraryResult {
  items: LibraryItem[];
  total: number;
  page: number;
  limit: number;
  view: string;
}

export interface WorkspaceAreaDto {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  icon: string | null;
  visibility: WorkspaceAreaVisibility;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  _count?: { members: number; pages: number; databases: number; projects: number };
  createdBy?: { id: string; firstName: string; lastName: string };
  members?: Array<{
    id: string;
    userId: string;
    role: WorkspaceAreaRole;
    user: { id: string; firstName: string; lastName: string; email: string };
  }>;
}

export interface ContentShareDto {
  id: string;
  resourceType: ContentResourceType;
  resourceId: string;
  permission: SharePermission;
  sharedWithUser: { id: string; firstName: string; lastName: string; email: string };
  createdBy?: { id: string; firstName: string; lastName: string };
}

export interface RecentDto {
  id: string;
  resourceType: ContentResourceType;
  resourceId: string;
  lastOpenedAt: string;
  name: string;
  icon: string | null;
  href: string;
}

export interface FavoriteDto {
  id: string;
  resourceType: ContentResourceType;
  resourceId: string;
  createdAt: string;
  name?: string;
  icon?: string | null;
  href?: string;
}

export async function fetchLibrary(params: {
  view?: string;
  type?: ContentResourceType;
  areaId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params.view) q.set('view', params.view);
  if (params.type) q.set('type', params.type);
  if (params.areaId) q.set('areaId', params.areaId);
  if (params.search) q.set('search', params.search);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiRequest<LibraryResult>(`/library${qs ? `?${qs}` : ''}`);
}

export async function listAreas() {
  return apiRequest<WorkspaceAreaDto[]>('/workspace-areas');
}

export async function getArea(id: string) {
  return apiRequest<WorkspaceAreaDto>(`/workspace-areas/${id}`);
}

export async function createArea(body: {
  name: string;
  description?: string | null;
  icon?: string | null;
  visibility?: WorkspaceAreaVisibility;
}) {
  return apiRequest<WorkspaceAreaDto>('/workspace-areas', { method: 'POST', body });
}

export async function updateArea(
  id: string,
  body: Partial<{
    name: string;
    description: string | null;
    icon: string | null;
    visibility: WorkspaceAreaVisibility;
  }>,
) {
  return apiRequest<WorkspaceAreaDto>(`/workspace-areas/${id}`, { method: 'PATCH', body });
}

export async function deleteArea(id: string) {
  return apiRequest<{ deleted: boolean }>(`/workspace-areas/${id}`, { method: 'DELETE' });
}

export async function getAreaContents(id: string) {
  return apiRequest<{
    pages: Array<{
      id: string;
      title: string;
      icon: string | null;
      updatedAt: string;
      createdBy?: { id: string; firstName: string; lastName: string };
    }>;
    databases: Array<{
      id: string;
      name: string;
      updatedAt: string;
      _count?: { rows: number };
      createdBy?: { id: string; firstName: string; lastName: string };
    }>;
    projects: Array<{
      id: string;
      name: string;
      updatedAt: string;
      _count?: { tasks: number };
      createdBy?: { id: string; firstName: string; lastName: string };
    }>;
  }>(`/workspace-areas/${id}/contents`);
}

export async function upsertAreaMember(
  areaId: string,
  body: { userId: string; role: WorkspaceAreaRole },
) {
  return apiRequest(`/workspace-areas/${areaId}/members`, { method: 'POST', body });
}

export async function removeAreaMember(areaId: string, userId: string) {
  return apiRequest(`/workspace-areas/${areaId}/members/${userId}`, { method: 'DELETE' });
}

export async function listShares(resourceType: ContentResourceType, resourceId: string) {
  const q = new URLSearchParams({ resourceType, resourceId });
  return apiRequest<ContentShareDto[]>(`/shares?${q}`);
}

export async function createShare(body: {
  resourceType: ContentResourceType;
  resourceId: string;
  sharedWithUserId: string;
  permission?: SharePermission;
}) {
  return apiRequest<ContentShareDto>('/shares', { method: 'POST', body });
}

export async function updateShare(id: string, permission: SharePermission) {
  return apiRequest<ContentShareDto>(`/shares/${id}`, {
    method: 'PATCH',
    body: { permission },
  });
}

export async function deleteShare(id: string) {
  return apiRequest<{ deleted: boolean }>(`/shares/${id}`, { method: 'DELETE' });
}

export async function listFavorites(limit = 8) {
  return apiRequest<FavoriteDto[]>(`/favorites?limit=${limit}`);
}

export async function addFavorite(resourceType: ContentResourceType, resourceId: string) {
  return apiRequest<FavoriteDto>('/favorites', {
    method: 'POST',
    body: { resourceType, resourceId },
  });
}

export async function removeFavorite(resourceType: ContentResourceType, resourceId: string) {
  return apiRequest<{ deleted: boolean }>(`/favorites/${resourceType}/${resourceId}`, {
    method: 'DELETE',
  });
}

export async function listRecents(limit = 12) {
  return apiRequest<RecentDto[]>(`/recents?limit=${limit}`);
}

export async function movePage(
  id: string,
  workspaceAreaIdOrBody:
    | string
    | null
    | { workspaceAreaId?: string | null; parentId?: string | null },
) {
  const body =
    workspaceAreaIdOrBody !== null && typeof workspaceAreaIdOrBody === 'object'
      ? workspaceAreaIdOrBody
      : { workspaceAreaId: workspaceAreaIdOrBody };
  return apiRequest(`/pages/${id}/move`, {
    method: 'POST',
    body,
  });
}

export async function moveDatabase(id: string, workspaceAreaId: string | null) {
  return apiRequest(`/databases/${id}/move`, {
    method: 'POST',
    body: { workspaceAreaId },
  });
}

export async function moveProject(id: string, workspaceAreaId: string | null) {
  return apiRequest(`/projects/${id}/move`, {
    method: 'POST',
    body: { workspaceAreaId },
  });
}

export function resourceHref(type: ContentResourceType, id: string) {
  if (type === 'PAGE') return `/notlar/${id}`;
  if (type === 'DATABASE') return `/tablolar/${id}`;
  return `/projeler/${id}`;
}

export function resourceTypeLabel(type: ContentResourceType) {
  if (type === 'PAGE') return 'Sayfa';
  if (type === 'DATABASE') return 'Akıllı Tablo';
  return 'Proje';
}

export function visibilityLabel(v: WorkspaceAreaVisibility) {
  if (v === 'TENANT') return 'Herkes';
  if (v === 'PRIVATE') return 'Gizli';
  return 'Davet edilenler';
}

export function areaRoleLabel(role: WorkspaceAreaRole) {
  if (role === 'OWNER') return 'Yönetici';
  if (role === 'EDITOR') return 'Düzenleyici';
  if (role === 'VIEWER') return 'Görüntüleyici';
  return 'Üye';
}
