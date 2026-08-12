import type { SocialPublicationStatus } from '@prisma/client';
import { publishSocialContentSchema, type PublishSocialContentInput } from '@woonwork/shared';
import { hasMinRole } from '@woonwork/shared';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { AccessContext } from './contentAccess.service';
import { MetaApiError, isTokenInvalidError, userFacingMetaMessage } from './meta/metaGraphClient';
import { markAccountExpired } from './socialAccount.service';
import { getPublisher } from './social/publisherRegistry';
import { decryptStoredToken } from './tokenEncryption.service';
import * as contentService from './socialContent.service';
import * as hashtagService from './socialHashtag.service';

type DestinationWithAccount = {
  id: string;
  tenantId: string;
  socialContentId: string;
  socialAccountId: string;
  platform: 'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN' | 'PINTEREST' | 'YOUTUBE';
  publicationStatus: SocialPublicationStatus;
  externalPostId: string | null;
  attemptCount: number;
  account: {
    id: string;
    tenantId: string;
    socialConnectionId: string;
    platform: 'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN' | 'PINTEREST' | 'YOUTUBE';
    externalAccountId: string;
    parentExternalId: string | null;
    name: string;
    username: string | null;
    isActive: boolean;
    connectionStatus: string;
    accessTokenEncrypted: string | null;
    accessTokenIv: string | null;
    accessTokenTag: string | null;
  };
};

function logPublish(meta: {
  tenantId: string;
  contentId: string;
  destinationId: string;
  platform: string;
  result: string;
  metaRequestId?: string | null;
  errorCode?: string | null;
}) {
  console.info('[social-publish]', {
    tenantId: meta.tenantId,
    contentId: meta.contentId,
    destinationId: meta.destinationId,
    platform: meta.platform,
    result: meta.result,
    metaRequestId: meta.metaRequestId ?? null,
    errorCode: meta.errorCode ?? null,
  });
}

async function syncContentPublishedFlag(contentId: string, tenantId: string) {
  const destinations = await prisma.socialContentDestination.findMany({
    where: { tenantId, socialContentId: contentId },
    select: { publicationStatus: true },
  });
  if (!destinations.length) return;
  const allPublished = destinations.every((d) => d.publicationStatus === 'PUBLISHED');
  if (!allPublished) return;

  const existing = await prisma.socialContent.findFirst({
    where: { id: contentId, tenantId },
    select: { published: true, publishedAt: true, contentText: true, socialBrandId: true },
  });
  if (!existing) return;

  const usedAt = existing.publishedAt ?? new Date();
  await prisma.socialContent.update({
    where: { id: contentId },
    data: {
      published: true,
      publishedAt: usedAt,
      status: 'PUBLISHED',
      approved: true,
      readyToPublish: true,
    },
  });
  await hashtagService.applyHashtagUsageOnFirstPublish({
    tenantId,
    wasPublished: existing.published,
    socialBrandId: existing.socialBrandId,
    contentText: existing.contentText,
    usedAt,
  });
}

export async function publishContent(ctx: AccessContext, contentId: string, raw?: PublishSocialContentInput) {
  if (!hasMinRole(ctx.tenantRole, 'MEMBER')) {
    throw new AppError(403, 'FORBIDDEN', 'Yayınlama yetkiniz yok');
  }
  const input = publishSocialContentSchema.parse(raw ?? {});
  const content = await contentService.getContent(ctx, contentId);

  if (!content.approved || !content.readyToPublish) {
    throw new AppError(
      400,
      'WORKFLOW_NOT_READY',
      !content.approved
        ? 'Yayınlamak için içerik onaylanmış olmalı.'
        : 'Yayınlamak için içerik yayına hazır olmalı.',
    );
  }

  await hashtagService.assertNoBlockedHashtags(ctx, content);

  const destinations = (await prisma.socialContentDestination.findMany({
    where: {
      tenantId: ctx.tenantId,
      socialContentId: contentId,
      ...(input.destinationIds?.length ? { id: { in: input.destinationIds } } : {}),
    },
    include: { account: true },
  })) as DestinationWithAccount[];

  if (input.destinationIds?.length && destinations.length !== input.destinationIds.length) {
    throw new AppError(404, 'DESTINATION_NOT_FOUND', 'Yayın hedefi bulunamadı');
  }
  if (!destinations.length) {
    const platforms = content.platforms.map((p) => p.platform);
    if (platforms.includes('INSTAGRAM') || platforms.includes('FACEBOOK')) {
      throw new AppError(
        400,
        'ACCOUNT_NOT_CONNECTED',
        platforms.includes('INSTAGRAM') && !platforms.includes('FACEBOOK')
          ? 'Instagram hesabı bağlı değil.'
          : platforms.includes('FACEBOOK') && !platforms.includes('INSTAGRAM')
            ? 'Facebook hesabı bağlı değil.'
            : 'Yayınlanacak hesap bağlı değil.',
      );
    }
    throw new AppError(400, 'NO_DESTINATIONS', 'Yayınlanacak hesap seçilmedi.');
  }

  const results: Array<{ destinationId: string; status: SocialPublicationStatus; errorMessage?: string }> = [];

  for (const destination of destinations) {
    if (destination.publicationStatus === 'PUBLISHED') {
      results.push({ destinationId: destination.id, status: 'PUBLISHED' });
      continue;
    }
    if (destination.publicationStatus === 'PUBLISHING') {
      results.push({ destinationId: destination.id, status: 'PUBLISHING' });
      continue;
    }
    if (!destination.account.isActive) {
      await prisma.socialContentDestination.update({
        where: { id: destination.id },
        data: {
          publicationStatus: 'FAILED',
          errorCode: 'ACCOUNT_INACTIVE',
          errorMessage: `${destination.platform === 'INSTAGRAM' ? 'Instagram' : 'Facebook'} hesabı bağlı değil.`,
          lastAttemptAt: new Date(),
          attemptCount: { increment: 1 },
        },
      });
      results.push({
        destinationId: destination.id,
        status: 'FAILED',
        errorMessage: `${destination.platform === 'INSTAGRAM' ? 'Instagram' : 'Facebook'} hesabı bağlı değil.`,
      });
      continue;
    }
    if (destination.account.connectionStatus === 'EXPIRED' || destination.account.connectionStatus === 'REVOKED') {
      await prisma.socialContentDestination.update({
        where: { id: destination.id },
        data: {
          publicationStatus: 'FAILED',
          errorCode: 'ACCOUNT_EXPIRED',
          errorMessage: 'Meta erişim izni geçersiz veya süresi dolmuş.',
          lastAttemptAt: new Date(),
          attemptCount: { increment: 1 },
        },
      });
      results.push({
        destinationId: destination.id,
        status: 'FAILED',
        errorMessage: 'Meta erişim izni geçersiz veya süresi dolmuş.',
      });
      continue;
    }

    await prisma.socialContentDestination.update({
      where: { id: destination.id },
      data: {
        publicationStatus: 'PUBLISHING',
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 },
        errorCode: null,
        errorMessage: null,
      },
    });

    try {
      const publisher = getPublisher(destination.platform);
      const accessToken = decryptStoredToken(destination.account);
      const published = await publisher.publish({
        contentId: content.id,
        destinationId: destination.id,
        tenantId: ctx.tenantId,
        platform: destination.platform,
        contentType: content.contentType,
        title: content.title,
        contentText: content.contentText,
        media: content.media.map((m) => ({
          url: m.mediaAsset.url || '',
          mimeType: m.mediaAsset.mimeType,
          category: m.mediaAsset.category,
          position: m.position,
        })),
        account: {
          id: destination.account.id,
          externalAccountId: destination.account.externalAccountId,
          parentExternalId: destination.account.parentExternalId,
          platform: destination.account.platform,
          name: destination.account.name,
          username: destination.account.username,
        },
        accessToken,
      });

      await prisma.socialContentDestination.update({
        where: { id: destination.id },
        data: {
          publicationStatus: 'PUBLISHED',
          externalPostId: published.externalPostId,
          externalContainerId: published.externalContainerId ?? undefined,
          permalink: published.permalink ?? undefined,
          publishedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      });
      logPublish({
        tenantId: ctx.tenantId,
        contentId: content.id,
        destinationId: destination.id,
        platform: destination.platform,
        result: 'PUBLISHED',
        metaRequestId: published.metaRequestId,
      });
      results.push({ destinationId: destination.id, status: 'PUBLISHED' });
    } catch (error) {
      const metaError = error instanceof MetaApiError ? error : null;
      if (isTokenInvalidError(error)) {
        await markAccountExpired(destination.account.id, destination.account.socialConnectionId);
      }
      const appError = !metaError && error instanceof AppError ? error : null;
      const message = metaError
        ? userFacingMetaMessage(metaError)
        : appError
          ? appError.message
          : 'Yayın başarısız oldu';
      const code = metaError
        ? `META_${metaError.code}`
        : appError
          ? String(appError.code)
          : 'PUBLISH_FAILED';

      await prisma.socialContentDestination.update({
        where: { id: destination.id },
        data: {
          publicationStatus: 'FAILED',
          errorCode: code.slice(0, 80),
          errorMessage: message.slice(0, 500),
        },
      });
      logPublish({
        tenantId: ctx.tenantId,
        contentId: content.id,
        destinationId: destination.id,
        platform: destination.platform,
        result: 'FAILED',
        metaRequestId: metaError?.requestId ?? null,
        errorCode: code,
      });
      results.push({ destinationId: destination.id, status: 'FAILED', errorMessage: message });
    }
  }

  await syncContentPublishedFlag(contentId, ctx.tenantId);
  const updated = await contentService.getContent(ctx, contentId);
  return { content: updated, results };
}
