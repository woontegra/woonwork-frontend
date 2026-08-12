import type { RefObject } from 'react';
import type { SocialContentDto } from '../../../lib/social';
import { formatCalendarTime, getCalendarEventVisual, eventPlatforms } from '../../../lib/socialCalendar';
import { SocialPlatformIcon } from '../SocialPlatformIcon';
import { AnchoredPopover } from '../AnchoredPopover';

export function CalendarDayOverflowPopover({
  open,
  anchorRef,
  date,
  items,
  onClose,
  onOpen,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  date: Date;
  items: SocialContentDto[];
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const title = new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

  return (
    <AnchoredPopover open={open} anchorRef={anchorRef} onClose={onClose} width={300} className="py-1">
      <p className="border-b border-[var(--ww-border)] px-2.5 py-1.5 text-[11px] font-medium capitalize text-[var(--ww-text-muted)]">
        {title}
      </p>
      <div className="max-h-[280px] overflow-y-auto py-0.5">
        {items.map((item) => {
          const visual = getCalendarEventVisual(item);
          const platforms = eventPlatforms(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onOpen(item.id);
                onClose();
              }}
              className={`flex w-full items-start gap-2 px-2.5 py-1.5 text-left hover:bg-ink-50 ${visual.className}`}
            >
              <span className="shrink-0 tabular-nums text-[11px] text-[var(--ww-text-muted)]">
                {formatCalendarTime(item.scheduledAt)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-[var(--ww-text)]">{item.title}</span>
                <span className="mt-0.5 flex items-center gap-1">
                  {platforms.map((p) => (
                    <SocialPlatformIcon key={p} platform={p} size={11} muted />
                  ))}
                  <span className="text-[10px] text-[var(--ww-text-muted)]">{visual.label}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </AnchoredPopover>
  );
}
