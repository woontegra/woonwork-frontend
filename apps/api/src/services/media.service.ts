import { randomUUID } from 'crypto';
import { del, type PutBlobResult } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import {
  MediaCategory,
  MEDIA_MIME_MAP,
  detectMediaCategory,
  finalizeMediaSchema,
  type FinalizeMediaInput,
} from '@woonwork/shared';
import type { MediaCategory as PrismaMediaCategory } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';

function requireBlobToken() {
  if (!env.BLOB_READ_WRITE_TOKEN) {
    throw new AppError(501, 'BLOB_NOT_CONFIGURED', 'Vercel Blob token yapılandırılmamış');
  }
  return env.BLOB_READ_WRITE_TOKEN;
}

function safeFileName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'file';
}

export function buildStoragePath(tenantId: string, originalFileName: string) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safe = safeFileName(originalFileName);
  return `tenants/${tenantId}/media/${year}/${month}/${randomUUID()}-${safe}`;
}

function maxBytesForCategory(category: MediaCategory) {
  if (category === MediaCategory.IMAGE) return env.MAX_IMAGE_UPLOAD_MB * 1024 * 1024;
  if (category === MediaCategory.VIDEO) return env.MAX_VIDEO_UPLOAD_MB * 1024 * 1024;
  return env.MAX_DOCUMENT_UPLOAD_MB * 1024 * 1024;
}

export function assertAllowedFile(mimeType: string, fileName: string, size: number) {
  const category = detectMediaCategory(mimeType, fileName);
  if (category === MediaCategory.OTHER) {
    throw new AppError(400, 'INVALID_FILE_TYPE', 'Desteklenmeyen dosya türü');
  }

  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const map = MEDIA_MIME_MAP[category === MediaCategory.DOCUMENT ? 'DOCUMENT' : category];
  const mimeOk = (map.mimes as readonly string[]).includes(mimeType.toLowerCase());
  const extOk = (map.extensions as readonly string[]).includes(ext);
  if (!mimeOk || !extOk) {
    throw new AppError(400, 'INVALID_FILE_TYPE', 'Dosya uzantısı ve MIME türü uyuşmuyor');
  }

  const max = maxBytesForCategory(category);
  if (size > max) {
    throw new AppError(400, 'FILE_TOO_LARGE', `Dosya boyutu limiti aşıldı (${Math.round(max / (1024 * 1024))} MB)`);
  }

  return category;
}

export async function listMedia(
  tenantId: string,
  filters: {
    q?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 24));
  const where = {
    tenantId,
    ...(filters.category ? { category: filters.category as PrismaMediaCategory } : {}),
    ...(filters.q
      ? {
          OR: [
            { originalFileName: { contains: filters.q, mode: 'insensitive' as const } },
            { fileName: { contains: filters.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { blocks: true } },
      },
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getMedia(tenantId: string, id: string) {
  const asset = await prisma.mediaAsset.findFirst({
    where: { id, tenantId },
    include: {
      uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { blocks: true } },
    },
  });
  if (!asset) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Medya bulunamadı');
  return asset;
}

export async function getUsage(tenantId: string) {
  const assets = await prisma.mediaAsset.findMany({
    where: { tenantId },
    select: { size: true, category: true },
  });

  let totalBytes = 0;
  let imageBytes = 0;
  let videoBytes = 0;
  let documentBytes = 0;

  for (const asset of assets) {
    totalBytes += asset.size;
    if (asset.category === 'IMAGE') imageBytes += asset.size;
    else if (asset.category === 'VIDEO') videoBytes += asset.size;
    else documentBytes += asset.size;
  }

  return {
    totalBytes,
    imageBytes,
    videoBytes,
    documentBytes,
    assetCount: assets.length,
  };
}

async function createMediaRecord(params: {
  tenantId: string;
  userId: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url: string;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
}) {
  const category = assertAllowedFile(params.mimeType, params.originalFileName, params.size);
  const existing = await prisma.mediaAsset.findFirst({
    where: { tenantId: params.tenantId, storageKey: params.storageKey },
  });
  if (existing) return existing;

  return prisma.mediaAsset.create({
    data: {
      tenantId: params.tenantId,
      uploadedById: params.userId,
      originalFileName: params.originalFileName,
      fileName: params.originalFileName,
      mimeType: params.mimeType,
      size: params.size,
      storageProvider: 'vercel-blob',
      storageKey: params.storageKey,
      url: params.url,
      width: params.width ?? null,
      height: params.height ?? null,
      duration: params.duration ?? null,
      category,
    },
    include: {
      uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { blocks: true } },
    },
  });
}

export async function finalizeMedia(
  tenantId: string,
  userId: string,
  raw: FinalizeMediaInput,
) {
  const input = finalizeMediaSchema.parse(raw);

  if (!input.storageKey.startsWith(`tenants/${tenantId}/media/`)) {
    throw new AppError(403, 'INVALID_STORAGE_KEY', 'Depolama anahtarı bu çalışma alanına ait değil');
  }

  return createMediaRecord({
    tenantId,
    userId,
    originalFileName: input.originalFileName,
    mimeType: input.mimeType,
    size: input.size,
    storageKey: input.storageKey,
    url: input.url,
    width: input.width,
    height: input.height,
    duration: input.duration,
  });
}

export async function handleClientUpload(params: {
  tenantId: string;
  userId: string;
  body: HandleUploadBody;
  request: Request;
}) {
  requireBlobToken();

  const jsonResponse = await handleUpload({
    body: params.body,
    request: params.request,
    token: env.BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      let payload: { originalFileName?: string; mimeType?: string; size?: number } = {};
      try {
        payload = clientPayload ? (JSON.parse(clientPayload) as typeof payload) : {};
      } catch {
        throw new AppError(400, 'INVALID_PAYLOAD', 'Geçersiz yükleme bilgisi');
      }

      const originalFileName = payload.originalFileName || pathname.split('/').pop() || 'file';
      const mimeType = payload.mimeType || 'application/octet-stream';
      const size = Number(payload.size || 0);
      const category = assertAllowedFile(mimeType, originalFileName, size || 1);

      const expectedPrefix = `tenants/${params.tenantId}/media/`;
      if (!pathname.startsWith(expectedPrefix)) {
        throw new AppError(403, 'INVALID_PATH', 'Yükleme yolu geçersiz');
      }

      const allowed =
        category === MediaCategory.IMAGE
          ? [...MEDIA_MIME_MAP.IMAGE.mimes]
          : category === MediaCategory.VIDEO
            ? [...MEDIA_MIME_MAP.VIDEO.mimes]
            : [...MEDIA_MIME_MAP.DOCUMENT.mimes];

      return {
        allowedContentTypes: allowed,
        maximumSizeInBytes: maxBytesForCategory(category),
        tokenPayload: JSON.stringify({
          tenantId: params.tenantId,
          userId: params.userId,
          originalFileName,
          mimeType,
          size,
          category,
        }),
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      try {
        const payload = tokenPayload
          ? (JSON.parse(tokenPayload) as {
              tenantId: string;
              userId: string;
              originalFileName: string;
              mimeType: string;
              size: number;
            })
          : null;
        if (!payload) return;
        await createMediaRecord({
          tenantId: payload.tenantId,
          userId: payload.userId,
          originalFileName: payload.originalFileName,
          mimeType: payload.mimeType || blob.contentType,
          size: payload.size || 0,
          storageKey: blob.pathname,
          url: blob.url,
        });
      } catch (error) {
        console.error('onUploadCompleted media kayıt hatası', error);
      }
    },
  });

  return jsonResponse;
}

export async function deleteMedia(tenantId: string, id: string, force = false) {
  const asset = await getMedia(tenantId, id);
  const refs = asset._count.blocks;

  if (refs > 0 && !force) {
    throw new AppError(409, 'MEDIA_IN_USE', 'Bu dosya içeriklerde kullanılıyor', {
      inUse: true,
      references: refs,
    });
  }

  if (refs > 0 && force) {
    await prisma.block.updateMany({
      where: { tenantId, mediaAssetId: id },
      data: { mediaAssetId: null },
    });
  }

  try {
    if (env.BLOB_READ_WRITE_TOKEN) {
      await del(asset.url || asset.storageKey, { token: env.BLOB_READ_WRITE_TOKEN });
    }
  } catch (error) {
    console.error('Blob silme hatası', error);
  }

  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  return { deleted: true };
}

export type { PutBlobResult };
