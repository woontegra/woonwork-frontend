import { useRef, useState } from 'react';
import { AnchoredPopover } from './AnchoredPopover';

export function TableBadgePopover<T extends string>({
  value,
  label,
  badgeClassName,
  options,
  onSelect,
  disabled,
  placeholder = '—',
  open: controlledOpen,
  onOpenChange,
}: {
  value: T | '' | null;
  label: string;
  badgeClassName?: string;
  options: Array<{ value: T | ''; label: string }>;
  onSelect: (value: T | '') => void;
  disabled?: boolean;
  placeholder?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;

  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  };

  if (disabled) {
    return (
      <span
        className={`inline-flex h-[20px] max-w-full items-center truncate rounded-[4px] px-1.5 text-[11px] font-medium ${
          badgeClassName ?? 'bg-ink-50 text-ink-600'
        }`}
      >
        {label || placeholder}
      </span>
    );
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={`inline-flex h-[20px] max-w-full items-center truncate rounded-[4px] px-1.5 text-[11px] font-medium transition hover:ring-1 hover:ring-ink-200/80 ${
          open ? 'ring-1 ring-accent/30' : ''
        } ${badgeClassName ?? 'bg-ink-50 text-ink-600'}`}
      >
        {label || placeholder}
      </button>
      <AnchoredPopover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        width={160}
        className="max-h-[220px] overflow-y-auto py-1"
      >
        {options.map((opt) => (
          <button
            key={opt.value || '__empty'}
            type="button"
            onClick={() => {
              onSelect(opt.value);
              setOpen(false);
            }}
            className={`flex w-full items-center px-2.5 py-1.5 text-left text-[12px] hover:bg-ink-50 ${
              opt.value === value ? 'font-medium text-accent-strong' : 'text-[var(--ww-text)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </AnchoredPopover>
    </>
  );
}
