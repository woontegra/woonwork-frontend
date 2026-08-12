import type {
  SocialConnectionStatus,
  SocialContentStatus,
  SocialContentType,
  SocialPlatform,
  SocialPublicationStatus,
} from '@woonwork/shared';
import { apiRequest } from './api';
import type { MediaAssetDto } from './media';

export interface SocialBrandAccountPreview {
  id: string;
  platform: SocialPlatform;
  name: string;
  username: string | null;
  connectionStatus: SocialConnectionStatus;
  isActive: boolean;
}

export interface SocialBrandStats {
  contents: number;
  planned: number;
  published: number;
  failed: number;
  hashtags: number;
  accounts: number;
}

export interface SocialBrandDto {
  id: string;
  tenantId: string;
  workspaceAreaId: string | null;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  workspaceArea?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string };
  accounts?: SocialBrandAccountPreview[];
  stats?: SocialBrandStats;
  _count?: { contents: number; accounts?: number; hashtags?: number };
  hashtagBreakdown?: { usable: number; blocked: number; inactive: number };
  recentContents?: Array<{
    id: string;
    title: string;
    contentType: SocialContentType;
    status: SocialContentStatus;
    scheduledAt: string | null;
    published: boolean;
    updatedAt: string;
    platforms: Array<{ platform: SocialPlatform }>;
    destinations?: Array<{ platform: SocialPlatform; publicationStatus: SocialPublicationStatus }>;
  }>;
}

export interface SocialContentMediaDto {
  id: string;
  mediaAssetId: string;
  position: number;
  role: string | null;
  mediaAsset: Pick<
    MediaAssetDto,
    'id' | 'url' | 'originalFileName' | 'mimeType' | 'category' | 'size'
  >;
}

export interface SocialContentDto {
  id: string;
  tenantId: string;
  workspaceAreaId: string | null;
  socialBrandId: string | null;
  createdById: string;
  title: string;
  description: string | null;
  contentText: string | null;
  internalNotes: string | null;
  contentType: SocialContentType;
  status: SocialContentStatus;
  scheduledAt: string | null;
  timezone: string;
  edited: boolean;
  approved: boolean;
  readyToPublish: boolean;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  brand?: { id: string; name: string; color: string | null; isActive: boolean } | null;
  workspaceArea?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string };
  platforms: Array<{ id: string; platform: SocialPlatform }>;
  destinations?: SocialDestinationDto[];
  media: SocialContentMediaDto[];
}

export interface SocialAccountDto {
  id: string;
  tenantId: string;
  socialConnectionId: string;
  socialBrandId: string | null;
  platform: SocialPlatform;
  externalAccountId: string;
  parentExternalId: string | null;
  name: string;
  username: string | null;
  profilePictureUrl: string | null;
  accountType: string | null;
  tokenExpiresAt: string | null;
  isActive: boolean;
  connectionStatus: SocialConnectionStatus;
  createdAt: string;
  updatedAt: string;
  brand?: { id: string; name: string; color: string | null } | null;
  connection?: { id: string; provider: string; status: SocialConnectionStatus; expiresAt: string | null } | null;
}

export interface SocialDestinationDto {
  id: string;
  socialAccountId: string;
  platform: SocialPlatform;
  publicationStatus: SocialPublicationStatus;
  externalPostId: string | null;
  externalContainerId: string | null;
  permalink: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  publishedAt: string | null;
  lastAttemptAt: string | null;
  attemptCount: number;
  account?: Pick<
    SocialAccountDto,
    'id' | 'platform' | 'name' | 'username' | 'profilePictureUrl' | 'isActive' | 'connectionStatus' | 'socialBrandId'
  >;
}

export interface MetaDiscoveryPage {
  pageId: string;
  name: string;
  tasks: string[];
  instagram: {
    id: string;
    username: string | null;
    name: string | null;
    profilePictureUrl: string | null;
    accountType: string | null;
  } | null;
  instagramUnlinkedReason: string | null;
}

export interface MetaDiscoveryResult {
  connectionId: string;
  connectionStatus: SocialConnectionStatus;
  pages: MetaDiscoveryPage[];
}

export interface SocialListResult {
  items: SocialContentDto[];
  total: number;
  page: number;
  limit: number;
}

export interface SocialOverview {
  today: SocialContentDto[];
  tomorrow: SocialContentDto[];
  week: SocialContentDto[];
  approval: SocialContentDto[];
  readyToPublish: SocialContentDto[];
  drafts: SocialContentDto[];
  upcoming: SocialContentDto[];
  failed: SocialContentDto[];
  blockedHashtagWarningCount?: number;
}

export const platformLabels: Record<SocialPlatform, string> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  LINKEDIN: 'LinkedIn',
  PINTEREST: 'Pinterest',
  YOUTUBE: 'YouTube',
};

export const platformShort: Record<SocialPlatform, string> = {
  INSTAGRAM: 'IG',
  FACEBOOK: 'FB',
  LINKEDIN: 'IN',
  PINTEREST: 'PI',
  YOUTUBE: 'YT',
};

export const contentTypeLabels: Record<SocialContentType, string> = {
  POST: 'Gönderi',
  CAROUSEL: 'Carousel',
  REEL: 'Reel',
  STORY: 'Hikâye',
  VIDEO: 'Video',
  SHORT: 'Short',
  ARTICLE: 'Makale',
  PIN: 'Pin',
};

export const statusLabels: Record<SocialContentStatus, string> = {
  IDEA: 'Fikir',
  DRAFT: 'Taslak',
  IN_REVIEW: 'İncelemede',
  APPROVED: 'Onaylı',
  SCHEDULED: 'Zamanlandı',
  PUBLISHED: 'Yayınlandı',
  CANCELLED: 'İptal',
};

export const ALL_PLATFORMS: SocialPlatform[] = [
  'INSTAGRAM',
  'FACEBOOK',
  'LINKEDIN',
  'PINTEREST',
  'YOUTUBE',
];

export const ALL_TYPES: SocialContentType[] = [
  'POST',
  'CAROUSEL',
  'REEL',
  'STORY',
  'VIDEO',
  'SHORT',
  'ARTICLE',
  'PIN',
];

export const ALL_STATUSES: SocialContentStatus[] = [
  'IDEA',
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'CANCELLED',
];

export function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function listBrands(activeOnly = false) {
  const q = activeOnly ? '?active=true' : '';
  return apiRequest<SocialBrandDto[]>(`/social/brands${q}`);
}

export async function getBrand(id: string) {
  return apiRequest<SocialBrandDto>(`/social/brands/${id}`);
}

export async function createBrand(body: {
  name: string;
  description?: string | null;
  color?: string | null;
  workspaceAreaId?: string | null;
  isActive?: boolean;
}) {
  return apiRequest<SocialBrandDto>('/social/brands', { method: 'POST', body });
}

export async function updateBrand(
  id: string,
  body: Partial<{
    name: string;
    description: string | null;
    color: string | null;
    workspaceAreaId: string | null;
    isActive: boolean;
  }>,
) {
  return apiRequest<SocialBrandDto>(`/social/brands/${id}`, { method: 'PATCH', body });
}

export async function deleteBrand(id: string) {
  return apiRequest<{ deleted: boolean }>(`/social/brands/${id}`, { method: 'DELETE' });
}

export async function fetchOverview() {
  return apiRequest<SocialOverview>('/social/contents/overview');
}

export async function fetchContents(params: Record<string, string | number | boolean | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === '') return;
    q.set(k, String(v));
  });
  const qs = q.toString();
  return apiRequest<SocialListResult>(`/social/contents${qs ? `?${qs}` : ''}`);
}

export async function fetchCalendar(startDate: string, endDate: string) {
  const q = new URLSearchParams({ startDate, endDate });
  return apiRequest<SocialContentDto[]>(`/social/contents/calendar?${q}`);
}

export async function fetchUnscheduled() {
  return apiRequest<SocialContentDto[]>('/social/contents/unscheduled');
}

export async function getContent(id: string) {
  return apiRequest<SocialContentDto>(`/social/contents/${id}`);
}

export async function createContent(body: Record<string, unknown>) {
  return apiRequest<SocialContentDto>('/social/contents', { method: 'POST', body });
}

export async function updateContent(id: string, body: Record<string, unknown>) {
  return apiRequest<SocialContentDto>(`/social/contents/${id}`, { method: 'PATCH', body });
}

export async function deleteContent(id: string) {
  return apiRequest<{ deleted: boolean }>(`/social/contents/${id}`, { method: 'DELETE' });
}

export async function duplicateContent(id: string) {
  return apiRequest<SocialContentDto>(`/social/contents/${id}/duplicate`, { method: 'POST' });
}

export async function attachMedia(contentId: string, mediaAssetId: string) {
  return apiRequest<SocialContentDto>(`/social/contents/${contentId}/media`, {
    method: 'POST',
    body: { mediaAssetId },
  });
}

export async function detachMedia(contentId: string, mediaId: string) {
  return apiRequest<SocialContentDto>(`/social/contents/${contentId}/media/${mediaId}`, {
    method: 'DELETE',
  });
}

export async function reorderMedia(contentId: string, orderedIds: string[]) {
  return apiRequest<SocialContentDto>(`/social/contents/${contentId}/media/reorder`, {
    method: 'POST',
    body: { orderedIds },
  });
}

export const publicationStatusLabels: Record<SocialPublicationStatus, string> = {
  PENDING: 'Bekliyor',
  READY: 'Hazır',
  PUBLISHING: 'Yayınlanıyor…',
  PUBLISHED: 'Yayınlandı',
  FAILED: 'Başarısız',
  CANCELLED: 'İptal',
};

export const connectionStatusLabels: Record<SocialConnectionStatus, string> = {
  CONNECTED: 'Bağlı',
  EXPIRED: 'Süresi doldu',
  REVOKED: 'Kesildi',
  ERROR: 'Hata',
};

export function accountLabel(account: Pick<SocialAccountDto, 'platform' | 'name' | 'username'>) {
  if (account.platform === 'INSTAGRAM') {
    return account.username ? `@${account.username}` : account.name;
  }
  return account.name;
}

export async function startMetaOauth(reconnectConnectionId?: string | null) {
  const q = reconnectConnectionId ? `?reconnectConnectionId=${reconnectConnectionId}` : '';
  return apiRequest<{ authorizationUrl: string; sessionId: string }>(`/social/meta/oauth/start${q}`);
}

export type MetaOauthStatusDto =
  | { status: 'PENDING' }
  | { status: 'EXPIRED' }
  | { status: 'SUCCESS'; connectionId: string; reconnected: boolean }
  | { status: 'FAILED'; error: string };

export async function fetchMetaOauthStatus(sessionId: string) {
  return apiRequest<MetaOauthStatusDto>(
    `/social/meta/oauth/status/${encodeURIComponent(sessionId)}`,
  );
}

export async function fetchMetaDiscovery(connectionId?: string) {
  const q = connectionId ? `?connectionId=${connectionId}` : '';
  return apiRequest<MetaDiscoveryResult>(`/social/meta/discovery${q}`);
}

export async function connectMetaAccounts(body: {
  connectionId: string;
  socialBrandId?: string | null;
  pages: Array<{ pageId: string; connectFacebook?: boolean; connectInstagram?: boolean }>;
}) {
  return apiRequest<SocialAccountDto[]>('/social/meta/accounts/connect', { method: 'POST', body });
}

export async function listSocialAccounts(activeOnly = false) {
  const q = activeOnly ? '?active=true' : '';
  return apiRequest<SocialAccountDto[]>(`/social/accounts${q}`);
}

export async function updateSocialAccount(
  id: string,
  body: { socialBrandId?: string | null; isActive?: boolean },
) {
  return apiRequest<SocialAccountDto>(`/social/accounts/${id}`, { method: 'PATCH', body });
}

export async function disconnectSocialAccount(id: string) {
  return apiRequest<SocialAccountDto>(`/social/accounts/${id}`, { method: 'DELETE' });
}

export async function publishContent(id: string, destinationIds?: string[]) {
  return apiRequest<{
    content: SocialContentDto;
    results: Array<{ destinationId: string; status: SocialPublicationStatus; errorMessage?: string }>;
  }>(`/social/contents/${id}/publish`, {
    method: 'POST',
    body: destinationIds?.length ? { destinationIds } : {},
  });
}
