import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { SocialContentDto } from '../../../lib/social';
import { getCalendarEventVisual, eventPlatforms } from '../../../lib/socialCalendar';
import { SocialPlatformIcon } from '../SocialPlatformIcon';

export function CalendarUnscheduledPanel({
  open,
  items,
  onClose,
  onOpen,
}: {
  open: boolean;
  items: SocialContentDto[];
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLocaleLowerCase('tr-TR');
  const filtered = items.filter((item) => {
    if (!q) return true;
    return `${item.title} ${item.brand?.name ?? ''}`.toLocaleLowerCase('tr-TR').includes(q);
  });

  if (!open || !items.length || typeof document === 'undefined') return null;

  return createPortal(
    <aside className="ww-social-calendar-unscheduled">
      <div className="flex items-center justify-between border-b border-[var(--ww-border)] px-3 py-2">
        <div>
          <p className="text-[12px] font-medium text-[var(--ww-text)]">Plansız içerikler</p>
          <p className="text-[10px] text-[var(--ww-text-muted)]">Takvime sürükleyerek planlayın</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[4px] p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-600"
          aria-label="Kapat"
        >
          <X size={14} />
        </button>
      </div>
      <div className="border-b border-[var(--ww-border)] px-3 py-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Plansız içerik ara..."
          className="ww-social-field h-[30px] w-full px-2.5 text-[12px]"
        />
      </div>
      <div className="max-h-[min(70vh,520px)] overflow-y-auto p-2">
        {!filtered.length ? (
          <p className="px-1 py-6 text-center text-[12px] text-[var(--ww-text-muted)]">
            {items.length ? 'Eşleşen içerik yok.' : 'Yayın tarihi olmayan içerik yok.'}
          </p>
        ) : (
          <div className="space-y-1">
            {filtered.map((item) => (
              <UnscheduledRow key={item.id} item={item} onOpen={() => onOpen(item.id)} />
            ))}
          </div>
        )}
      </div>
    </aside>,
    document.body,
  );
}

function UnscheduledRow({ item, onOpen }: { item: SocialContentDto; onOpen: () => void }) {
  const visual = getCalendarEventVisual(item);
  const platforms = eventPlatforms(item);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={`flex w-full cursor-grab flex-col gap-0.5 rounded-[5px] border px-2 py-1.5 text-left active:cursor-grabbing ${
        visual.className
      } ${isDragging ? 'opacity-50' : 'hover:brightness-[0.98]'}`}
    >
      <span className="truncate text-[11px] font-normal text-[var(--ww-text)]">{item.title}</span>
      <span className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] text-[var(--ww-text-muted)]">{item.brand?.name ?? '—'}</span>
        <span className="inline-flex items-center gap-0.5">
          {platforms.slice(0, 2).map((p) => (
            <SocialPlatformIcon key={p} platform={p} size={10} muted />
          ))}
          <span className="text-[10px] text-[var(--ww-text-muted)]">{visual.label}</span>
        </span>
      </span>
    </button>
  );
}
