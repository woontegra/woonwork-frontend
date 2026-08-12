import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { PrismaClient, TenantRole } from '@prisma/client';
import { AppError } from '../lib/errors';
import { MetaApiError } from '../services/meta/metaGraphClient';

vi.mock('../services/meta/metaGraphClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/meta/metaGraphClient')>();
  return {
    ...actual,
    metaGet: vi.fn(),
    metaPost: vi.fn(),
    exchangeOauthCode: vi.fn(),
    exchangeLongLivedUserToken: vi.fn(),
    buildMetaOauthUrl: vi.fn((state: string) => `https://www.facebook.com/v21.0/dialog/oauth?state=${state}`),
    assertMetaConfigured: vi.fn(),
    metaConfigured: vi.fn(() => true),
  };
});

vi.mock('../services/social/mediaUrl.util', () => ({
  assertPublicMediaUrl: vi.fn(async (url: string) => {
    if (!url || url.includes('private') || url.includes('example.com')) {
      const { AppError } = await import('../lib/errors');
      throw new AppError(
        400,
        'MEDIA_URL_NOT_PUBLIC',
        'Bu medya Instagram tarafından dışarıdan erişilebilir değil. Yayınlamak için herkese açık bir medya URL’si gerekiyor.',
      );
    }
  }),
}));

import { metaGet, metaPost, exchangeOauthCode, exchangeLongLivedUserToken } from '../services/meta/metaGraphClient';
import { assertPublicMediaUrl } from '../services/social/mediaUrl.util';
import * as oauthService from '../services/socialOAuth.service';
import * as accountService from '../services/socialAccount.service';
import * as publishService from '../services/socialPublish.service';
import * as contentService from '../services/socialContent.service';
import * as brandService from '../services/socialBrand.service';

const prisma = new PrismaClient();
const metaGetMock = vi.mocked(metaGet);
const metaPostMock = vi.mocked(metaPost);
const exchangeCodeMock = vi.mocked(exchangeOauthCode);
const exchangeLongMock = vi.mocked(exchangeLongLivedUserToken);
const publicUrlMock = vi.mocked(assertPublicMediaUrl);

const ids = {
  tenantA: '',
  tenantB: '',
  userA: '',
  userB: '',
  brandA: '',
  mediaPublic: '',
  mediaPrivate: '',
  mediaVideo: '',
  mediaSlide: '',
};

function ctxA() {
  return { tenantId: ids.tenantA, userId: ids.userA, tenantRole: TenantRole.OWNER };
}
function ctxB() {
  return { tenantId: ids.tenantB, userId: ids.userB, tenantRole: TenantRole.OWNER };
}

function pageList() {
  return {
    data: {
      data: [
        {
          id: 'page-1',
          name: 'Bilirkişi Hesap',
          access_token: 'PAGE_TOKEN_1',
          tasks: ['MANAGE', 'CREATE_CONTENT'],
          instagram_business_account: {
            id: 'ig-1',
            username: 'bilirkisihesap',
            name: 'Bilirkişi',
            profile_picture_url: 'https://cdn.example/ig.png',
            account_type: 'BUSINESS',
          },
        },
        {
          id: 'page-2',
          name: 'Bağlantısız Sayfa',
          access_token: 'PAGE_TOKEN_2',
          tasks: ['MANAGE'],
          instagram_business_account: null,
        },
      ],
    },
    requestId: 'req-disc',
    status: 200,
  };
}

beforeAll(async () => {
  const passwordHash = await bcrypt.hash('TestPass123!', 10);
  const stamp = Date.now();
  const userA = await prisma.user.create({
    data: { email: `meta-a-${stamp}@test.local`, passwordHash, firstName: 'Meta', lastName: 'A' },
  });
  const userB = await prisma.user.create({
    data: { email: `meta-b-${stamp}@test.local`, passwordHash, firstName: 'Meta', lastName: 'B' },
  });
  const tenantA = await prisma.tenant.create({ data: { name: 'Meta A', slug: `meta-a-${stamp}` } });
  const tenantB = await prisma.tenant.create({ data: { name: 'Meta B', slug: `meta-b-${stamp}` } });
  await prisma.tenantMember.createMany({
    data: [
      { userId: userA.id, tenantId: tenantA.id, role: TenantRole.OWNER },
      { userId: userB.id, tenantId: tenantB.id, role: TenantRole.OWNER },
    ],
  });
  ids.tenantA = tenantA.id;
  ids.tenantB = tenantB.id;
  ids.userA = userA.id;
  ids.userB = userB.id;

  const brand = await brandService.createBrand(ctxA(), { name: 'Bilirkişi Hesap' });
  ids.brandA = brand.id;

  const mediaPublic = await prisma.mediaAsset.create({
    data: {
      tenantId: tenantA.id,
      uploadedById: userA.id,
      originalFileName: 'pub.png',
      fileName: 'pub.png',
      mimeType: 'image/png',
      size: 100,
      storageProvider: 'vercel-blob',
      storageKey: `tenants/${tenantA.id}/pub.png`,
      url: 'https://public.blob.vercel-storage.com/pub.png',
      category: 'IMAGE',
    },
  });
  const mediaPrivate = await prisma.mediaAsset.create({
    data: {
      tenantId: tenantA.id,
      uploadedById: userA.id,
      originalFileName: 'priv.png',
      fileName: 'priv.png',
      mimeType: 'image/png',
      size: 100,
      storageProvider: 'vercel-blob',
      storageKey: `tenants/${tenantA.id}/priv.png`,
      url: 'https://private.example.com/secret.png',
      category: 'IMAGE',
    },
  });
  const mediaVideo = await prisma.mediaAsset.create({
    data: {
      tenantId: tenantA.id,
      uploadedById: userA.id,
      originalFileName: 'reel.mp4',
      fileName: 'reel.mp4',
      mimeType: 'video/mp4',
      size: 5000,
      storageProvider: 'vercel-blob',
      storageKey: `tenants/${tenantA.id}/reel.mp4`,
      url: 'https://public.blob.vercel-storage.com/reel.mp4',
      category: 'VIDEO',
    },
  });
  const mediaSlide = await prisma.mediaAsset.create({
    data: {
      tenantId: tenantA.id,
      uploadedById: userA.id,
      originalFileName: 'slide.png',
      fileName: 'slide.png',
      mimeType: 'image/png',
      size: 120,
      storageProvider: 'vercel-blob',
      storageKey: `tenants/${tenantA.id}/slide.png`,
      url: 'https://public.blob.vercel-storage.com/slide.png',
      category: 'IMAGE',
    },
  });
  ids.mediaPublic = mediaPublic.id;
  ids.mediaPrivate = mediaPrivate.id;
  ids.mediaVideo = mediaVideo.id;
  ids.mediaSlide = mediaSlide.id;
});

afterAll(async () => {
  await prisma.socialContentDestination.deleteMany({
    where: { tenantId: { in: [ids.tenantA, ids.tenantB] } },
  });
  await prisma.socialContentMedia.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.socialContentPlatform.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.socialContent.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.socialAccount.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.socialConnection.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.socialOAuthSession.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.socialHashtag.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.socialBrand.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.mediaAsset.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.tenantMember.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [ids.tenantA, ids.tenantB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.userA, ids.userB] } } });
  await prisma.$disconnect();
});

beforeEach(() => {
  metaGetMock.mockReset();
  metaPostMock.mockReset();
  exchangeCodeMock.mockReset();
  exchangeLongMock.mockReset();
  publicUrlMock.mockReset();
  publicUrlMock.mockImplementation(async (url: string) => {
    if (!url || url.includes('private') || url.includes('example.com')) {
      throw new AppError(
        400,
        'MEDIA_URL_NOT_PUBLIC',
        'Bu medya Instagram tarafından dışarıdan erişilebilir değil. Yayınlamak için herkese açık bir medya URL’si gerekiyor.',
      );
    }
  });
});

describe('Meta OAuth state', () => {
  it('geçersiz state reddeder', async () => {
    await expect(oauthService.handleMetaOauthCallback('code', 'missing-state')).rejects.toMatchObject({
      code: 'OAUTH_STATE_INVALID',
    } satisfies Partial<AppError>);
  });

  it('süresi dolmuş state reddeder', async () => {
    const session = await prisma.socialOAuthSession.create({
      data: {
        tenantId: ids.tenantA,
        userId: ids.userA,
        state: `expired-${Date.now()}`,
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await expect(oauthService.handleMetaOauthCallback('code', session.state)).rejects.toMatchObject({
      code: 'OAUTH_STATE_EXPIRED',
    });
  });

  it('callback connection oluşturur, token yanıtta yok', async () => {
    const started = await oauthService.startMetaOauth(ctxA());
    const url = new URL(started.authorizationUrl);
    const state = url.searchParams.get('state')!;
    exchangeCodeMock.mockResolvedValue({
      data: { access_token: 'SYSTEM_USER_TOKEN', token_type: 'bearer' },
      requestId: 'ex1',
      status: 200,
    });
    metaGetMock.mockResolvedValueOnce({ data: { id: 'meta-su-1', name: 'System' }, requestId: 'me', status: 200 });

    const result = await oauthService.handleMetaOauthCallback('auth-code', state);
    expect(result.connectionId).toBeTruthy();
    expect(JSON.stringify(result)).not.toMatch(/SYSTEM_USER_TOKEN|access_token/i);
    expect(exchangeLongMock).not.toHaveBeenCalled();

    const stored = await prisma.socialConnection.findFirstOrThrow({ where: { id: result.connectionId } });
    expect(stored.accessTokenEncrypted).toBeTruthy();
    expect(stored.accessTokenEncrypted).not.toContain('SYSTEM_USER_TOKEN');
    expect(stored.status).toBe('CONNECTED');
    expect(stored.expiresAt).toBeNull();
    expect(stored.grantedScopes).toMatchObject({ tokenType: 'SYSTEM_USER' });
  });

  it('system-user code exchange: expiry yoksa expiresAt null, long-lived USER exchange yok', async () => {
    const started = await oauthService.startMetaOauth(ctxA());
    const state = new URL(started.authorizationUrl).searchParams.get('state')!;
    exchangeCodeMock.mockResolvedValue({
      data: { access_token: 'SUAT_NEVER' },
      requestId: 'ex-su',
      status: 200,
    });
    metaGetMock.mockResolvedValueOnce({ data: { id: 'su-2' }, requestId: 'me', status: 200 });

    const result = await oauthService.handleMetaOauthCallback('code-su', state);
    expect(exchangeLongMock).not.toHaveBeenCalled();
    const stored = await prisma.socialConnection.findFirstOrThrow({ where: { id: result.connectionId } });
    expect(stored.expiresAt).toBeNull();
    expect(stored.grantedScopes).toMatchObject({
      tokenType: 'SYSTEM_USER',
      configId: expect.any(String),
    });
  });
  it('system-user token ile discovery /me/accounts çalışır', async () => {
    const connection = await prisma.socialConnection.findFirstOrThrow({
      where: { tenantId: ids.tenantA, provider: 'META' },
      orderBy: { updatedAt: 'desc' },
    });
    expect(connection.grantedScopes).toMatchObject({ tokenType: 'SYSTEM_USER' });
    metaGetMock.mockResolvedValueOnce(pageList() as never);
    const discovered = await oauthService.discoverMetaPages(ctxA(), connection.id);
    expect(discovered.pages.length).toBeGreaterThan(0);
    expect(metaGetMock.mock.calls[0][0]).toBe('me/accounts');
    expect(JSON.stringify(discovered)).not.toMatch(/access_token|SYSTEM_USER_TOKEN|SUAT/i);
  });
});

describe('Discovery + account connect', () => {
  it('page ve IG discovery metadata döner, token dönmez', async () => {
    const connection = await prisma.socialConnection.findFirstOrThrow({
      where: { tenantId: ids.tenantA, provider: 'META' },
    });
    metaGetMock.mockResolvedValueOnce(pageList() as never);
    const discovered = await oauthService.discoverMetaPages(ctxA(), connection.id);
    expect(discovered.pages).toHaveLength(2);
    expect(discovered.pages[0].instagram?.username).toBe('bilirkisihesap');
    expect(discovered.pages[1].instagram).toBeNull();
    expect(discovered.pages[1].instagramUnlinkedReason).toMatch(/Facebook Sayfasına bağlı değil/);
    expect(JSON.stringify(discovered)).not.toMatch(/PAGE_TOKEN|access_token/i);
  });

  it('seçilen hesapları bağlar ve duplicate upsert eder', async () => {
    const connection = await prisma.socialConnection.findFirstOrThrow({
      where: { tenantId: ids.tenantA, provider: 'META' },
    });
    metaGetMock.mockResolvedValue(pageList() as never);
    const first = await accountService.connectMetaAccounts(ctxA(), {
      connectionId: connection.id,
      socialBrandId: ids.brandA,
      pages: [{ pageId: 'page-1', connectFacebook: true, connectInstagram: true }],
    });
    expect(first).toHaveLength(2);
    expect(first.some((a) => a.platform === 'FACEBOOK' && a.name === 'Bilirkişi Hesap')).toBe(true);
    expect(first.some((a) => a.platform === 'INSTAGRAM' && a.username === 'bilirkisihesap')).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(/PAGE_TOKEN|accessTokenEncrypted/i);

    const second = await accountService.connectMetaAccounts(ctxA(), {
      connectionId: connection.id,
      socialBrandId: ids.brandA,
      pages: [{ pageId: 'page-1', connectFacebook: true, connectInstagram: true }],
    });
    const list = await accountService.listSocialAccounts(ctxA());
    expect(list.filter((a) => a.externalAccountId === 'page-1' || a.externalAccountId === 'ig-1')).toHaveLength(2);
    expect(second).toHaveLength(2);
  });

  it('tenant B başka tenant hesabını görmez', async () => {
    const listB = await accountService.listSocialAccounts(ctxB());
    expect(listB).toHaveLength(0);
    const accountA = await prisma.socialAccount.findFirstOrThrow({ where: { tenantId: ids.tenantA } });
    await expect(accountService.updateSocialAccount(ctxB(), accountA.id, { socialBrandId: null })).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
    });
  });
});

async function readyContent(opts: {
  type?: 'POST' | 'CAROUSEL' | 'REEL' | 'STORY' | 'VIDEO';
  accountIds: string[];
  mediaIds?: string[];
  text?: string;
}) {
  const content = await contentService.createContent(ctxA(), {
    title: 'Yayın testi',
    contentText: opts.text ?? 'Merhaba dünya',
    contentType: opts.type ?? 'POST',
    accountIds: opts.accountIds,
    approved: true,
    readyToPublish: true,
  });
  for (const mediaId of opts.mediaIds ?? []) {
    await contentService.addMedia(ctxA(), content.id, { mediaAssetId: mediaId });
  }
  return contentService.getContent(ctxA(), content.id);
}

describe('Manual publish', () => {
  it('workflow hazır değilse reddeder', async () => {
    const ig = await prisma.socialAccount.findFirstOrThrow({
      where: { tenantId: ids.tenantA, platform: 'INSTAGRAM' },
    });
    const draft = await contentService.createContent(ctxA(), {
      title: 'Taslak',
      contentType: 'POST',
      accountIds: [ig.id],
    });
    await expect(publishService.publishContent(ctxA(), draft.id)).rejects.toMatchObject({
      code: 'WORKFLOW_NOT_READY',
    });
  });

  it('STORY desteklenmez', async () => {
    const ig = await prisma.socialAccount.findFirstOrThrow({
      where: { tenantId: ids.tenantA, platform: 'INSTAGRAM' },
    });
    const content = await readyContent({ type: 'STORY', accountIds: [ig.id], mediaIds: [ids.mediaPublic] });
    publicUrlMock.mockResolvedValue(undefined);
    const result = await publishService.publishContent(ctxA(), content.id);
    expect(result.results[0].status).toBe('FAILED');
    expect(result.results[0].errorMessage).toMatch(/Hikâye/);
  });

  it('private media URL reddeder', async () => {
    const ig = await prisma.socialAccount.findFirstOrThrow({
      where: { tenantId: ids.tenantA, platform: 'INSTAGRAM' },
    });
    const content = await readyContent({ accountIds: [ig.id], mediaIds: [ids.mediaPrivate] });
    const result = await publishService.publishContent(ctxA(), content.id);
    expect(result.results[0].status).toBe('FAILED');
    expect(result.results[0].errorMessage).toMatch(/dışarıdan erişilebilir değil/);
  });

  it('Facebook text publish başarılı', async () => {
    const fb = await prisma.socialAccount.findFirstOrThrow({
      where: { tenantId: ids.tenantA, platform: 'FACEBOOK' },
    });
    const content = await readyContent({ accountIds: [fb.id], text: 'Sayfa metni' });
    metaPostMock.mockResolvedValueOnce({ data: { id: 'page-1_111' }, requestId: 'fb-text', status: 200 });
    metaGetMock.mockResolvedValueOnce({
      data: { permalink_url: 'https://www.facebook.com/page-1_111' },
      requestId: 'fb-link',
      status: 200,
    });
    const result = await publishService.publishContent(ctxA(), content.id);
    expect(result.results[0].status).toBe('PUBLISHED');
    expect(result.content.destinations[0].externalPostId).toBe('page-1_111');
    expect(result.content.published).toBe(true);
  });

  it('Facebook image publish başarılı', async () => {
    const fb = await prisma.socialAccount.findFirstOrThrow({
      where: { tenantId: ids.tenantA, platform: 'FACEBOOK' },
    });
    const content = await readyContent({ accountIds: [fb.id], mediaIds: [ids.mediaPublic] });
    publicUrlMock.mockResolvedValue(undefined);
    metaPostMock.mockResolvedValueOnce({ data: { id: 'photo-9', post_id: 'page-1_222' }, requestId: 'fb-img', status: 200 });
    metaGetMock.mockResolvedValueOnce({ data: { permalink_url: 'https://facebook.com/p/222' }, requestId: null, status: 200 });
    const result = await publishService.publishContent(ctxA(), content.id);
    expect(result.results[0].status).toBe('PUBLISHED');
    expect(metaPostMock.mock.calls[0][0]).toContain('/photos');
  });

  it('Instagram image container + publish', async () => {
    const ig = await prisma.socialAccount.findFirstOrThrow({
      where: { tenantId: ids.tenantA, platform: 'INSTAGRAM' },
    });
    const content = await readyContent({ accountIds: [ig.id], mediaIds: [ids.mediaPublic] });
    publicUrlMock.mockResolvedValue(undefined);
    metaPostMock
      .mockResolvedValueOnce({ data: { id: 'ig-container' }, requestId: 'c1', status: 200 })
      .mockResolvedValueOnce({ data: { id: 'ig-media-9' }, requestId: 'p1', status: 200 });
    metaGetMock.mockResolvedValueOnce({ data: { permalink: 'https://instagram.com/p/abc' }, requestId: null, status: 200 });
    const result = await publishService.publishContent(ctxA(), content.id);
    expect(result.results[0].status).toBe('PUBLISHED');
    expect(result.content.destinations[0].externalPostId).toBe('ig-media-9');
    expect(result.content.destinations[0].externalContainerId).toBe('ig-container');
    expect(metaPostMock.mock.calls[0][0]).toMatch(/ig-1\/media$/);
    expect(metaPostMock.mock.calls[1][0]).toMatch(/media_publish/);
  });

  it('Instagram video status poll + publish', async () => {
    const ig = await prisma.socialAccount.findFirstOrThrow({
      where: { tenantId: ids.tenantA, platform: 'INSTAGRAM' },
    });
    const content = await readyContent({ type: 'REEL', accountIds: [ig.id], mediaIds: [ids.mediaVideo] });
    publicUrlMock.mockResolvedValue(undefined);
    metaPostMock
      .mockResolvedValueOnce({ data: { id: 'reel-c' }, requestId: 'rc', status: 200 })
      .mockResolvedValueOnce({ data: { id: 'reel-m' }, requestId: 'rp', status: 200 });
    metaGetMock
      .mockResolvedValueOnce({ data: { status_code: 'IN_PROGRESS' }, requestId: 's1', status: 200 })
      .mockResolvedValueOnce({ data: { status_code: 'FINISHED' }, requestId: 's2', status: 200 })
      .mockResolvedValueOnce({ data: { permalink: 'https://instagram.com/reel/x' }, requestId: null, status: 200 });
    const result = await publishService.publishContent(ctxA(), content.id);
    expect(result.results[0].status).toBe('PUBLISHED');
    expect(result.content.destinations[0].externalPostId).toBe('reel-m');
  });

  it('Instagram carousel sırasını korur', async () => {
    const ig = await prisma.socialAccount.findFirstOrThrow({
      where: { tenantId: ids.tenantA, platform: 'INSTAGRAM' },
    });
    const content = await readyContent({
      type: 'CAROUSEL',
      accountIds: [ig.id],
      mediaIds: [ids.mediaPublic, ids.mediaSlide],
    });
    publicUrlMock.mockResolvedValue(undefined);
    metaPostMock
      .mockResolvedValueOnce({ data: { id: 'child-a' }, requestId: 'a', status: 200 })
      .mockResolvedValueOnce({ data: { id: 'child-b' }, requestId: 'b', status: 200 })
      .mockResolvedValueOnce({ data: { id: 'carousel-c' }, requestId: 'c', status: 200 })
      .mockResolvedValueOnce({ data: { id: 'carousel-m' }, requestId: 'd', status: 200 });
    metaGetMock
      .mockResolvedValueOnce({ data: { status_code: 'FINISHED' }, requestId: 'f1', status: 200 })
      .mockResolvedValueOnce({ data: { permalink: 'https://instagram.com/p/car' }, requestId: null, status: 200 });
    const result = await publishService.publishContent(ctxA(), content.id);
    expect(result.results[0].status).toBe('PUBLISHED');
    const carouselCall = metaPostMock.mock.calls.find((c) => (c[2] as { media_type?: string })?.media_type === 'CAROUSEL');
    expect(carouselCall?.[2]).toMatchObject({ children: 'child-a,child-b' });
  });

  it('already published tekrar yayınlamaz', async () => {
    const fb = await prisma.socialAccount.findFirstOrThrow({
      where: { tenantId: ids.tenantA, platform: 'FACEBOOK' },
    });
    const dest = await prisma.socialContentDestination.findFirstOrThrow({
      where: { tenantId: ids.tenantA, socialAccountId: fb.id, publicationStatus: 'PUBLISHED' },
    });
    metaPostMock.mockClear();
    const result = await publishService.publishContent(ctxA(), dest.socialContentId, {
      destinationIds: [dest.id],
    });
    expect(result.results[0].status).toBe('PUBLISHED');
    expect(metaPostMock).not.toHaveBeenCalled();
  });

  it('partial success: IG ok FB fail, retry yalnız fail', async () => {
    const ig = await prisma.socialAccount.findFirstOrThrow({
      where: { tenantId: ids.tenantA, platform: 'INSTAGRAM' },
    });
    const fb = await prisma.socialAccount.findFirstOrThrow({
      where: { tenantId: ids.tenantA, platform: 'FACEBOOK' },
    });
    const content = await readyContent({
      accountIds: [ig.id, fb.id],
      mediaIds: [ids.mediaPublic],
    });
    publicUrlMock.mockResolvedValue(undefined);
    metaPostMock.mockImplementation(async (path: string) => {
      if (path.includes('ig-1')) {
        if (path.includes('media_publish')) return { data: { id: 'ig-ok' }, requestId: 'i2', status: 200 };
        return { data: { id: 'ig-c' }, requestId: 'i1', status: 200 };
      }
      throw new MetaApiError({
        message: 'fail fb',
        code: 100,
        httpStatus: 400,
        path,
      });
    });
    metaGetMock.mockResolvedValue({ data: { permalink: 'https://instagram.com/p/ok' }, requestId: null, status: 200 });

    const first = await publishService.publishContent(ctxA(), content.id);
    const igResult = first.results.find((r) => first.content.destinations.find((d) => d.id === r.destinationId)?.platform === 'INSTAGRAM');
    const fbResult = first.results.find((r) => first.content.destinations.find((d) => d.id === r.destinationId)?.platform === 'FACEBOOK');
    expect(igResult?.status).toBe('PUBLISHED');
    expect(fbResult?.status).toBe('FAILED');
    expect(first.content.published).toBe(false);

    const failedId = fbResult!.destinationId;
    metaPostMock.mockReset();
    metaPostMock.mockResolvedValue({ data: { id: 'page-1_retry' }, requestId: 'fb2', status: 200 });
    metaGetMock.mockResolvedValue({ data: { permalink_url: 'https://facebook.com/retry' }, requestId: null, status: 200 });
    const retry = await publishService.publishContent(ctxA(), content.id, { destinationIds: [failedId] });
    expect(retry.results).toHaveLength(1);
    expect(retry.results[0].status).toBe('PUBLISHED');
    expect(retry.content.published).toBe(true);
    expect(metaPostMock.mock.calls.some((c) => String(c[0]).includes('ig-1'))).toBe(false);
  });

  it('token invalid hesabı EXPIRED yapar', async () => {
    const fb = await prisma.socialAccount.findFirstOrThrow({
      where: { tenantId: ids.tenantA, platform: 'FACEBOOK' },
    });
    const content = await readyContent({ accountIds: [fb.id], text: 'token test' });
    metaPostMock.mockRejectedValue(
      new MetaApiError({ message: 'invalid', code: 190, httpStatus: 401, path: 'page-1/feed' }),
    );
    const result = await publishService.publishContent(ctxA(), content.id);
    expect(result.results[0].status).toBe('FAILED');
    const account = await prisma.socialAccount.findFirstOrThrow({ where: { id: fb.id } });
    expect(account.connectionStatus).toBe('EXPIRED');
  });

  it('disconnect geçmiş destination kayıtlarını silmez', async () => {
    const fb = await prisma.socialAccount.findFirstOrThrow({
      where: { tenantId: ids.tenantA, platform: 'FACEBOOK', isActive: true },
    });
    const destCountBefore = await prisma.socialContentDestination.count({
      where: { socialAccountId: fb.id },
    });
    expect(destCountBefore).toBeGreaterThan(0);
    await accountService.disconnectSocialAccount(ctxA(), fb.id);
    const destCountAfter = await prisma.socialContentDestination.count({
      where: { socialAccountId: fb.id },
    });
    expect(destCountAfter).toBe(destCountBefore);
    const disconnected = await prisma.socialAccount.findFirstOrThrow({ where: { id: fb.id } });
    expect(disconnected.isActive).toBe(false);
    expect(disconnected.accessTokenEncrypted).toBeNull();
  });
});

describe('token leak guard', () => {
  it('list response token alanı içermez', async () => {
    const list = await accountService.listSocialAccounts(ctxA());
    const json = JSON.stringify(list);
    expect(json).not.toMatch(/accessToken|ciphertext|access_token/i);
    accountService.assertNoTokenLeak(list);
  });
});
