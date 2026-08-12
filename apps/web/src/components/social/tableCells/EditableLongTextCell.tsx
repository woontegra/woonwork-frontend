import { useEffect, useRef, useState } from 'react';
import { useRegisterCommit } from './useCellEdit';
import { AnchoredPopover } from '../AnchoredPopover';
import { SOCIAL_TEXTAREA_CLASS } from '../SocialControls';
import { SOCIAL_BODY_STYLE } from '../../../lib/socialControlTypography';

export function EditableLongTextCell({
  value,
  isEditing,
  onStartEdit,
  onSave,
  onCancelEdit,
  registerCommit,
  popoverWidth = 460,
  placeholder = '—',
  className = 'text-ink-400',
  pending,
}: {
  value: string | null | undefined;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (next: string | null) => Promise<boolean>;
  onCancelEdit: () => void;
  registerCommit: (fn: (() => Promise<void>) | null) => void;
  popoverWidth?: number;
  placeholder?: string;
  className?: string;
  pending?: boolean;
}) {
  const text = value?.trim() ?? '';
  const [draft, setDraft] = useState(text);
  const [hoverPreview, setHoverPreview] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isEditing) setDraft(text);
  }, [text, isEditing]);

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  const commit = async () => {
    if (savingRef.current) return;
    const normalized = draft.trim() || null;
    const current = text || null;
    if (normalized === current) {
      onCancelEdit();
      return;
    }
    savingRef.current = true;
    const ok = await onSave(normalized);
    savingRef.current = false;
    if (ok) onCancelEdit();
  };

  useRegisterCommit(registerCommit, isEditing, commit);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          setHoverPreview(false);
          onStartEdit();
        }}
        onMouseEnter={() => {
          if (!isEditing && text) setHoverPreview(true);
        }}
        onMouseLeave={() => setHoverPreview(false)}
        className={
          text
            ? `block w-full truncate whitespace-nowrap text-left text-[12px] leading-none hover:bg-ink-50/80 ${className}`
            : `block w-full truncate text-left text-[11px] leading-none text-ink-300 hover:text-ink-500 ${className}`
        }
      >
        {text || placeholder}
      </button>

      <AnchoredPopover
        open={hoverPreview && !isEditing}
        anchorRef={anchorRef}
        onClose={() => setHoverPreview(false)}
        width={Math.min(popoverWidth, 480)}
        closeOnOutside={false}
        closeOnEscape={false}
        className="pointer-events-none max-h-[200px] overflow-y-auto px-3 py-2"
      >
        <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[var(--ww-text-secondary)]">
          {text}
        </p>
      </AnchoredPopover>

      <AnchoredPopover
        open={isEditing}
        anchorRef={anchorRef}
        onClose={() => void commit()}
        width={popoverWidth}
        className="p-2"
      >
        <textarea
          ref={textareaRef}
          value={draft}
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void commit();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setDraft(text);
              onCancelEdit();
            }
          }}
          className={`${SOCIAL_TEXTAREA_CLASS} min-h-[180px] max-h-[360px] w-full resize-y`}
          style={{ ...SOCIAL_BODY_STYLE, lineHeight: 1.45 }}
        />
        <p className="mt-1 text-[10px] text-ink-400">Ctrl+Enter kaydet · Esc iptal</p>
      </AnchoredPopover>
    </>
  );
}
