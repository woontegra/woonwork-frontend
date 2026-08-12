import { useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { SocialPlatform } from '@woonwork/shared';
import { contentTypeLabels, type SocialContentDto } from '../../../lib/social';
import {
  calendarEventTooltip,
  formatCalendarTime,
  getCalendarEventVisual,
  eventPlatforms,
} from '../../../lib/socialCalendar';
import { SocialPlatformIcon } from '../SocialPlatformIcon';
import { AnchoredPopover } from '../AnchoredPopover';

export function CalendarEventCard({
  item,
  mode,
  onOpen,
}: {
  item: SocialContentDto;
  mode: 'month' | 'week' | 'list';
  onOpen: () => void;
}) {
  const visual = getCalendarEventVisual(item);
  const platforms = eventPlatforms(item);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [tipOpen, setTipOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: visual.dragDisabled,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const brandColor = item.brand?.color;

  function mergeRef(node: HTMLButtonElement | null) {
    setNodeRef(node);
    anchorRef.current = node;
  }

  return (
    <>
      <button
        ref={mergeRef}
        type="button"
        style={{
          ...style,
          borderLeftWidth: brandColor ? 2 : 1,
          borderLeftColor: brandColor ?? undefined,
        }}
        {...(visual.dragDisabled ? {} : { ...listeners, ...attributes })}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        onMouseEnter={() => setTipOpen(true)}
        onMouseLeave={() => setTipOpen(false)}
        onFocus={() => setTipOpen(true)}
        onBlur={() => setTipOpen(false)}
        title={visual.dragDisabled ? visual.dragDisabledReason : undefined}
        className={`group flex w-full min-w-0 text-left transition ${
          mode === 'month'
            ? 'flex-col gap-0.5 rounded-[4px] border px-1.5 py-1'
            : 'flex-col gap-0.5 rounded-[5px] border px-1.5 py-1'
        } ${visual.className} ${
          visual.dragDisabled ? 'cursor-default opacity-95' : 'cursor-grab active:cursor-grabbing'
        } ${isDragging ? 'z-20 opacity-60 shadow-[var(--ww-shadow-sm)]' : 'hover:brightness-[0.98]'}`}
      >
        {mode === 'month' ? (
          <>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 tabular-nums text-[10px] font-medium text-[var(--ww-text-secondary)]">
                {formatCalendarTime(item.scheduledAt)}
              </span>
              <span className="min-w-0 truncate text-[10px] text-[var(--ww-text-muted)]">
                {item.brand?.name ?? '—'}
              </span>
            </span>
            <span className="truncate text-[11px] font-medium leading-snug text-[var(--ww-text)]">
              {item.title || 'Adsız içerik'}
            </span>
            <span className="flex items-center justify-between gap-1">
              <span className="inline-flex shrink-0 items-center gap-0.5">
                {platforms.slice(0, 2).map((p: SocialPlatform) => (
                  <SocialPlatformIcon key={p} platform={p} size={11} />
                ))}
              </span>
              <span className="min-w-0 truncate text-[10px] text-[var(--ww-text-muted)]">
                {contentTypeLabels[item.contentType]} · {visual.label}
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1 text-[10px] text-[var(--ww-text-muted)]">
              <span className="tabular-nums font-medium text-[var(--ww-text-secondary)]">
                {formatCalendarTime(item.scheduledAt)}
              </span>
              {item.brand?.name ? <span className="truncate">{item.brand.name}</span> : null}
            </span>
            <span className="line-clamp-2 text-[11px] font-medium leading-snug text-[var(--ww-text)]">
              {item.title || 'Adsız içerik'}
            </span>
            <span className="flex items-center justify-between gap-1">
              <span className="inline-flex items-center gap-0.5">
                {platforms.slice(0, 3).map((p: SocialPlatform) => (
                  <SocialPlatformIcon key={p} platform={p} size={11} />
                ))}
              </span>
              <span className="truncate text-[10px] text-[var(--ww-text-muted)]">
                {contentTypeLabels[item.contentType]} · {visual.label}
              </span>
            </span>
          </>
        )}
      </button>
      <AnchoredPopover
        open={tipOpen}
        anchorRef={anchorRef}
        onClose={() => setTipOpen(false)}
        width={260}
        closeOnOutside={false}
        closeOnEscape={false}
        className="pointer-events-none px-2.5 py-1.5"
      >
        <p className="whitespace-pre-wrap text-[11px] leading-snug text-[var(--ww-text-secondary)]">
          {calendarEventTooltip(item)}
        </p>
      </AnchoredPopover>
    </>
  );
}
