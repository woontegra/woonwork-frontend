import type { SocialPlatform } from '@prisma/client';
import { AppError } from '../../lib/errors';
import { MetaFacebookPublisher } from './metaFacebookPublisher';
import { MetaInstagramPublisher } from './metaInstagramPublisher';
import type { SocialPublisher } from './socialPublisher';

const facebookPublisher = new MetaFacebookPublisher();
const instagramPublisher = new MetaInstagramPublisher();

export function getPublisher(platform: SocialPlatform): SocialPublisher {
  if (platform === 'FACEBOOK') return facebookPublisher;
  if (platform === 'INSTAGRAM') return instagramPublisher;
  throw new AppError(
    400,
    'PLATFORM_CONTENT_NOT_SUPPORTED',
    `${platform} yayını bu sürümde desteklenmiyor`,
  );
}
