import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { BlockType } from '@woonwork/shared';
import { SLASH_ITEMS } from './types';

interface SlashMenuProps {
  open: boolean;
  query: string;
  anchorRect: DOMRect | null;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export function SlashMenu({ open, query, anchorRect, onSelect, onClose }: SlashMenuProps) {
  const [index, setIndex] = useState(0);

  const items = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return SLASH_ITEMS;
    return SLASH_ITEMS.filter((item) => {
      const hay = `${item.label} ${item.keywords.join(' ')} ${item.group ?? ''}`.toLocaleLowerCase(
        'tr-TR',
      );
      return hay.includes(q);
    });
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.group || 'Bloklar';
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [items]);

  const flat = items;

  useEffect(() => {
    setIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setIndex((i) => (i + 1) % Math.max(flat.length, 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex((i) => (i - 1 + Math.max(flat.length, 1)) % Math.max(flat.length, 1));
        return;
      }
      if (event.key === 'Enter' && flat[index]) {
        event.preventDefault();
        event.stopPropagation();
        onSelect(flat[index].type);
      }
    }

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, flat, index, onClose, onSelect]);

  if (!open) return null;

  const top = anchorRect ? anchorRect.bottom + 8 + window.scrollY : 120;
  const left = anchorRect ? Math.min(anchorRect.left, window.innerWidth - 320) : 80;

  let runningIndex = -1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="fixed z-[80] w-72 overflow-hidden rounded-[var(--ww-radius-md)] border border-[var(--ww-border)] bg-white shadow-[var(--ww-shadow-overlay)]"
        style={{ top, left }}
        role="listbox"
      >
        <div className="max-h-80 overflow-y-auto p-1">
          {!flat.length ? (
            <p className="px-3 py-4 text-sm text-navy-400">Sonuç bulunamadı</p>
          ) : (
            groups.map(([group, groupItems]) => (
              <div key={group} className="mb-1">
                <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ww-text-muted)]">
                  {group}
                </div>
                {groupItems.map((item) => {
                  runningIndex += 1;
                  const i = runningIndex;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      role="option"
                      aria-selected={i === index}
                      className={`flex w-full flex-col rounded-[6px] px-3 py-2 text-left transition ${
                        i === index ? 'bg-accent-soft' : 'hover:bg-ink-50'
                      }`}
                      onMouseEnter={() => setIndex(i)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onSelect(item.type);
                      }}
                    >
                      <span className="text-sm font-medium text-[var(--ww-text)]">{item.label}</span>
                      <span className="text-xs text-[var(--ww-text-muted)]">{item.description}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
