import { describe, expect, it } from 'vitest';
import {
  brandCanHardDelete,
  brandContentCount,
  brandHashtagCount,
  brandPlannedCount,
  filterBrandsForOps,
  sortBrandsForOps,
} from '../../../web/src/lib/socialBrands';

describe('socialBrands helpers', () => {
  it('sorts active first then updatedAt desc', () => {
    const sorted = sortBrandsForOps([
      { name: 'B', isActive: false, updatedAt: '2026-08-01T00:00:00.000Z' },
      { name: 'A', isActive: true, updatedAt: '2026-08-01T00:00:00.000Z' },
      { name: 'C', isActive: true, updatedAt: '2026-08-10T00:00:00.000Z' },
    ]);
    expect(sorted.map((b) => b.name)).toEqual(['C', 'A', 'B']);
  });

  it('filters by search and status', () => {
    const brands = [
      { name: 'Bilirkişi Hesap', isActive: true, description: 'IG' },
      { name: 'Woontegra', isActive: false, description: null },
    ];
    expect(filterBrandsForOps(brands, { search: 'bilir', status: '' })).toHaveLength(1);
    expect(filterBrandsForOps(brands, { search: '', status: 'passive' })).toHaveLength(1);
    expect(filterBrandsForOps(brands, { search: '', status: 'active' })).toHaveLength(1);
  });

  it('hard delete only when empty relations', () => {
    expect(
      brandCanHardDelete({ stats: { contents: 0, accounts: 0, hashtags: 0 } }),
    ).toBe(true);
    expect(
      brandCanHardDelete({ stats: { contents: 1, accounts: 0, hashtags: 0 } }),
    ).toBe(false);
  });

  it('reads counts from stats/_count', () => {
    expect(brandContentCount({ stats: { contents: 24 } })).toBe(24);
    expect(brandPlannedCount({ stats: { planned: 6 } })).toBe(6);
    expect(brandHashtagCount({ _count: { hashtags: 38 } })).toBe(38);
  });
});
