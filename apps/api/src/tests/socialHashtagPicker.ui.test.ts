import { describe, expect, it } from 'vitest';
import {
  COMPOSER_FLOATING_Z,
  HASHTAG_PICKER_MAX_HEIGHT,
  HASHTAG_PICKER_WIDTH,
  TABLE_FLOATING_Z,
  clampPopoverWidth,
  computeAnchoredPosition,
} from '../../../web/src/lib/anchoredPopover';
import {
  HASHTAG_PICKER_RESULTS_MAX_HEIGHT,
  HASHTAG_PICKER_TABS,
  hashtagPickerChipTooltip,
  hashtagPickerFooterLabel,
  hashtagPickerInsertEnabled,
  toggleHashtagSelection,
} from '../../../web/src/lib/hashtagPicker';

describe('hashtag picker popover geometry', () => {
  it('composer picker table popover’ın üstünde kalır', () => {
    expect(COMPOSER_FLOATING_Z).toBeGreaterThan(TABLE_FLOATING_Z);
    expect(COMPOSER_FLOATING_Z).toBeGreaterThan(50);
  });

  it('desktop genişliği 460px, viewport daralınca clamp eder', () => {
    expect(HASHTAG_PICKER_WIDTH).toBe(460);
    expect(HASHTAG_PICKER_MAX_HEIGHT).toBe(460);
    expect(clampPopoverWidth(460, 1280, 12)).toBe(460);
    expect(clampPopoverWidth(460, 420, 12)).toBe(396);
    expect(clampPopoverWidth(460, 360, 12) + 24).toBeLessThanOrEqual(360);
  });

  it('sağ hizalı tetikleyicide sağdan taşmaz, gerekirse sola clamp eder', () => {
    const width = clampPopoverWidth(460, 1280, 12);
    const pos = computeAnchoredPosition({
      anchor: { top: 180, left: 1100, right: 1210, bottom: 212, width: 110, height: 32 },
      width,
      height: 420,
      align: 'end',
      padding: 12,
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    expect(pos.placed).toBe('below');
    expect(pos.left).toBeGreaterThanOrEqual(12);
    expect(pos.left + width).toBeLessThanOrEqual(1280 - 12);
  });

  it('altta yer yoksa yukarı flip eder', () => {
    const pos = computeAnchoredPosition({
      anchor: { top: 740, left: 720, right: 830, bottom: 772, width: 110, height: 32 },
      width: 460,
      height: 420,
      align: 'end',
      padding: 12,
      viewportWidth: 1280,
      viewportHeight: 800,
    });
    expect(pos.placed).toBe('above');
    expect(pos.top).toBeLessThan(740);
    expect(pos.top).toBeGreaterThanOrEqual(12);
  });
});

describe('hashtag picker row selection', () => {
  it('satır tıklaması seçer, tekrar tıklama kaldırır, multi-select çalışır', () => {
    let selected = toggleHashtagSelection(new Set(), 'a', true);
    selected = toggleHashtagSelection(selected, 'b', true);
    expect([...selected]).toEqual(['a', 'b']);
    selected = toggleHashtagSelection(selected, 'a', true);
    expect([...selected]).toEqual(['b']);
  });

  it('Blocklist satırları seçilemez', () => {
    const selected = toggleHashtagSelection(new Set(['a']), 'b', false);
    expect([...selected]).toEqual(['a']);
  });

  it('footer sayacı ve buton enable/disable doğru', () => {
    expect(hashtagPickerFooterLabel(0)).toBe('Seçim yok');
    expect(hashtagPickerFooterLabel(2)).toBe('2 hashtag seçildi');
    expect(hashtagPickerInsertEnabled(0)).toBe(false);
    expect(hashtagPickerInsertEnabled(2)).toBe(true);
  });
});

describe('hashtag picker chip layout', () => {
  it('sonuç alanı popover’ı büyütmez, yalnız chipler scroll olur', () => {
    expect(HASHTAG_PICKER_RESULTS_MAX_HEIGHT).toBe(240);
    expect(HASHTAG_PICKER_RESULTS_MAX_HEIGHT).toBeLessThan(HASHTAG_PICKER_MAX_HEIGHT);
  });

  it('usage metadata chip’te değil tooltip’tedir', () => {
    expect(
      hashtagPickerChipTooltip({
        tag: '#brütücret',
        usageCount: 12,
        lastUsedAt: '2026-08-10T10:00:00.000Z',
        status: 'ACTIVE',
      }),
    ).toMatch(/^#brütücret\n12 kez kullanıldı\nSon kullanım:/);
    expect(
      hashtagPickerChipTooltip({
        tag: '#yeni',
        usageCount: 0,
        lastUsedAt: null,
        status: 'ACTIVE',
      }),
    ).toBe('#yeni\nHenüz kullanılmadı');
    expect(
      hashtagPickerChipTooltip({
        tag: '#yasak',
        usageCount: 0,
        lastUsedAt: null,
        status: 'BLOCKED',
      }),
    ).toBe('Blocklist');
  });
});

describe('hashtag picker tabs', () => {
  it('dört sekme tek satır nowrap etiketleridir', () => {
    expect(HASHTAG_PICKER_TABS.map((t) => t.label)).toEqual([
      'Kullanılabilir',
      'Son Kullanılan',
      'Sık Kullanılan',
      'Blocklist',
    ]);
    for (const tab of HASHTAG_PICKER_TABS) {
      expect(tab.label.includes('\n')).toBe(false);
      expect(tab.label.trim()).toBe(tab.label);
    }
  });
});
