import type { SocialHashtagStatus } from '@woonwork/shared';
import { apiRequest } from './api';

export interface SocialHashtagBrandDto {
  id: string;
  name: string;
  color: string | null;
  isActive: boolean;
}

export interface SocialHashtagDto {
  id: string;
  tenantId: string;
  socialBrandId: string;
  tag: string;
  tagKey: string;
  status: SocialHashtagStatus;
  category: string | null;
  notes: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  brand?: SocialHashtagBrandDto;
}

export interface SocialHashtagListResult {
  items: SocialHashtagDto[];
  total: number;
  page: number;
  limit: number;
}

export interface SocialHashtagBulkResult {
  created: number;
  duplicate: number;
  invalid: number;
  duplicates?: string[];
  invalidTags?: string[];
  items: SocialHashtagDto[];
}

export const hashtagStatusLabels: Record<SocialHashtagStatus, string> = {
  ACTIVE: 'Aktif',
  BLOCKED: 'Blocklist',
  DISABLED: 'Pasif',
};

export const hashtagStatusBadgeClass: Record<SocialHashtagStatus, string> = {
  ACTIVE: 'bg-emerald-50/80 text-emerald-800/75',
  BLOCKED: 'bg-red-50/70 text-red-800/70',
  DISABLED: 'bg-ink-100 text-ink-500',
};

export async function fetchHashtags(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === '') return;
    q.set(k, String(v));
  });
  const qs = q.toString();
  return apiRequest<SocialHashtagListResult>(`/social/hashtags${qs ? `?${qs}` : ''}`);
}

export async function createHashtag(body: {
  socialBrandId: string;
  tag: string;
  status?: SocialHashtagStatus;
  category?: string | null;
  notes?: string | null;
}) {
  return apiRequest<SocialHashtagDto>('/social/hashtags', { method: 'POST', body });
}

export async function updateHashtag(
  id: string,
  body: Partial<{
    socialBrandId: string;
    tag: string;
    status: SocialHashtagStatus;
    category: string | null;
    notes: string | null;
  }>,
) {
  return apiRequest<SocialHashtagDto>(`/social/hashtags/${id}`, { method: 'PATCH', body });
}

export async function deleteHashtag(id: string) {
  return apiRequest<{ deleted: boolean }>(`/social/hashtags/${id}`, { method: 'DELETE' });
}

export async function bulkCreateHashtags(body: {
  socialBrandId: string;
  text: string;
  status?: SocialHashtagStatus;
  category?: string | null;
  notes?: string | null;
}) {
  return apiRequest<SocialHashtagBulkResult>('/social/hashtags/bulk', { method: 'POST', body });
}
