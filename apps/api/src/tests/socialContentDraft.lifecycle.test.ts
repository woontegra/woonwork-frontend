import { describe, expect, it } from 'vitest';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import * as contentService from '../services/socialContent.service';

describe('SocialContent draft lifecycle (backend contract)', () => {
  it('addMedia geçersiz contentId ile SocialContent oluşturmaz', async () => {
    const countBefore = await prisma.socialContent.count();
    await expect(
      contentService.addMedia(
        { tenantId: 'missing', userId: 'missing', tenantRole: 'OWNER' },
        'nonexistent-content-id',
        { mediaAssetId: 'nonexistent-media' },
      ),
    ).rejects.toBeTruthy();
    const countAfter = await prisma.socialContent.count();
    expect(countAfter).toBe(countBefore);
  });

  it('addMedia hata kodu içerik bulunamadı veya yetki', async () => {
    try {
      await contentService.addMedia(
        { tenantId: 'missing', userId: 'missing', tenantRole: 'OWNER' },
        'nonexistent-content-id',
        { mediaAssetId: 'nonexistent-media' },
      );
      expect.unreachable('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
    }
  });
});
