export const BRAND_COLOR_PRESETS = [
  '#1d4ed8',
  '#0f766e',
  '#7c3aed',
  '#c98512',
  '#be185d',
  '#64748b',
] as const;

export function brandContentCount(brand: {
  stats?: { contents?: number };
  _count?: { contents?: number };
}) {
  return brand.stats?.contents ?? brand._count?.contents ?? 0;
}

export function brandPlannedCount(brand: { stats?: { planned?: number } }) {
  return brand.stats?.planned ?? 0;
}

export function brandHashtagCount(brand: {
  stats?: { hashtags?: number };
  _count?: { hashtags?: number };
}) {
  return brand.stats?.hashtags ?? brand._count?.hashtags ?? 0;
}

export function brandAccountCount(brand: {
  stats?: { accounts?: number };
  accounts?: unknown[];
  _count?: { accounts?: number };
}) {
  return brand.stats?.accounts ?? brand._count?.accounts ?? brand.accounts?.length ?? 0;
}

export function brandCanHardDelete(brand: {
  stats?: { contents?: number; accounts?: number; hashtags?: number };
  _count?: { contents?: number; accounts?: number; hashtags?: number };
}) {
  return (
    brandContentCount(brand) === 0 &&
    brandAccountCount(brand) === 0 &&
    brandHashtagCount(brand) === 0
  );
}

export function sortBrandsForOps<T extends { isActive: boolean; updatedAt: string; name: string }>(
  brands: T[],
) {
  return [...brands].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const byUpdated = b.updatedAt.localeCompare(a.updatedAt);
    if (byUpdated) return byUpdated;
    return a.name.localeCompare(b.name, 'tr');
  });
}

export function filterBrandsForOps<T extends { name: string; isActive: boolean; description?: string | null }>(
  brands: T[],
  opts: { search: string; status: '' | 'active' | 'passive' },
) {
  const q = opts.search.trim().toLocaleLowerCase('tr-TR');
  return brands.filter((brand) => {
    if (opts.status === 'active' && !brand.isActive) return false;
    if (opts.status === 'passive' && brand.isActive) return false;
    if (!q) return true;
    const hay = `${brand.name} ${brand.description ?? ''}`.toLocaleLowerCase('tr-TR');
    return hay.includes(q);
  });
}
