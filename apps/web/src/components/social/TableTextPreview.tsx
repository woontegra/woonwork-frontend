import { useRef, useState } from 'react';

export function TableTextPreview({
  text,
  hoverPreview = false,
  className = 'text-ink-400',
}: {
  text?: string | null;
  hoverPreview?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (!text?.trim()) {
    return <span className="text-[11px] text-ink-300">—</span>;
  }

  const line = (
    <span
      className={`block truncate whitespace-nowrap text-[12px] leading-none ${className}`}
      title={hoverPreview ? undefined : text}
    >
      {text}
    </span>
  );

  if (!hoverPreview) return line;

  return (
    <div
      ref={ref}
      className="relative min-w-0 max-w-full"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {line}
      {open ? (
        <div
          className="pointer-events-none absolute left-0 top-full z-40 mt-1 max-h-[200px] w-[min(420px,calc(100vw-2rem))] overflow-y-auto rounded-[var(--ww-control-radius)] border border-[var(--ww-border)] bg-white px-3 py-2 text-[12px] leading-relaxed text-[var(--ww-text-secondary)] shadow-[var(--ww-shadow-sm)]"
          style={{ minWidth: '360px', maxWidth: '480px' }}
        >
          <p className="whitespace-pre-wrap break-words">{text}</p>
        </div>
      ) : null}
    </div>
  );
}
