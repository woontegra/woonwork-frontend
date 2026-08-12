import type { SocialContentStatus, SocialContentType, SocialPlatform } from '@woonwork/shared';
import type { SocialContentDto } from './social';
import { getPublicationDisplayStatus, getStatusBadgeLabel } from './socialContentTable';

export type CalendarView = 'month' | 'week';

export const CALENDAR_WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;
export const CALENDAR_HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // 08–23
export const CALENDAR_MONTHLY_VISIBLE = 3;
export const CALENDAR_DEFAULT_HOUR = 9;

export type CalendarDropTarget =
  | { kind: 'day'; dayKey: string }
  | { kind: 'slot'; dayKey: string; hour: number };

export type CalendarEventVisual = {
  label: string;
  tone:
    | 'draft'
    | 'review'
    | 'approved'
    | 'ready'
    | 'scheduled'
    | 'published'
    | 'failed'
    | 'partial'
    | 'idea'
    | 'cancelled';
  className: string;
  dragDisabled: boolean;
  dragDisabledReason?: string;
};

const EVENT_TONE_CLASS: Record<CalendarEventVisual['tone'], string> = {
  draft: 'bg-ink-50/85 border-ink-200/50',
  idea: 'bg-ink-50/70 border-ink-200/40',
  review: 'bg-blue-50/85 border-blue-200/50',
  approved: 'bg-emerald-50/85 border-emerald-200/50',
  ready: 'bg-teal-50/85 border-teal-200/55',
  scheduled: 'bg-violet-50/85 border-violet-200/50',
  published: 'bg-emerald-50/90 border-emerald-300/55',
  failed: 'bg-red-50/90 border-red-200/60',
  partial: 'bg-amber-50/90 border-amber-200/60',
  cancelled: 'bg-ink-50/45 border-ink-200/35 text-ink-400',
};

export function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeekSunday(weekStart: Date) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function getMonthGridDays(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return date;
  });
}

export function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });
}

export function formatCalendarTime(iso: string | null) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function formatWeekRange(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const fmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const startPart = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(weekStart);
  const endPart = fmt.format(weekEnd);
  if (weekStart.getMonth() === weekEnd.getMonth() && weekStart.getFullYear() === weekEnd.getFullYear()) {
    return `${weekStart.getDate()}–${weekEnd.getDate()} ${new Intl.DateTimeFormat('tr-TR', {
      month: 'long',
      year: 'numeric',
    }).format(weekStart)}`;
  }
  return `${startPart} – ${endPart}`;
}

export function preserveTimeOnDay(existing: string | null, dayKey: string) {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (existing) {
    const prev = new Date(existing);
    if (!Number.isNaN(prev.getTime())) {
      const next = new Date(prev);
      next.setFullYear(y, m - 1, d);
      return next.toISOString();
    }
  }
  return new Date(y, m - 1, d, CALENDAR_DEFAULT_HOUR, 0, 0).toISOString();
}

export function scheduledAtForSlot(dayKey: string, hour: number, minute = 0) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0).toISOString();
}

export function parseCalendarDropTarget(overId: string): CalendarDropTarget | null {
  if (overId.startsWith('day:')) {
    return { kind: 'day', dayKey: overId.slice(4) };
  }
  if (overId.startsWith('slot:')) {
    const [, dayKey, hourRaw] = overId.split(':');
    if (!dayKey || hourRaw == null) return null;
    const hour = Number(hourRaw);
    if (Number.isNaN(hour)) return null;
    return { kind: 'slot', dayKey, hour };
  }
  return null;
}

export function computeScheduledAtOnDrop(
  item: Pick<SocialContentDto, 'scheduledAt'>,
  target: CalendarDropTarget,
  view: CalendarView,
) {
  if (target.kind === 'slot' || view === 'week') {
    const hour = target.kind === 'slot' ? target.hour : CALENDAR_DEFAULT_HOUR;
    if (item.scheduledAt && target.kind === 'day') {
      const prev = new Date(item.scheduledAt);
      return scheduledAtForSlot(target.dayKey, prev.getHours(), prev.getMinutes());
    }
    return scheduledAtForSlot(target.dayKey, hour);
  }
  return preserveTimeOnDay(item.scheduledAt, target.dayKey);
}

export function isCalendarEventDragDisabled(item: SocialContentDto) {
  if (item.published) {
    return { disabled: true, reason: 'Yayınlanmış içerik yeniden planlanamaz.' };
  }
  const destinations = item.destinations ?? [];
  if (destinations.length > 0 && destinations.every((d) => d.publicationStatus === 'PUBLISHED')) {
    return { disabled: true, reason: 'Yayınlanmış içerik yeniden planlanamaz.' };
  }
  return { disabled: false as const };
}

export function getCalendarEventVisual(item: SocialContentDto): CalendarEventVisual {
  const display = getPublicationDisplayStatus(item);
  const drag = isCalendarEventDragDisabled(item);
  let tone: CalendarEventVisual['tone'] = 'draft';

  if (display.variant === 'failed') tone = 'failed';
  else if (display.variant === 'partial') tone = 'partial';
  else if (display.variant === 'published') tone = 'published';
  else if (item.readyToPublish && !item.published) tone = 'ready';
  else if (item.status === 'IN_REVIEW') tone = 'review';
  else if (item.status === 'APPROVED') tone = 'approved';
  else if (item.status === 'SCHEDULED') tone = 'scheduled';
  else if (item.status === 'IDEA') tone = 'idea';
  else if (item.status === 'CANCELLED') tone = 'cancelled';
  else if (item.status === 'DRAFT') tone = 'draft';

  return {
    label: getStatusBadgeLabel(item),
    tone,
    className: EVENT_TONE_CLASS[tone],
    dragDisabled: drag.disabled,
    dragDisabledReason: drag.reason,
  };
}

export function eventPlatforms(item: SocialContentDto): SocialPlatform[] {
  const fromDest = (item.destinations ?? []).map((d) => d.platform);
  const fromItem = item.platforms.map((p) => p.platform);
  return [...new Set([...fromDest, ...fromItem])];
}

export type CalendarFilters = {
  brandId: string;
  platform: '' | SocialPlatform;
  status: '' | SocialContentStatus;
  contentType: '' | SocialContentType;
  search: string;
};

export function filterCalendarItems(items: SocialContentDto[], filters: CalendarFilters) {
  const q = filters.search.trim().toLocaleLowerCase('tr-TR');
  return items.filter((item) => {
    if (filters.brandId && item.socialBrandId !== filters.brandId) return false;
    if (filters.platform) {
      const platforms = eventPlatforms(item);
      if (!platforms.includes(filters.platform)) return false;
    }
    if (filters.status && item.status !== filters.status) return false;
    if (filters.contentType && item.contentType !== filters.contentType) return false;
    if (q) {
      const hay = `${item.title} ${item.brand?.name ?? ''}`.toLocaleLowerCase('tr-TR');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function groupItemsByDay(items: SocialContentDto[]) {
  const map = new Map<string, SocialContentDto[]>();
  for (const item of items) {
    if (!item.scheduledAt) continue;
    const key = toDateKey(new Date(item.scheduledAt));
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  for (const [key, list] of map) {
    list.sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());
    map.set(key, list);
  }
  return map;
}

export function itemsForWeekSlot(items: SocialContentDto[], dayKey: string, hour: number) {
  return items.filter((item) => {
    if (!item.scheduledAt) return false;
    const d = new Date(item.scheduledAt);
    return toDateKey(d) === dayKey && d.getHours() === hour;
  });
}

export function calendarEventTooltip(item: SocialContentDto) {
  const lines = [
    item.title,
    item.brand?.name ? `Marka: ${item.brand.name}` : null,
    item.scheduledAt ? `Plan: ${formatCalendarTime(item.scheduledAt)} · ${toDateKey(new Date(item.scheduledAt))}` : null,
    getCalendarEventVisual(item).label,
  ].filter(Boolean);
  return lines.join('\n');
}
