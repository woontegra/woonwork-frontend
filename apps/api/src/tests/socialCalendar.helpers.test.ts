import { describe, expect, it } from 'vitest';
import type { SocialContentDto } from '../../../web/src/lib/social';
import {
  CALENDAR_DEFAULT_HOUR,
  CALENDAR_MONTHLY_VISIBLE,
  computeScheduledAtOnDrop,
  filterCalendarItems,
  formatWeekRange,
  getMonthGridDays,
  getWeekDays,
  groupItemsByDay,
  isCalendarEventDragDisabled,
  itemsForWeekSlot,
  parseCalendarDropTarget,
  preserveTimeOnDay,
  scheduledAtForSlot,
  startOfWeekMonday,
  toDateKey,
} from '../../../web/src/lib/socialCalendar';

const baseItem = (over: Partial<SocialContentDto> = {}): SocialContentDto => ({
  id: 'c1',
  tenantId: 't1',
  workspaceAreaId: null,
  socialBrandId: 'b1',
  createdById: 'u1',
  title: 'Test başlık',
  description: null,
  contentText: null,
  internalNotes: null,
  contentType: 'POST',
  status: 'DRAFT',
  scheduledAt: '2026-08-12T14:00:00.000Z',
  timezone: 'Europe/Istanbul',
  edited: false,
  approved: false,
  readyToPublish: false,
  published: false,
  publishedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  platforms: [{ id: 'p1', platform: 'INSTAGRAM' }],
  destinations: [],
  media: [],
  brand: { id: 'b1', name: 'Bilirkişi Hesap', color: '#4361ee', isActive: true },
  ...over,
});

describe('socialCalendar helpers', () => {
  it('month grid has 42 days starting Monday', () => {
    const days = getMonthGridDays(new Date(2026, 7, 1));
    expect(days).toHaveLength(42);
    expect((days[0].getDay() + 6) % 7).toBe(0);
  });

  it('week range label includes dates', () => {
    const start = startOfWeekMonday(new Date(2026, 7, 12));
    expect(formatWeekRange(start)).toContain('Ağustos');
  });

  it('preserveTimeOnDay keeps hour on monthly drag', () => {
    const iso = '2026-08-12T14:30:00.000Z';
    const next = preserveTimeOnDay(iso, '2026-08-14');
    const d = new Date(next);
    const prev = new Date(iso);
    expect(d.getHours()).toBe(prev.getHours());
    expect(d.getMinutes()).toBe(prev.getMinutes());
    expect(toDateKey(d)).toBe('2026-08-14');
  });

  it('weekly slot sets exact day and hour', () => {
    const iso = scheduledAtForSlot('2026-08-13', 11);
    const d = new Date(iso);
    expect(toDateKey(d)).toBe('2026-08-13');
    expect(d.getHours()).toBe(11);
  });

  it('computeScheduledAtOnDrop — monthly preserves time', () => {
    const item = baseItem({ scheduledAt: '2026-08-12T17:00:00.000Z' });
    const next = computeScheduledAtOnDrop(item, { kind: 'day', dayKey: '2026-08-14' }, 'month');
    expect(new Date(next).getHours()).toBe(new Date(item.scheduledAt!).getHours());
    expect(toDateKey(new Date(next))).toBe('2026-08-14');
  });

  it('computeScheduledAtOnDrop — weekly changes date and hour', () => {
    const item = baseItem({ scheduledAt: '2026-08-12T17:00:00.000Z' });
    const next = computeScheduledAtOnDrop(item, { kind: 'slot', dayKey: '2026-08-13', hour: 11 }, 'week');
    const d = new Date(next);
    expect(toDateKey(d)).toBe('2026-08-13');
    expect(d.getHours()).toBe(11);
  });

  it('parseCalendarDropTarget', () => {
    expect(parseCalendarDropTarget('day:2026-08-12')).toEqual({ kind: 'day', dayKey: '2026-08-12' });
    expect(parseCalendarDropTarget('slot:2026-08-12:11')).toEqual({
      kind: 'slot',
      dayKey: '2026-08-12',
      hour: 11,
    });
  });

  it('published content drag disabled', () => {
    const item = baseItem({
      published: true,
      destinations: [{ id: 'd1', platform: 'INSTAGRAM', publicationStatus: 'PUBLISHED' } as never],
    });
    expect(isCalendarEventDragDisabled(item).disabled).toBe(true);
  });

  it('filter brand/platform/status/type', () => {
    const items = [
      baseItem({ id: '1', socialBrandId: 'b1', status: 'DRAFT', contentType: 'POST' }),
      baseItem({ id: '2', socialBrandId: 'b2', status: 'APPROVED', contentType: 'REEL' }),
    ];
    expect(filterCalendarItems(items, { brandId: 'b1', platform: '', status: '', contentType: '', search: '' })).toHaveLength(1);
    expect(
      filterCalendarItems(items, { brandId: '', platform: 'INSTAGRAM', status: '', contentType: '', search: '' }),
    ).toHaveLength(2);
    expect(
      filterCalendarItems(items, { brandId: '', platform: '', status: 'APPROVED', contentType: '', search: '' }),
    ).toHaveLength(1);
    expect(
      filterCalendarItems(items, { brandId: '', platform: '', status: '', contentType: 'REEL', search: '' }),
    ).toHaveLength(1);
  });

  it('groupItemsByDay sorts by time', () => {
    const items = [
      baseItem({ id: 'a', scheduledAt: '2026-08-12T18:00:00.000Z' }),
      baseItem({ id: 'b', scheduledAt: '2026-08-12T09:00:00.000Z' }),
    ];
    const map = groupItemsByDay(items);
    expect(map.get('2026-08-12')?.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('itemsForWeekSlot matches hour', () => {
    const iso = scheduledAtForSlot('2026-08-12', 11);
    const items = [baseItem({ scheduledAt: iso })];
    expect(itemsForWeekSlot(items, '2026-08-12', 11)).toHaveLength(1);
    expect(itemsForWeekSlot(items, '2026-08-12', 10)).toHaveLength(0);
  });

  it('monthly visible cap is 3', () => {
    expect(CALENDAR_MONTHLY_VISIBLE).toBe(3);
  });

  it('default hour for empty schedule', () => {
    const next = preserveTimeOnDay(null, '2026-08-12');
    expect(new Date(next).getHours()).toBe(CALENDAR_DEFAULT_HOUR);
  });

  it('getWeekDays returns 7 days from Monday', () => {
    const start = startOfWeekMonday(new Date(2026, 7, 12));
    const days = getWeekDays(start);
    expect(days).toHaveLength(7);
    expect((days[0].getDay() + 6) % 7).toBe(0);
  });
});
