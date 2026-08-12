import { useEffect, useRef, useState } from 'react';
import { formatScheduleInline } from '../../../lib/labels';
import { AnchoredPopover } from '../AnchoredPopover';
import { Button, DateInput } from '../SocialControls';

export function EditableDateTimeCell({
  scheduledAt,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onClear,
  pending,
}: {
  scheduledAt: string | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (iso: string) => Promise<void>;
  onClear: () => Promise<void>;
  pending?: boolean;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const sched = formatScheduleInline(scheduledAt);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');

  useEffect(() => {
    if (isEditing) {
      setDate(scheduledAt ? scheduledAt.slice(0, 10) : '');
      setTime(scheduledAt ? scheduledAt.slice(11, 16) : '12:00');
    }
  }, [isEditing, scheduledAt]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          onStartEdit();
        }}
        className="rounded-[4px] px-1 py-0.5 text-left hover:bg-ink-50 disabled:opacity-50"
        title={sched?.full}
      >
        {sched ? (
          <span className="text-[12px] text-[var(--ww-text)]">{sched.inline}</span>
        ) : (
          <span className="text-[12px] text-ink-400 hover:text-ink-600">Planlanmadı</span>
        )}
      </button>
      <AnchoredPopover open={isEditing} anchorRef={anchorRef} onClose={onCancelEdit} width={200} className="p-2.5">
        <label className="mb-0.5 block text-[12px] font-medium text-[var(--ww-text-muted)]">Tarih</label>
        <DateInput
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mb-2 w-full"
        />
        <label className="mb-0.5 block text-[12px] font-medium text-[var(--ww-text-muted)]">Saat</label>
        <DateInput
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="mb-2 w-full"
        />
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => void onClear()}
          >
            Temizle
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => {
              if (!date) return;
              const iso = new Date(`${date}T${time || '00:00'}`).toISOString();
              void onSave(iso);
            }}
          >
            Kaydet
          </Button>
        </div>
      </AnchoredPopover>
    </>
  );
}
