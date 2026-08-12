import { useEffect, useRef, useState } from 'react';
import { SUGGESTED_HASHTAG_CATEGORIES } from '@woonwork/shared';
import { AnchoredPopover } from './AnchoredPopover';
import { SOCIAL_CONTROL_CLASS } from './SocialControls';
import { SOCIAL_BODY_STYLE } from '../../lib/socialControlTypography';

export function HashtagCategoryCell({
  value,
  extraOptions,
  onSave,
  pending,
}: {
  value: string | null;
  extraOptions?: string[];
  onSave: (next: string | null) => Promise<boolean>;
  pending?: boolean;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    if (open) setDraft(value ?? '');
  }, [open, value]);

  const options = [...new Set([...SUGGESTED_HASHTAG_CATEGORIES, ...(extraOptions ?? []), value ?? ''])]
    .map((item) => item.trim())
    .filter(Boolean);

  async function commit(next: string) {
    const normalized = next.trim() || null;
    if (normalized === (value?.trim() || null)) {
      setOpen(false);
      return;
    }
    const ok = await onSave(normalized);
    if (ok) setOpen(false);
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={`inline-flex h-[20px] max-w-full items-center truncate rounded-[4px] px-1.5 text-[11px] font-medium transition hover:ring-1 hover:ring-ink-200/80 ${
          open ? 'ring-1 ring-accent/30' : ''
        } ${value ? 'bg-ink-50/80 text-ink-600' : 'bg-transparent text-ink-300'}`}
      >
        {value || 'Kategori'}
      </button>
      <AnchoredPopover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        width={200}
        className="p-1.5"
      >
        <div className="max-h-[180px] overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => void commit(opt)}
              className={`flex w-full items-center rounded-[4px] px-2 py-1.5 text-left text-[12px] hover:bg-ink-50 ${
                opt === value ? 'font-medium text-accent-strong' : 'text-[var(--ww-text)]'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit(draft);
            }
          }}
          placeholder="Yeni kategori"
          className={`${SOCIAL_CONTROL_CLASS} mt-1 w-full`}
          style={SOCIAL_BODY_STYLE}
        />
      </AnchoredPopover>
    </>
  );
}
