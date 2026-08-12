import type { ContentResourceType } from '@woonwork/shared';
import { apiRequest } from './api';
import type { PageDto } from '../types';

export const WORKSPACE_CHANGED = 'woonwork:workspace-changed';
export const OPEN_COMMAND = 'woonwork:open-command';

export function notifyWorkspaceChanged() {
  window.dispatchEvent(new Event(WORKSPACE_CHANGED));
}

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_COMMAND));
}

export type WorkspaceTreeNode = {
  id: string;
  type: 'PAGE' | 'DATABASE' | 'PROJECT';
  name: string;
  icon: string | null;
  parentId: string | null;
  areaId: string | null;
  updatedAt: string;
  children?: WorkspaceTreeNode[];
};

export type WorkspaceTree = {
  favorites: Array<{
    id: string;
    type: ContentResourceType;
    name: string;
    icon: string | null;
    href?: string;
    areaId: string | null;
  }>;
  recents: Array<{
    id: string;
    resourceType: ContentResourceType;
    resourceId: string;
    name: string;
    icon: string | null;
    href: string;
  }>;
  private: {
    pages: WorkspaceTreeNode[];
    databases: WorkspaceTreeNode[];
    projects: WorkspaceTreeNode[];
  };
  areas: Array<{
    id: string;
    name: string;
    icon: string | null;
    description: string | null;
    hasSocial: boolean;
    pages: WorkspaceTreeNode[];
    databases: WorkspaceTreeNode[];
    projects: WorkspaceTreeNode[];
  }>;
};

export function treeNodeHref(node: Pick<WorkspaceTreeNode, 'type' | 'id'>) {
  if (node.type === 'PAGE') return `/notlar/${node.id}`;
  if (node.type === 'DATABASE') return `/tablolar/${node.id}`;
  return `/projeler/${node.id}`;
}

export async function fetchWorkspaceTree() {
  return apiRequest<WorkspaceTree>('/workspace-tree');
}

export async function createPage(body: {
  title: string;
  parentId?: string | null;
  icon?: string | null;
  coverUrl?: string | null;
  workspaceAreaId?: string | null;
}) {
  return apiRequest<PageDto>('/pages', { method: 'POST', body });
}

export async function updatePage(id: string, body: Record<string, unknown>) {
  return apiRequest<PageDto>(`/pages/${id}`, { method: 'PATCH', body });
}

export async function duplicatePage(id: string) {
  return apiRequest<PageDto>(`/pages/${id}/duplicate`, { method: 'POST' });
}

export async function deletePage(id: string) {
  return apiRequest(`/pages/${id}`, { method: 'DELETE' });
}

export async function createSubpage(
  parentId: string,
  body?: { title?: string; afterBlockId?: string },
) {
  return apiRequest<{ page: PageDto; block: { id: string; type: string; content: unknown } }>(
    `/pages/${parentId}/subpages`,
    { method: 'POST', body: body ?? {} },
  );
}
