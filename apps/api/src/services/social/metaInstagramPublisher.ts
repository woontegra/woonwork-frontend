import { INSTAGRAM_CAROUSEL_LIMITS } from '@woonwork/shared';
import { AppError } from '../../lib/errors';
import { metaGet, metaPost } from '../meta/metaGraphClient';
import { assertPublicMediaUrl } from './mediaUrl.util';
import type { PublishContentInput, PublishResult, SocialPublisher } from './socialPublisher';

type ContainerResponse = { id?: string };
type PublishResponse = { id?: string };
type StatusResponse = { status_code?: string; status?: string };

const POLL_MAX_ATTEMPTS = 24;
const POLL_START_MS = 2000;
const POLL_MAX_MS = 8000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MetaInstagramPublisher implements SocialPublisher {
  platform = 'INSTAGRAM' as const;

  validateContent(input: PublishContentInput): void {
    if (input.platform !== 'INSTAGRAM') {
      throw new AppError(400, 'PLATFORM_MISMATCH', 'Instagram yayıncısı yalnızca Instagram hesapları için');
    }
    if (input.contentType === 'STORY') {
      throw new AppError(
        400,
        'PLATFORM_CONTENT_NOT_SUPPORTED',
        'Hikâye yayını Meta entegrasyonunun sonraki sürümünde desteklenecek.',
      );
    }
    const media = input.media.filter((m) => m.url);
    if (input.contentType === 'CAROUSEL') {
      if (media.length < INSTAGRAM_CAROUSEL_LIMITS.min || media.length > INSTAGRAM_CAROUSEL_LIMITS.max) {
        throw new AppError(
          400,
          'PLATFORM_CONTENT_NOT_SUPPORTED',
          `Instagram carousel ${INSTAGRAM_CAROUSEL_LIMITS.min}–${INSTAGRAM_CAROUSEL_LIMITS.max} medya gerektirir`,
        );
      }
      return;
    }
    if (input.contentType === 'REEL' || input.contentType === 'VIDEO') {
      if (!media.some((m) => m.category === 'VIDEO')) {
        throw new AppError(400, 'PLATFORM_CONTENT_NOT_SUPPORTED', 'Instagram video/reel için video medyası gerekli');
      }
      return;
    }
    if (input.contentType === 'POST') {
      if (!media.some((m) => m.category === 'IMAGE')) {
        throw new AppError(400, 'PLATFORM_CONTENT_NOT_SUPPORTED', 'Instagram gönderisi için görsel gerekli');
      }
      if (media.filter((m) => m.category === 'IMAGE').length > 1) {
        throw new AppError(
          400,
          'PLATFORM_CONTENT_NOT_SUPPORTED',
          'Birden fazla görsel için içerik tipini Carousel olarak seçin',
        );
      }
      return;
    }
    throw new AppError(
      400,
      'PLATFORM_CONTENT_NOT_SUPPORTED',
      'Bu içerik tipi Instagram için henüz desteklenmiyor',
    );
  }

  async publish(input: PublishContentInput): Promise<PublishResult> {
    this.validateContent(input);
    const igUserId = input.account.externalAccountId;
    const caption = input.contentText?.trim() || undefined;
    const media = [...input.media].filter((m) => m.url).sort((a, b) => a.position - b.position);

    if (input.contentType === 'CAROUSEL') {
      return this.publishCarousel(igUserId, input.accessToken, media, caption);
    }

    if (input.contentType === 'REEL' || input.contentType === 'VIDEO') {
      const video = media.find((m) => m.category === 'VIDEO')!;
      await assertPublicMediaUrl(video.url);
      const created = await metaPost<ContainerResponse>(
        `${igUserId}/media`,
        input.accessToken,
        {
          media_type: 'REELS',
          video_url: video.url,
          ...(caption ? { caption } : {}),
        },
        45000,
      );
      const containerId = created.data.id;
      if (!containerId) throw new AppError(502, 'META_PUBLISH_FAILED', 'Instagram video kabı oluşturulamadı');
      await this.waitUntilReady(containerId, input.accessToken);
      return this.publishContainer(igUserId, containerId, input.accessToken, created.requestId);
    }

    const image = media.find((m) => m.category === 'IMAGE')!;
    await assertPublicMediaUrl(image.url);
    const created = await metaPost<ContainerResponse>(
      `${igUserId}/media`,
      input.accessToken,
      {
        image_url: image.url,
        ...(caption ? { caption } : {}),
      },
      45000,
    );
    const containerId = created.data.id;
    if (!containerId) throw new AppError(502, 'META_PUBLISH_FAILED', 'Instagram görsel kabı oluşturulamadı');
    return this.publishContainer(igUserId, containerId, input.accessToken, created.requestId);
  }

  private async publishCarousel(
    igUserId: string,
    token: string,
    media: PublishContentInput['media'],
    caption?: string,
  ): Promise<PublishResult> {
    const childIds: string[] = [];
    for (const item of media) {
      await assertPublicMediaUrl(item.url);
      const body: Record<string, unknown> = { is_carousel_item: true };
      if (item.category === 'VIDEO') {
        body.media_type = 'REELS';
        body.video_url = item.url;
      } else {
        body.image_url = item.url;
      }
      const child = await metaPost<ContainerResponse>(`${igUserId}/media`, token, body, 45000);
      const childId = child.data.id;
      if (!childId) throw new AppError(502, 'META_PUBLISH_FAILED', 'Instagram carousel öğesi oluşturulamadı');
      if (item.category === 'VIDEO') {
        await this.waitUntilReady(childId, token);
      }
      childIds.push(childId);
    }

    const parent = await metaPost<ContainerResponse>(
      `${igUserId}/media`,
      token,
      {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        ...(caption ? { caption } : {}),
      },
      45000,
    );
    const containerId = parent.data.id;
    if (!containerId) throw new AppError(502, 'META_PUBLISH_FAILED', 'Instagram carousel kabı oluşturulamadı');
    await this.waitUntilReady(containerId, token);
    return this.publishContainer(igUserId, containerId, token, parent.requestId);
  }

  private async waitUntilReady(containerId: string, token: string) {
    let delay = POLL_START_MS;
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      const status = await metaGet<StatusResponse>(containerId, token, { fields: 'status_code,status' });
      const code = (status.data.status_code || status.data.status || '').toUpperCase();
      if (code === 'FINISHED' || code === 'PUBLISHED') return;
      if (code === 'ERROR' || code === 'EXPIRED') {
        throw new AppError(502, 'IG_MEDIA_PROCESSING_FAILED', 'Instagram medya işleme tamamlanamadı.');
      }
      await sleep(delay);
      delay = Math.min(Math.round(delay * 1.4), POLL_MAX_MS);
    }
    throw new AppError(504, 'IG_MEDIA_PROCESSING_TIMEOUT', 'Instagram medya işleme zaman aşımına uğradı.');
  }

  private async publishContainer(
    igUserId: string,
    containerId: string,
    token: string,
    metaRequestId: string | null,
  ): Promise<PublishResult> {
    const published = await metaPost<PublishResponse>(
      `${igUserId}/media_publish`,
      token,
      { creation_id: containerId },
      45000,
    );
    const id = published.data.id;
    if (!id) throw new AppError(502, 'META_PUBLISH_FAILED', 'Instagram yayın kimliği alınamadı');
    let permalink: string | null = null;
    try {
      const link = await metaGet<{ permalink?: string }>(id, token, { fields: 'permalink' });
      permalink = link.data.permalink ?? null;
    } catch {
      permalink = null;
    }
    return {
      externalPostId: id,
      externalContainerId: containerId,
      permalink,
      metaRequestId: published.requestId || metaRequestId,
    };
  }
}
