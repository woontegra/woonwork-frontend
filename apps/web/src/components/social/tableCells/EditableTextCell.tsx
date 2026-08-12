import { useEffect, useRef, useState } from 'react';
import { useRegisterCommit } from './useCellEdit';

export function EditableTextCell({
  value,
  isEditing,
  onStartEdit,
  onSave,
  onCancelEdit,
  registerCommit,
  placeholder = 'Adsız içerik',
  pending,
  className = '',
}: {
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (next: string) => Promise<boolean>;
  onCancelEdit: () => void;
  registerCommit: (fn: (() => Promise<void>) | null) => void;
  placeholder?: string;
  pending?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const commit = async () => {
    if (savingRef.current) return;
    if (draft === value) {
      onCancelEdit();
      return;
    }
    savingRef.current = true;
    const ok = await onSave(draft);
    savingRef.current = false;
    if (ok) onCancelEdit();
  };

  useRegisterCommit(registerCommit, isEditing, commit);

  if (!isEditing) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          onStartEdit();
        }}
        className={`w-full truncate rounded-[4px] px-1 py-0.5 text-left text-[13px] font-medium text-[var(--ww-text)] hover:bg-ink-50/80 disabled:opacity-50 ${className}`}
      >
        {value || <span className="font-normal text-ink-300">{placeholder}</span>}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      disabled={pending}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void commit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setDraft(value);
          onCancelEdit();
        }
      }}
      onBlur={() => void commit()}
      className="h-[26px] w-full rounded-[4px] border border-accent/40 bg-white px-1.5 text-[13px] font-medium text-[var(--ww-text)] outline-none ring-2 ring-accent/15"
    />
  );
}
