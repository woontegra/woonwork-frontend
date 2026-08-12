import { del, put } from '@vercel/blob';
import type { StorageProvider, UploadParams, UploadResult } from './StorageProvider';
import { AppError } from '../lib/errors';
import { env } from '../config/env';

/**
 * Server-side blob operations (delete / optional put).
 * Browser uploads use @vercel/blob/client + handleUpload endpoint.
 */
export class VercelBlobProvider implements StorageProvider {
  readonly name = 'vercel-blob';

  private token() {
    if (!env.BLOB_READ_WRITE_TOKEN) {
      throw new AppError(
        501,
        'STORAGE_NOT_CONFIGURED',
        'Vercel Blob depolama henüz yapılandırılmadı',
      );
    }
    return env.BLOB_READ_WRITE_TOKEN;
  }

  async upload(params: UploadParams): Promise<UploadResult> {
    const result = await put(params.fileName, params.data, {
      access: 'public',
      token: this.token(),
      contentType: params.mimeType,
    });
    return {
      storageKey: result.pathname,
      url: result.url,
      size: params.data.byteLength,
    };
  }

  async delete(storageKeyOrUrl: string): Promise<void> {
    await del(storageKeyOrUrl, { token: this.token() });
  }

  async getSignedUrl(storageKey: string, _expiresInSeconds = 3600): Promise<string> {
    // Public blobs; return key/url as-is for now
    return storageKey;
  }
}
