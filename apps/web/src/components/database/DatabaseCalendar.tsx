import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import type { SelectOption } from '@woonwork/shared';
import { Button, Input } from '../ui/Form';
import {
  cellValue,
  createRow,
  updateCell,
  type DatabaseDto,
  type DatabasePropertyDto,
  type DatabaseRowDto,
  type DatabaseViewDto,
} from '../../lib/database';
import { useToast } from '../ui/Toast';

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseCellDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function preserveTimeOnDay(existing: unknown, dayKey: string): string {
  const prev = parseCellDate(existing);
  if (prev) {
    const [y, m, d] = dayKey.split('-').map(Number);
    const next = new Date(prev);
    next.setFullYear(y, m - 1, d);
    return next.toISOString();
  }
  return `${dayKey}T09:00:00.000Z`;
}

function EventChip({
  row,
  title,
  statusColor,
  onOpen,
}: {
  row: DatabaseRowDto;
  title: string;
  statusColor?: string;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: row.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={`flex w-full items-center gap-1.5 truncate border border-[var(--ww-border)] bg-white px-1.5 py-1 text-left text-[11px] font-medium text-[var(--ww-text)] hover:border-accent/35 ${
        isDragging ? 'opacity-50 shadow-[var(--ww-shadow-sm)]' : ''
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          statusColor === 'green'
            ? 'bg-emerald-500'
            : statusColor === 'blue'
              ? 'bg-sky-500'
              : statusColor === 'red'
                ? 'bg-rose-500'
                : 'bg-ink-400'
        }`}
      />
      <span className="truncate">{title || 'Adsız'}</span>
    </button>
  );
}

function DayCell({
  day,
  inMonth,
  isToday,
  events,
  titlePropId,
  statusProp,
  onOpen,
  onDayClick,
}: {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  events: DatabaseRowDto[];
  titlePropId: string | null;
  statusProp: DatabasePropertyDto | null;
  onOpen: (row: DatabaseRowDto) => void;
  onDayClick: (day: Date) => void;
}) {
  const key = `day:${toDateKey(day)}`;
  const { setNodeRef, isOver } = useDroppable({ id: key });
  const visible = events.slice(0, 3);
  const more = events.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      onClick={() => onDayClick(day)}
      className={`min-h-[112px] border-b border-r border-[var(--ww-border)] p-1.5 ${
        inMonth ? 'bg-white' : 'bg-canvas/70'
      } ${isOver ? 'bg-accent-soft/40' : ''}`}
    >
      <div
        className={`mb-1.5 inline-flex h-6 min-w-6 items-center justify-center px-1 text-xs font-semibold ${
          isToday
            ? 'bg-accent text-white'
            : inMonth
              ? 'text-[var(--ww-text)]'
              : 'text-[var(--ww-text-muted)]'
        }`}
      >
        {day.getDate()}
      </div>
      <div className="space-y-1">
        {visible.map((row) => {
          const title = titlePropId ? String(cellValue(row, titlePropId) ?? '') : '';
          let statusColor: string | undefined;
          if (statusProp) {
            const optId = cellValue(row, statusProp.id);
            const opt = ((statusProp.config?.options ?? []) as SelectOption[]).find(
              (o) => o.id === optId,
            );
            statusColor = opt?.color;
          }
          return (
            <EventChip
              key={row.id}
              row={row}
              title={title}
              statusColor={statusColor}
              onOpen={() => onOpen(row)}
            />
          );
        })}
        {more > 0 ? (
          <p className="px-1 text-[10px] font-medium text-[var(--ww-text-muted)]">+{more} daha</p>
        ) : null}
      </div>
    </div>
  );
}

export function DatabaseCalendar({
  database,
  view,
  rows,
  undatedRows,
  undatedTotal,
  cursor,
  onCursorChange,
  onRowsChange,
  onOpenRecord,
  onReloadUndated,
}: {
  database: DatabaseDto;
  view: DatabaseViewDto;
  rows: DatabaseRowDto[];
  undatedRows: DatabaseRowDto[];
  undatedTotal: number;
  cursor: Date;
  onCursorChange: (d: Date) => void;
  onRowsChange: (rows: DatabaseRowDto[]) => void;
  onOpenRecord: (row: DatabaseRowDto) => void;
  onReloadUndated: () => void;
}) {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [undatedOpen, setUndatedOpen] = useState(false);
  const [composerDay, setComposerDay] = useState<string | null>(null);
  const [composerTitle, setComposerTitle] = useState('');

  const datePropId = view.config.datePropertyId;
  const titleProp = useMemo(
    () => database.properties?.find((p) => p.type === 'TITLE') ?? null,
    [database.properties],
  );
  const statusProp = useMemo(
    () => database.properties?.find((p) => p.type === 'STATUS') ?? null,
    [database.properties],
  );

  const days = useMemo(() => {
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
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, DatabaseRowDto[]>();
    for (const row of rows) {
      if (!datePropId) continue;
      const d = parseCellDate(cellValue(row, datePropId));
      if (!d) continue;
      const key = toDateKey(d);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [datePropId, rows]);

  const monthLabel = new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
  }).format(cursor);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(event: DragEndEvent) {
    if (!datePropId) return;
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith('day:')) return;
    const dayKey = overId.slice(4);
    const rowId = String(active.id);
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const prev = cellValue(row, datePropId);
    const nextVal = preserveTimeOnDay(prev, dayKey);
    const snapshot = rows;
    onRowsChange(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        const cells = [...r.cells];
        const idx = cells.findIndex((c) => c.propertyId === datePropId);
        if (idx >= 0) cells[idx] = { ...cells[idx], value: nextVal };
        else {
          cells.push({
            id: `temp-${datePropId}`,
            tenantId: r.tenantId,
            rowId,
            propertyId: datePropId,
            value: nextVal,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        return { ...r, cells };
      }),
    );
    try {
      await updateCell(database.id, rowId, datePropId, nextVal);
    } catch (err) {
      onRowsChange(snapshot);
      toast((err as Error).message || 'Tarih güncellenemedi', 'error');
    }
  }

  async function submitComposer() {
    if (!composerDay || !titleProp || !datePropId) return;
    try {
      const created = await createRow(database.id, {
        cells: [
          { propertyId: titleProp.id, value: composerTitle.trim() || '' },
          { propertyId: datePropId, value: `${composerDay}T09:00:00.000Z` },
        ],
      });
      onRowsChange([...rows, created]);
      setComposerDay(null);
      setComposerTitle('');
      onOpenRecord(created);
    } catch (err) {
      toast((err as Error).message || 'Kayıt oluşturulamadı', 'error');
    }
  }

  if (!datePropId) {
    return (
      <div className="border border-dashed border-[var(--ww-border)] px-4 py-8 text-sm text-[var(--ww-text-muted)]">
        Takvim görünümü için bir Tarih alanı gerekiyor.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Önceki ay"
            onClick={() =>
              onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              const now = new Date();
              onCursorChange(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            Bugün
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Sonraki ay"
            onClick={() =>
              onCursorChange(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={16} />
          </Button>
          <AnimatePresence mode="wait">
            <motion.p
              key={monthLabel}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              className="ml-2 text-sm font-semibold capitalize tracking-tight text-[var(--ww-text)]"
            >
              {monthLabel}
            </motion.p>
          </AnimatePresence>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 border border-[var(--ww-border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--ww-text-secondary)] hover:border-accent/30"
          onClick={() => {
            setUndatedOpen((v) => !v);
            onReloadUndated();
          }}
        >
          <CalendarDays size={14} />
          Tarihsiz
          {undatedTotal ? (
            <span className="rounded bg-ink-50 px-1.5 text-[10px]">{undatedTotal}</span>
          ) : null}
        </button>
      </div>

      {undatedOpen ? (
        <div className="border border-[var(--ww-border)] bg-white p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ww-text-muted)]">
            Tarihsiz kayıtlar
          </p>
          {!undatedRows.length ? (
            <p className="text-xs text-[var(--ww-text-muted)]">Tarihsiz kayıt yok</p>
          ) : (
            <ul className="divide-y divide-[var(--ww-border)]">
              {undatedRows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="flex w-full px-1 py-2 text-left text-sm hover:bg-accent-soft/40"
                    onClick={() => onOpenRecord(row)}
                  >
                    {titleProp
                      ? String(cellValue(row, titleProp.id) ?? 'Adsız')
                      : 'Adsız'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {composerDay ? (
        <div className="flex flex-wrap items-end gap-2 border border-[var(--ww-border)] bg-white p-3">
          <Input
            label={`${composerDay} · yeni kayıt`}
            value={composerTitle}
            onChange={(e) => setComposerTitle(e.target.value)}
            placeholder="Başlık"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitComposer();
            }}
          />
          <Button type="button" onClick={() => void submitComposer()}>
            Kaydet
          </Button>
          <Button type="button" variant="secondary" onClick={() => setComposerDay(null)}>
            Vazgeç
          </Button>
        </div>
      ) : null}

      <DndContext sensors={sensors} onDragEnd={(e) => void onDragEnd(e)}>
        <div className="overflow-hidden border border-[var(--ww-border)] bg-white">
          <div className="grid grid-cols-7 border-b border-[var(--ww-border)] bg-[#f8f9fb]">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ww-text-muted)]"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => (
              <DayCell
                key={day.toISOString()}
                day={day}
                inMonth={day.getMonth() === cursor.getMonth()}
                isToday={sameDay(day, new Date())}
                events={byDay.get(toDateKey(day)) ?? []}
                titlePropId={titleProp?.id ?? null}
                statusProp={statusProp}
                onOpen={onOpenRecord}
                onDayClick={(d) => {
                  setComposerDay(toDateKey(d));
                  setComposerTitle('');
                }}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}
