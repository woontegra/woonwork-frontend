import { describe, expect, it } from 'vitest';
import {
  addDraftMediaPick,
  hasUnsavedNewDraftChanges,
} from '../../../web/src/lib/socialContentDraft';
import {
  canPublishNow,
  cellUsesBadgeEditMode,
  cellIsInlineEditable,
  drawerOpenTriggerForTarget,
  getPublicationDisplayStatus,
  getStatusBadgeLabel,
  isRealPublishApiCall,
  shouldOpenDrawerOnRowClick,
  tableCellFieldForColumn,
  tableColumnValues,
  validateWorkflowToggle,
  workflowPatchBody,
} from '../../../web/src/lib/socialContentTable';
import { computeAnchoredPosition } from '../../../web/src/lib/anchoredPopover';
import type { SocialContentDto } from '../../../web/src/lib/social';

const baseItem = (): SocialContentDto => ({
  id: 'c1',
  tenantId: 't1',
  workspaceAreaId: null,
  socialBrandId: 'b1',
  createdById: 'u1',
  title: 'Test',
  description: null,
  contentText: 'Preview text',
  internalNotes: null,
  contentType: 'POST',
  status: 'DRAFT',
  scheduledAt: null,
  timezone: 'Europe/Istanbul',
  edited: false,
  approved: false,
  readyToPublish: false,
  published: false,
  publishedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  platforms: [],
  destinations: [],
  media: [],
});

describe('SocialContents table interaction contract', () => {
  it('row boş alanına click → drawer açılmaz', () => {
    expect(shouldOpenDrawerOnRowClick()).toBe(false);
    expect(drawerOpenTriggerForTarget('row')).toBe('none');
    expect(drawerOpenTriggerForTarget('brand')).toBe('none');
    expect(drawerOpenTriggerForTarget('scheduledAt')).toBe('none');
    expect(drawerOpenTriggerForTarget('description')).toBe('none');
    expect(drawerOpenTriggerForTarget('notes')).toBe('none');
    expect(drawerOpenTriggerForTarget('switch-edited')).toBe('none');
    expect(drawerOpenTriggerForTarget('switch-approved')).toBe('none');
    expect(drawerOpenTriggerForTarget('switch-ready')).toBe('none');
    expect(drawerOpenTriggerForTarget('menu')).toBe('none');
    expect(drawerOpenTriggerForTarget('status')).toBe('none');
  });

  it('title click → drawer açmaz (inline edit)', () => {
    expect(drawerOpenTriggerForTarget('title')).toBe('none');
    expect(drawerOpenTriggerForTarget('title-preview')).toBe('none');
  });

  it('menu Düzenle → drawer açılır', () => {
    expect(drawerOpenTriggerForTarget('menu-edit')).toBe('menu-edit');
  });

  it('her hücre alanı kendi field mappingine sahip', () => {
    expect(tableCellFieldForColumn('brand')).toBe('socialBrandId');
    expect(tableCellFieldForColumn('description')).toBe('contentText');
    expect(tableCellFieldForColumn('notes')).toBe('internalNotes');
    expect(tableCellFieldForColumn('title')).toBe('title');
    expect(cellIsInlineEditable('description')).toBe(true);
    expect(cellIsInlineEditable('platforms')).toBe(false);
  });

  it('workflow switch patch yalnızca ilgili boolean alanı günceller', () => {
    expect(workflowPatchBody('edited', true)).toEqual({ edited: true });
    expect(workflowPatchBody('approved', false)).toEqual({ approved: false });
    expect(workflowPatchBody('readyToPublish', true)).toEqual({ readyToPublish: true });
  });

  it('switch gerçek Meta publisher çağırmaz', () => {
    expect(isRealPublishApiCall('edited')).toBe(false);
    expect(isRealPublishApiCall('approved')).toBe(false);
    expect(isRealPublishApiCall('readyToPublish')).toBe(false);
  });

  it('onay için önce düzenlendi gerekir', () => {
    const item = baseItem();
    const result = validateWorkflowToggle(item, 'approved', true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('düzenlendi');
    }
  });

  it('yayına hazır için önce onay gerekir', () => {
    const item = { ...baseItem(), edited: true };
    const result = validateWorkflowToggle(item, 'readyToPublish', true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('onay');
    }
  });

  it('onay kaldırma yayına hazır açıkken engellenir', () => {
    const item = { ...baseItem(), edited: true, approved: true, readyToPublish: true };
    const result = validateWorkflowToggle(item, 'approved', false);
    expect(result.ok).toBe(false);
  });

  it('gerçek PUBLISHED destination kullanıcı switch ile oluşturulamaz — readyToPublish kullanılır', () => {
    const body = workflowPatchBody('readyToPublish', true);
    expect(body).not.toHaveProperty('published');
    expect(body).toEqual({ readyToPublish: true });
  });

  it('gerçek yayın sonucu durum badge ile ayrıştırılır', () => {
    const published = {
      ...baseItem(),
      published: true,
      status: 'PUBLISHED',
      destinations: [
        {
          id: 'd1',
          socialAccountId: 'a1',
          platform: 'INSTAGRAM' as const,
          publicationStatus: 'PUBLISHED' as const,
          externalPostId: '123',
          externalContainerId: null,
          permalink: 'https://instagram.com/p/1',
          errorCode: null,
          errorMessage: null,
          publishedAt: '2026-01-02T00:00:00.000Z',
          lastAttemptAt: null,
          attemptCount: 1,
        },
      ],
    };
    const display = getPublicationDisplayStatus(published);
    expect(display.label).toBe('Yayınlandı');
    expect(display.readOnly).toBe(true);
  });

  it('kısmi hata durumu destinations üzerinden türetilir', () => {
    const partial = {
      ...baseItem(),
      destinations: [
        {
          id: 'd1',
          socialAccountId: 'a1',
          platform: 'INSTAGRAM' as const,
          publicationStatus: 'PUBLISHED' as const,
          externalPostId: '1',
          externalContainerId: null,
          permalink: null,
          errorCode: null,
          errorMessage: null,
          publishedAt: null,
          lastAttemptAt: null,
          attemptCount: 1,
        },
        {
          id: 'd2',
          socialAccountId: 'a2',
          platform: 'FACEBOOK' as const,
          publicationStatus: 'FAILED' as const,
          externalPostId: null,
          externalContainerId: null,
          permalink: null,
          errorCode: 'ERR',
          errorMessage: 'fail',
          publishedAt: null,
          lastAttemptAt: null,
          attemptCount: 1,
        },
      ],
    };
    const display = getPublicationDisplayStatus(partial);
    expect(display.label).toBe('Kısmi Hata');
    expect(display.readOnly).toBe(true);
  });

  it('Şimdi Yayınla yalnızca onaylı ve yayına hazır içerikte mümkün', () => {
    const draft = baseItem();
    expect(canPublishNow(draft)).toBe(false);

    const ready = {
      ...baseItem(),
      edited: true,
      approved: true,
      readyToPublish: true,
      destinations: [
        {
          id: 'd1',
          socialAccountId: 'a1',
          platform: 'INSTAGRAM' as const,
          publicationStatus: 'PENDING' as const,
          externalPostId: null,
          externalContainerId: null,
          permalink: null,
          errorCode: null,
          errorMessage: null,
          publishedAt: null,
          lastAttemptAt: null,
          attemptCount: 0,
        },
      ],
    };
    expect(canPublishNow(ready)).toBe(true);
  });

  it('description ve notes ayrı column değerleri', () => {
    const item = {
      ...baseItem(),
      title: 'Başlık metni',
      contentText: 'Açıklama metni',
      internalNotes: 'Dahili not',
    };
    const cols = tableColumnValues(item);
    expect(cols.title).toBe('Başlık metni');
    expect(cols.description).toBe('Açıklama metni');
    expect(cols.notes).toBe('Dahili not');
  });

  it('notes alanı internalNotes backend alanından gelir', () => {
    const item = { ...baseItem(), internalNotes: 'Operasyon notu' };
    expect(tableColumnValues(item).notes).toBe(item.internalNotes);
  });

  it('brand/type/status read-mode badge edit-mode kullanır', () => {
    expect(cellUsesBadgeEditMode('brand')).toBe(true);
    expect(cellUsesBadgeEditMode('type')).toBe(true);
    expect(cellUsesBadgeEditMode('status')).toBe(true);
    expect(cellUsesBadgeEditMode('description')).toBe(false);
    expect(cellUsesBadgeEditMode('notes')).toBe(false);
    expect(cellUsesBadgeEditMode('title')).toBe(false);
  });

  it('yayına hazır durum badge etiketi gösterilir', () => {
    const item = {
      ...baseItem(),
      edited: true,
      approved: true,
      readyToPublish: true,
      status: 'APPROVED' as const,
    };
    expect(getStatusBadgeLabel(item)).toBe('Yayına Hazır');
  });
});

describe('anchored popover positioning', () => {
  it('anchor altında yer varsa below açılır', () => {
    const pos = computeAnchoredPosition({
      anchor: { top: 100, left: 40, right: 120, bottom: 120, width: 80, height: 20 },
      width: 160,
      height: 80,
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    expect(pos.placed).toBe('below');
    expect(pos.top).toBe(124);
    expect(pos.left).toBe(40);
  });

  it('ekranın altındaki satırda flip çalışır', () => {
    const pos = computeAnchoredPosition({
      anchor: { top: 760, left: 40, right: 120, bottom: 780, width: 80, height: 20 },
      width: 160,
      height: 120,
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    expect(pos.placed).toBe('above');
    expect(pos.top).toBeLessThan(760);
  });

  it('ekranın sağ kenarında sola clamp eder', () => {
    const pos = computeAnchoredPosition({
      anchor: { top: 40, left: 1200, right: 1270, bottom: 60, width: 70, height: 20 },
      width: 200,
      height: 80,
      align: 'end',
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    expect(pos.left + 200).toBeLessThanOrEqual(1280 - 8);
    expect(pos.left).toBeGreaterThanOrEqual(8);
  });
});

describe('socialContentDraft regression (medya ekle otomatik kayıt oluşturmaz)', () => {
  const asset = {
    id: 'm1',
    tenantId: 't1',
    uploadedById: 'u1',
    originalFileName: 'm1.png',
    fileName: 'm1.png',
    mimeType: 'image/png',
    size: 100,
    storageProvider: 'vercel-blob',
    storageKey: 'k/m1',
    url: 'https://example.com/m1.png',
    width: null,
    height: null,
    duration: null,
    category: 'IMAGE' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('boş yeni içerik dirty değil — otomatik kayıt yok', () => {
    expect(
      hasUnsavedNewDraftChanges({
        title: '',
        contentText: '',
        internalNotes: '',
        accountIds: [],
        draftMedia: [],
        platforms: [],
        scheduledAt: '',
        brandId: 'b1',
        defaultBrandId: 'b1',
        presetScheduledAt: null,
      }),
    ).toBe(false);
  });

  it('medya seçimi dirty sayılır fakat API çağrısı gerektirmez', () => {
    const picks = addDraftMediaPick([], asset, true);
    expect(picks).toHaveLength(1);
    expect(
      hasUnsavedNewDraftChanges({
        title: '',
        contentText: '',
        internalNotes: '',
        accountIds: [],
        draftMedia: picks,
        platforms: [],
        scheduledAt: '',
        brandId: 'b1',
        defaultBrandId: 'b1',
        presetScheduledAt: null,
      }),
    ).toBe(true);
  });
});
