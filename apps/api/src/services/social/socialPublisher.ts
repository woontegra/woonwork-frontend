import type { SocialContentType, SocialPlatform } from '@prisma/client';

export type PublishMedia = {
  url: string;
  mimeType: string;
  category: string;
  position: number;
};

export type PublishContentInput = {
  contentId: string;
  destinationId: string;
  tenantId: string;
  platform: SocialPlatform;
  contentType: SocialContentType;
  title: string;
  contentText: string | null;
  media: PublishMedia[];
  account: {
    id: string;
    externalAccountId: string;
    parentExternalId: string | null;
    platform: SocialPlatform;
    name: string;
    username: string | null;
  };
  accessToken: string;
};

export type PublishResult = {
  externalPostId: string;
  externalContainerId?: string | null;
  permalink?: string | null;
  metaRequestId?: string | null;
};

export interface SocialPublisher {
  platform: SocialPlatform;
  validateContent(input: PublishContentInput): void;
  publish(input: PublishContentInput): Promise<PublishResult>;
}
