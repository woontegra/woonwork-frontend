import { AppError } from '../../lib/errors';

const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|\[::1\]|0\.0\.0\.0)/i;

export async function assertPublicMediaUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError(400, 'MEDIA_URL_INVALID', 'Medya URL’si geçersiz');
  }

  if (parsed.protocol !== 'https:') {
    throw new AppError(
      400,
      'MEDIA_URL_NOT_PUBLIC',
      'Bu medya Instagram tarafından dışarıdan erişilebilir değil. Yayınlamak için herkese açık bir medya URL’si gerekiyor.',
    );
  }

  if (PRIVATE_HOST_RE.test(parsed.hostname)) {
    throw new AppError(
      400,
      'MEDIA_URL_NOT_PUBLIC',
      'Bu medya Instagram tarafından dışarıdan erişilebilir değil. Yayınlamak için herkese açık bir medya URL’si gerekiyor.',
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    let res = await fetch(parsed, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'WoonWork-MediaPreflight/1.0' },
    });
    if (res.status === 405 || res.status === 501 || res.status === 403) {
      res = await fetch(parsed, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'WoonWork-MediaPreflight/1.0',
          Range: 'bytes=0-64',
        },
      });
    }
    if (!res.ok) {
      throw new AppError(
        400,
        'MEDIA_URL_NOT_PUBLIC',
        'Bu medya Instagram tarafından dışarıdan erişilebilir değil. Yayınlamak için herkese açık bir medya URL’si gerekiyor.',
      );
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      400,
      'MEDIA_URL_NOT_PUBLIC',
      'Bu medya Instagram tarafından dışarıdan erişilebilir değil. Yayınlamak için herkese açık bir medya URL’si gerekiyor.',
    );
  } finally {
    clearTimeout(timeout);
  }
}
