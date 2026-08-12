import { describe, expect, it } from 'vitest';
import {
  addDraftMediaPick,
  hasUnsavedNewDraftChanges,
  removeDraftMediaPick,
  reorderDraftMediaPicks,
  sessionUploadAssetIds,
} from '../../../web/src/lib/socialContentDraft';

const asset = (id: string) => ({
  id,
  tenantId: 't1',
  uploadedById: 'u1',
  originalFileName: `${id}.png`,
  fileName: `${id}.png`,
  mimeType: 'image/png',
  size: 100,
  storageProvider: 'vercel-blob',
  storageKey: `k/${id}`,
  url: `https://example.com/${id}.png`,
  width: null,
  height: null,
  duration: null,
  category: 'IMAGE' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('socialContentDraft helpers', () => {
  const base = {
    title: '',
    contentText: '',
    internalNotes: '',
    accountIds: [] as string[],
    draftMedia: [],
    platforms: [] as string[],
    scheduledAt: '',
    brandId: 'brand-a',
    defaultBrandId: 'brand-a',
    presetScheduledAt: null,
  };

  it('boş yeni içerik dirty değil', () => {
    expect(hasUnsavedNewDraftChanges(base)).toBe(false);
  });

  it('başlık veya medya dirty sayılır', () => {
    expect(hasUnsavedNewDraftChanges({ ...base, title: 'Test' })).toBe(true);
    expect(
      hasUnsavedNewDraftChanges({
        ...base,
        draftMedia: [{ asset: asset('m1'), uploadedInSession: false }],
      }),
    ).toBe(true);
  });

  it('draft medya ekleme duplicate engeller', () => {
    const first = addDraftMediaPick([], asset('m1'), true);
    const second = addDraftMediaPick(first, asset('m1'), true);
    expect(second).toHaveLength(1);
  });

  it('session upload cleanup listesi yalnızca uploadedInSession döner', () => {
    const picks = [
      { asset: asset('lib'), uploadedInSession: false },
      { asset: asset('up'), uploadedInSession: true },
    ];
    expect(sessionUploadAssetIds(picks)).toEqual(['up']);
  });

  it('draft medya sıralama ve kaldırma', () => {
    let picks = addDraftMediaPick([], asset('a'), false);
    picks = addDraftMediaPick(picks, asset('b'), false);
    picks = reorderDraftMediaPicks(picks, 0, 1);
    expect(picks.map((p) => p.asset.id)).toEqual(['b', 'a']);
    picks = removeDraftMediaPick(picks, 'b');
    expect(picks.map((p) => p.asset.id)).toEqual(['a']);
  });
});
