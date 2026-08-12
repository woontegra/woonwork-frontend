import { AppError } from '../../lib/errors';
import { metaGet, metaPost, type MetaGraphResult } from '../meta/metaGraphClient';
import { assertPublicMediaUrl } from './mediaUrl.util';
import type { PublishContentInput, PublishResult, SocialPublisher } from './socialPublisher';

type FeedResponse = { id?: string };
type PhotoResponse = { id?: string; post_id?: string };
type VideoResponse = { id?: string };

export class MetaFacebookPublisher implements SocialPublisher {
  platform = 'FACEBOOK' as const;

  validateContent(input: PublishContentInput): void {
    if (input.platform !== 'FACEBOOK') {
      throw new AppError(400, 'PLATFORM_MISMATCH', 'Facebook yayıncısı yalnızca Facebook hesapları için');
    }
    if (['STORY', 'CAROUSEL', 'REEL', 'SHORT', 'PIN', 'ARTICLE'].includes(input.contentType)) {
      throw new AppError(
        400,
        'PLATFORM_CONTENT_NOT_SUPPORTED',
        'Bu içerik tipi Facebook Sayfası için henüz desteklenmiyor',
      );
    }
    const hasText = Boolean(input.contentText?.trim());
    const images = input.media.filter((m) => m.category === 'IMAGE' && m.url);
    const videos = input.media.filter((m) => m.category === 'VIDEO' && m.url);
    if (input.contentType === 'VIDEO') {
      if (!videos.length) {
        throw new AppError(400, 'PLATFORM_CONTENT_NOT_SUPPORTED', 'Facebook video için video medyası gerekli');
      }
      return;
    }
    if (!hasText && !images.length && !videos.length) {
      throw new AppError(400, 'PLATFORM_CONTENT_NOT_SUPPORTED', 'Facebook gönderisi için metin veya medya gerekli');
    }
    if (images.length > 1 && !videos.length) {
      throw new AppError(
        400,
        'PLATFORM_CONTENT_NOT_SUPPORTED',
        'Facebook çoklu görsel (carousel) bu sürümde desteklenmiyor',
      );
    }
  }

  async publish(input: PublishContentInput): Promise<PublishResult> {
    this.validateContent(input);
    const pageId = input.account.externalAccountId;
    const caption = input.contentText?.trim() || input.title;
    const images = input.media.filter((m) => m.category === 'IMAGE' && m.url);
    const videos = input.media.filter((m) => m.category === 'VIDEO' && m.url);

    if (input.contentType === 'VIDEO' || (videos.length && !images.length && input.contentType !== 'POST')) {
      await assertPublicMediaUrl(videos[0].url);
      const posted = await metaPost<VideoResponse>(
        `${pageId}/videos`,
        input.accessToken,
        {
          file_url: videos[0].url,
          description: caption,
        },
        60000,
      );
      const id = posted.data.id;
      if (!id) throw new AppError(502, 'META_PUBLISH_FAILED', 'Facebook video kimliği alınamadı');
      const permalink = await this.tryPermalink(id, input.accessToken, posted.requestId);
      return { externalPostId: id, permalink, metaRequestId: posted.requestId };
    }

    if (videos.length && input.contentType === 'POST' && !images.length) {
      await assertPublicMediaUrl(videos[0].url);
      const posted = await metaPost<VideoResponse>(
        `${pageId}/videos`,
        input.accessToken,
        { file_url: videos[0].url, description: caption },
        60000,
      );
      const id = posted.data.id;
      if (!id) throw new AppError(502, 'META_PUBLISH_FAILED', 'Facebook video kimliği alınamadı');
      const permalink = await this.tryPermalink(id, input.accessToken, posted.requestId);
      return { externalPostId: id, permalink, metaRequestId: posted.requestId };
    }

    if (images.length === 1) {
      await assertPublicMediaUrl(images[0].url);
      const posted = await metaPost<PhotoResponse>(
        `${pageId}/photos`,
        input.accessToken,
        {
          url: images[0].url,
          caption,
          message: caption,
        },
        45000,
      );
      const id = posted.data.post_id || posted.data.id;
      if (!id) throw new AppError(502, 'META_PUBLISH_FAILED', 'Facebook görsel kimliği alınamadı');
      const permalink = await this.tryPermalink(id, input.accessToken, posted.requestId);
      return { externalPostId: id, permalink, metaRequestId: posted.requestId };
    }

    const posted = await metaPost<FeedResponse>(
      `${pageId}/feed`,
      input.accessToken,
      { message: caption },
      30000,
    );
    const id = posted.data.id;
    if (!id) throw new AppError(502, 'META_PUBLISH_FAILED', 'Facebook gönderi kimliği alınamadı');
    const permalink = await this.tryPermalink(id, input.accessToken, posted.requestId);
    return { externalPostId: id, permalink, metaRequestId: posted.requestId };
  }

  private async tryPermalink(
    id: string,
    token: string,
    fallbackRequestId: string | null,
  ): Promise<string | null> {
    try {
      const res: MetaGraphResult<{ permalink_url?: string }> = await metaGet(
        id,
        token,
        { fields: 'permalink_url' },
      );
      return res.data.permalink_url ?? null;
    } catch {
      void fallbackRequestId;
      return null;
    }
  }
}
