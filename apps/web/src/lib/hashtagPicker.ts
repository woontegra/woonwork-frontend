export const HASHTAG_PICKER_TABS = [
  { id: 'usable' as const, label: 'Kullanılabilir' },
  { id: 'recent' as const, label: 'Son Kullanılan' },
  { id: 'frequent' as const, label: 'Sık Kullanılan' },
  { id: 'blocked' as const, label: 'Blocklist' },
];

/** Chip sonuç alanı; header/footer sabit, yalnız bu bölge scroll olur. */
export const HASHTAG_PICKER_RESULTS_MAX_HEIGHT = 240;

export function toggleHashtagSelection(selected: Iterable<string>, id: string, selectable: boolean): Set<string> {
  const next = new Set(selected);
  if (!selectable) return next;
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function hashtagPickerFooterLabel(count: number): string {
  return count > 0 ? `${count} hashtag seçildi` : 'Seçim yok';
}

export function hashtagPickerInsertEnabled(count: number): boolean {
  return count > 0;
}

export function hashtagPickerChipTooltip(item: {
  tag: string;
  usageCount: number;
  lastUsedAt: string | null;
  status: string;
}): string {
  if (item.status === 'BLOCKED') return 'Blocklist';
  const lines = [item.tag];
  lines.push(item.usageCount > 0 ? `${item.usageCount} kez kullanıldı` : 'Henüz kullanılmadı');
  if (item.lastUsedAt) {
    const d = new Date(item.lastUsedAt);
    if (!Number.isNaN(d.getTime())) {
      const date = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(d);
      lines.push(`Son kullanım: ${date}`);
    }
  }
  return lines.join('\n');
}
