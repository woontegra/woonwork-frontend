import { useDroppable } from '@dnd-kit/core';
import type { SocialContentDto } from '../../../lib/social';
import {
  CALENDAR_HOURS,
  CALENDAR_WEEKDAYS,
  itemsForWeekSlot,
  sameDay,
  toDateKey,
} from '../../../lib/socialCalendar';
import { CalendarEventCard } from './CalendarEventCard';

export function CalendarWeekView({
  weekDays,
  today,
  items,
  onOpen,
  onSlotClick,
}: {
  weekDays: Date[];
  today: Date;
  items: SocialContentDto[];
  onOpen: (id: string) => void;
  onSlotClick: (dayKey: string, hour: number) => void;
}) {
  return (
    <div className="ww-social-calendar-week-wrap overflow-auto">
      <div className="ww-social-calendar-week min-w-[760px]">
        <div className="ww-social-calendar-week-head">
          <div className="ww-social-calendar-time-gutter" />
          {weekDays.map((date) => (
            <div
              key={toDateKey(date)}
              className={`ww-social-calendar-week-day-head ${sameDay(date, today) ? 'is-today' : ''}`}
            >
              <span className="text-[10px] uppercase tracking-normal text-ink-400">
                {CALENDAR_WEEKDAYS[(date.getDay() + 6) % 7]}
              </span>
              <span
                className={`text-[12px] tabular-nums ${
                  sameDay(date, today) ? 'font-medium text-accent-strong' : 'text-[var(--ww-text)]'
                }`}
              >
                {date.getDate()}
              </span>
            </div>
          ))}
        </div>
        <div className="ww-social-calendar-week-body">
          {CALENDAR_HOURS.map((hour) => (
            <div key={hour} className="ww-social-calendar-week-row">
              <div className="ww-social-calendar-time-gutter text-[10px] tabular-nums text-ink-400">
                {String(hour).padStart(2, '0')}:00
              </div>
              {weekDays.map((date) => {
                const dayKey = toDateKey(date);
                const slotItems = itemsForWeekSlot(items, dayKey, hour);
                return (
                  <WeekSlotCell
                    key={`${dayKey}-${hour}`}
                    dayKey={dayKey}
                    hour={hour}
                    items={slotItems}
                    onOpen={onOpen}
                    onSlotClick={() => onSlotClick(dayKey, hour)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WeekSlotCell({
  dayKey,
  hour,
  items,
  onOpen,
  onSlotClick,
}: {
  dayKey: string;
  hour: number;
  items: SocialContentDto[];
  onOpen: (id: string) => void;
  onSlotClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${dayKey}:${hour}` });
  return (
    <div
      ref={setNodeRef}
      onClick={onSlotClick}
      className={`ww-social-calendar-week-slot ${isOver ? 'is-drop-over' : ''}`}
    >
      <div className="space-y-0.5" onClick={(e) => e.stopPropagation()}>
        {items.map((item) => (
          <CalendarEventCard key={item.id} item={item} mode="week" onOpen={() => onOpen(item.id)} />
        ))}
      </div>
    </div>
  );
}
