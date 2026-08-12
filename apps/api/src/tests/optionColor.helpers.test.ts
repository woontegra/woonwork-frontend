import { describe, expect, it } from 'vitest';
import {
  colorForNewOption,
  inferStatusOptionColor,
  nextOptionColor,
} from '@woonwork/shared';

describe('select option auto-color', () => {
  it('cycles unused palette colors then wraps', () => {
    expect(nextOptionColor([])).toBe('gray');
    expect(nextOptionColor([{ color: 'gray' }])).toBe('blue');
    expect(nextOptionColor([{ color: 'gray' }, { color: 'blue' }])).toBe('green');
    const full = ['gray', 'blue', 'green', 'purple', 'orange', 'pink', 'teal', 'yellow'].map(
      (color) => ({ color }),
    );
    expect(nextOptionColor(full)).toBe('gray');
  });

  it('status names map to semantic colors', () => {
    expect(inferStatusOptionColor('Taslak')).toBe('gray');
    expect(inferStatusOptionColor('Onay Bekliyor')).toBe('orange');
    expect(inferStatusOptionColor('Onaylandı')).toBe('green');
    expect(inferStatusOptionColor('Yayına Hazır')).toBe('teal');
    expect(inferStatusOptionColor('Başarısız')).toBe('red');
    expect(inferStatusOptionColor('Kontrol')).toBe('blue');
  });

  it('STATUS uses semantic inference, SELECT uses cycle', () => {
    expect(colorForNewOption('Onaylandı', [], 'STATUS')).toBe('green');
    expect(colorForNewOption('Yeni', [], 'SELECT')).toBe('gray');
    expect(colorForNewOption('Yeni', [{ color: 'gray' }], 'SELECT')).toBe('blue');
  });
});
