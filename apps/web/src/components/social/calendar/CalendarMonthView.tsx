import { useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { SocialContentDto } from '../../../lib/social';
import {
  CALENDAR_MONTHLY_VISIBLE,
  isWeekend,
  sameDay,
  toDateKey,
} from '../../../lib/socialCalendar';
import { CalendarEventCard } from './CalendarEventCard';
import { CalendarDayOverflowPopover } from './CalendarDayOverflowPopover';

export function CalendarMonthView({
  days,
  cursorMonth,
  today,
  byDay,
  onOpen,
  onQuickAdd,
}: {
  days: Date[];
  cursorMonth: number;
  today: Date;
  byDay: Map<string, SocialContentDto[]>;
  onOpen: (id: string) => void;
  onQuickAdd: (dayKey: string) => void;
}) {
  return (
    <div className="ww-social-calendar-grid">
      <div className="ww-social-calendar-weekdays">
        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => (
          <div key={d} className="ww-social-calendar-weekday">
            {d}
          </div>
        ))}
      </div>
      <div className="ww-social-calendar-month">
        {days.map((date) => (
          <CalendarMonthDayCell
            key={toDateKey(date)}
            date={date}
            inMonth={date.getMonth() === cursorMonth}
            isToday={sameDay(date, today)}
            isWeekend={isWeekend(date)}
            items={byDay.get(toDateKey(date)) ?? []}
            onOpen={onOpen}
            onQuickAdd={() => onQuickAdd(toDateKey(date))}
          />
        ))}
      </div>
    </div>
  );
}

function CalendarMonthDayCell({
  date,
  inMonth,
  isToday,
  isWeekend,
  items,
  onOpen,
  onQuickAdd,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  items: SocialContentDto[];
  onOpen: (id: string) => void;
  onQuickAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${toDateKey(date)}` });
  const overflowRef = useRef<HTMLButtonElement>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const visible = items.slice(0, CALENDAR_MONTHLY_VISIBLE);
  const hidden = items.slice(CALENDAR_MONTHLY_VISIBLE);

  return (
    <div
      ref={setNodeRef}
      onClick={onQuickAdd}
      className={`ww-social-calendar-day ${inMonth ? '' : 'is-outside'} ${isWeekend ? 'is-weekend' : ''} ${
        isToday ? 'is-today' : ''
      } ${isOver ? 'is-drop-over' : ''}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] tabular-nums ${
            isToday
              ? 'bg-accent font-medium text-white'
              : inMonth
                ? 'text-[var(--ww-text-secondary)]'
                : 'text-ink-300'
          }`}
        >
          {date.getDate()}
        </span>
      </div>
      <div className="space-y-0.5" onClick={(e) => e.stopPropagation()}>
        {visible.map((item) => (
          <CalendarEventCard key={item.id} item={item} mode="month" onOpen={() => onOpen(item.id)} />
        ))}
        {hidden.length ? (
          <>
            <button
              ref={overflowRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOverflowOpen(true);
              }}
              className="px-0.5 text-[10px] text-accent-strong hover:underline"
            >
              +{hidden.length} daha
            </button>
            <CalendarDayOverflowPopover
              open={overflowOpen}
              anchorRef={overflowRef}
              date={date}
              items={items}
              onClose={() => setOverflowOpen(false)}
              onOpen={onOpen}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
