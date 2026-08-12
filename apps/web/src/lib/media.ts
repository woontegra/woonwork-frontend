import { upload } from '@vercel/blob/client';
import type { MediaCategory } from '@woonwork/shared';
import { apiRequest, getAccessToken, getStoredTenantId } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export interface MediaAssetDto {
  id: string;
  tenantId: string;
  uploadedById: string;
  originalFileName: string;
  fileName: string;
  mimeType: string;
  size: number;
  storageProvider: string;
  storageKey: string;
  url: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  category: MediaCategory;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  _count?: { blocks: number };
}

export interface MediaListResult {
  items: MediaAssetDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MediaUsageDto {
  totalBytes: number;
  imageBytes: number;
  videoBytes: number;
  documentBytes: number;
  assetCount: number;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export async function listMedia(params: {
  q?: string;
  category?: MediaCategory | '';
  page?: number;
  pageSize?: number;
}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.category) search.set('category', params.category);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  const qs = search.toString();
  return apiRequest<MediaListResult>(`/media${qs ? `?${qs}` : ''}`);
}

export async function getMediaUsage() {
  return apiRequest<MediaUsageDto>('/media/usage');
}

export async function deleteMediaAsset(id: string, force = false) {
  const qs = force ? '?force=true' : '';
  return apiRequest<{ deleted: boolean }>(`/media/${id}${qs}`, { method: 'DELETE' });
}

export async function uploadMediaFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<MediaAssetDto> {
  const { pathname } = await apiRequest<{ pathname: string }>('/media/prepare', {
    method: 'POST',
    body: {
      originalFileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    },
  });

  const token = getAccessToken();
  const tenantId = getStoredTenantId();

  const blob = await upload(pathname, file, {
    access: 'public',
    handleUploadUrl: `${API_URL}/media/upload`,
    clientPayload: JSON.stringify({
      originalFileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    }),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
    },
    onUploadProgress: (event) => {
      if (typeof event.percentage === 'number') {
        onProgress?.(Math.round(event.percentage));
        return;
      }
      if (event.total) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  onProgress?.(100);

  return apiRequest<MediaAssetDto>('/media/finalize', {
    method: 'POST',
    body: {
      url: blob.url,
      storageKey: blob.pathname,
      originalFileName: file.name,
      mimeType: file.type || blob.contentType || 'application/octet-stream',
      size: file.size,
    },
  });
}
