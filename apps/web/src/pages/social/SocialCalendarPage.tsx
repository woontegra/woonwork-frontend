import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { SocialContentStatus, SocialContentType, SocialPlatform } from '@woonwork/shared';
import { Button, Select, SocialFilterToolbar } from '../../components/social/SocialControls';
import { CalendarMonthView } from '../../components/social/calendar/CalendarMonthView';
import { CalendarWeekView } from '../../components/social/calendar/CalendarWeekView';
import { CalendarUnscheduledPanel } from '../../components/social/calendar/CalendarUnscheduledPanel';
import { useToast } from '../../components/ui/Toast';
import {
  ALL_PLATFORMS,
  ALL_STATUSES,
  ALL_TYPES,
  contentTypeLabels,
  fetchCalendar,
  fetchUnscheduled,
  platformLabels,
  statusLabels,
  updateContent,
  type SocialContentDto,
} from '../../lib/social';
import {
  type CalendarView,
  computeScheduledAtOnDrop,
  endOfWeekSunday,
  filterCalendarItems,
  formatWeekRange,
  getMonthGridDays,
  getWeekDays,
  groupItemsByDay,
  isCalendarEventDragDisabled,
  parseCalendarDropTarget,
  preserveTimeOnDay,
  scheduledAtForSlot,
  startOfWeekMonday,
} from '../../lib/socialCalendar';
import { useSocialWorkspace } from './SocialLayout';

export function SocialCalendarPage() {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const { openComposer, bump, brands } = useSocialWorkspace();

  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [items, setItems] = useState<SocialContentDto[]>([]);
  const [unscheduled, setUnscheduled] = useState<SocialContentDto[]>([]);
  const [unscheduledOpen, setUnscheduledOpen] = useState(false);

  const [brandId, setBrandId] = useState('');
  const [platform, setPlatform] = useState<'' | SocialPlatform>('');
  const [status, setStatus] = useState<'' | SocialContentStatus>('');
  const [contentType, setContentType] = useState<'' | SocialContentType>('');

  const monthDays = useMemo(() => getMonthGridDays(cursor), [cursor]);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const range = useMemo(() => {
    if (view === 'week') {
      const start = weekStart;
      const end = endOfWeekSunday(weekStart);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    const start = monthDays[0];
    const end = new Date(monthDays[41]);
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [view, monthDays, weekStart]);

  useEffect(() => {
    void fetchCalendar(range.start, range.end)
      .then(setItems)
      .catch((err) => toast((err as Error).message || 'Takvim alınamadı', 'error'));
    void fetchUnscheduled()
      .then(setUnscheduled)
      .catch(() => setUnscheduled([]));
  }, [range.start, range.end, bump, toast]);

  useEffect(() => {
    if (!unscheduled.length && unscheduledOpen) setUnscheduledOpen(false);
  }, [unscheduled.length, unscheduledOpen]);

  const filteredItems = useMemo(
    () => filterCalendarItems(items, { brandId, platform, status, contentType, search: '' }),
    [items, brandId, platform, status, contentType],
  );

  const filteredUnscheduled = useMemo(
    () => filterCalendarItems(unscheduled, { brandId, platform, status, contentType, search: '' }),
    [unscheduled, brandId, platform, status, contentType],
  );

  const byDay = useMemo(() => groupItemsByDay(filteredItems), [filteredItems]);

  const monthLabel = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(cursor);
  const weekLabel = formatWeekRange(weekStart);
  const today = new Date();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function goToday() {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setWeekStart(startOfWeekMonday(now));
  }

  function goPrev() {
    if (view === 'month') {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    } else {
      const next = new Date(weekStart);
      next.setDate(next.getDate() - 7);
      setWeekStart(next);
    }
  }

  function goNext() {
    if (view === 'month') {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
    } else {
      const next = new Date(weekStart);
      next.setDate(next.getDate() + 7);
      setWeekStart(next);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const target = parseCalendarDropTarget(String(over.id));
    if (!target) return;

    const id = String(active.id);
    const fromCalendar = items.find((x) => x.id === id);
    const fromUnscheduled = unscheduled.find((x) => x.id === id);
    const item = fromCalendar ?? fromUnscheduled;
    if (!item) return;

    const dragCheck = isCalendarEventDragDisabled(item);
    if (dragCheck.disabled) {
      toast(dragCheck.reason ?? 'Bu içerik yeniden planlanamaz.', 'error');
      return;
    }

    const nextVal = computeScheduledAtOnDrop(item, target, view);
    const snapshotItems = items;
    const snapshotUnscheduled = unscheduled;

    const optimistic = { ...item, scheduledAt: nextVal };
    setItems((prev) => {
      const without = prev.filter((x) => x.id !== id);
      return [...without, optimistic].sort(
        (a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime(),
      );
    });
    if (fromUnscheduled) {
      setUnscheduled((prev) => prev.filter((x) => x.id !== id));
    }

    try {
      const saved = await updateContent(id, { scheduledAt: nextVal });
      setItems((prev) => prev.map((x) => (x.id === id ? saved : x)));
    } catch (err) {
      setItems(snapshotItems);
      setUnscheduled(snapshotUnscheduled);
      toast((err as Error).message || 'Tarih güncellenemedi', 'error');
    }
  }

  const hasScheduledInView = filteredItems.length > 0;

  return (
    <>
      <div className="ww-social-calendar-page flex flex-col gap-2">
        <SocialFilterToolbar className="ww-calendar-toolbar">
          <Select size="toolbar" value={brandId} onChange={(e) => setBrandId(e.target.value)} className="w-[100px] shrink-0">
            <option value="">Marka</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select
            size="toolbar"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as '' | SocialPlatform)}
            className="w-[96px] shrink-0"
          >
            <option value="">Platform</option>
            {ALL_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {platformLabels[p]}
              </option>
            ))}
          </Select>
          <Select
            size="toolbar"
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | SocialContentStatus)}
            className="w-[88px] shrink-0"
          >
            <option value="">Durum</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </Select>
          <Select
            size="toolbar"
            value={contentType}
            onChange={(e) => setContentType(e.target.value as '' | SocialContentType)}
            className="w-[80px] shrink-0"
          >
            <option value="">Tip</option>
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {contentTypeLabels[t]}
              </option>
            ))}
          </Select>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              disabled={!filteredUnscheduled.length}
              onClick={() => {
                if (!filteredUnscheduled.length) return;
                setUnscheduledOpen((v) => !v);
              }}
              className={!filteredUnscheduled.length ? 'opacity-40' : ''}
            >
              <CalendarDays size={12} />
              Plansız
              {filteredUnscheduled.length ? (
                <span className="text-[var(--ww-text-muted)]">{filteredUnscheduled.length}</span>
              ) : null}
            </Button>
            <Button onClick={() => openComposer()}>
              <Plus size={12} strokeWidth={1.75} />
              Yeni İçerik
            </Button>
          </div>
        </SocialFilterToolbar>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="secondary" size="icon" aria-label="Önceki" onClick={goPrev}>
            <ChevronLeft size={15} />
          </Button>
          <Button type="button" variant="secondary" onClick={goToday}>
            Bugün
          </Button>
          <Button type="button" variant="secondary" size="icon" aria-label="Sonraki" onClick={goNext}>
            <ChevronRight size={15} />
          </Button>
          <div
            role="tablist"
            aria-label="Takvim görünümü"
            className="ml-1 inline-flex h-[30px] items-center rounded-[6px] border border-[var(--ww-border)] bg-white p-0.5"
          >
            {([
              { id: 'month' as const, label: 'Ay' },
              { id: 'week' as const, label: 'Hafta' },
            ]).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={view === opt.id}
                onClick={() => setView(opt.id)}
                className={`h-[26px] min-w-[52px] rounded-[5px] px-2.5 text-[12px] font-medium leading-none transition ${
                  view === opt.id
                    ? 'bg-ink-950 text-white'
                    : 'text-[var(--ww-text-secondary)] hover:bg-ink-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={view === 'month' ? monthLabel : weekLabel}
              initial={reduceMotion ? false : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
              className="ml-1 text-[13px] font-medium capitalize tracking-tight text-[var(--ww-text)]"
            >
              {view === 'month' ? monthLabel : weekLabel}
            </motion.p>
          </AnimatePresence>
          {!hasScheduledInView ? (
            <p className="ml-auto text-[11px] text-[var(--ww-text-muted)]">
              {view === 'month' ? 'Bu ay planlanmış içerik yok.' : 'Bu hafta planlanmış içerik yok.'}
            </p>
          ) : null}
        </div>

        <DndContext sensors={sensors} onDragEnd={(e) => void onDragEnd(e)}>
          <div className="ww-social-calendar-shell overflow-hidden">
            {view === 'month' ? (
              <CalendarMonthView
                days={monthDays}
                cursorMonth={cursor.getMonth()}
                today={today}
                byDay={byDay}
                onOpen={(id) => openComposer({ contentId: id })}
                onQuickAdd={(dayKey) =>
                  openComposer({ scheduledAt: preserveTimeOnDay(null, dayKey) })
                }
              />
            ) : (
              <CalendarWeekView
                weekDays={weekDays}
                today={today}
                items={filteredItems}
                onOpen={(id) => openComposer({ contentId: id })}
                onSlotClick={(dayKey, hour) =>
                  openComposer({ scheduledAt: scheduledAtForSlot(dayKey, hour) })
                }
              />
            )}
          </div>

          <CalendarUnscheduledPanel
            open={unscheduledOpen && filteredUnscheduled.length > 0}
            items={filteredUnscheduled}
            onClose={() => setUnscheduledOpen(false)}
            onOpen={(id) => openComposer({ contentId: id })}
          />
        </DndContext>
      </div>
    </>
  );
}
