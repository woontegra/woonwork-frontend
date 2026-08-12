import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { appendHashtagsToText } from '@woonwork/shared';
import { Button, SOCIAL_CONTROL_CLASS } from './SocialControls';
import { SOCIAL_BODY_STYLE } from '../../lib/socialControlTypography';
import { AnchoredPopover } from './AnchoredPopover';
import type { SocialHashtagDto } from '../../lib/socialHashtags';
import {
  COMPOSER_FLOATING_Z,
  HASHTAG_PICKER_MAX_HEIGHT,
  HASHTAG_PICKER_WIDTH,
  clampPopoverWidth,
} from '../../lib/anchoredPopover';
import {
  HASHTAG_PICKER_RESULTS_MAX_HEIGHT,
  HASHTAG_PICKER_TABS,
  hashtagPickerChipTooltip,
  hashtagPickerFooterLabel,
  toggleHashtagSelection,
} from '../../lib/hashtagPicker';

type PickerTab = (typeof HASHTAG_PICKER_TABS)[number]['id'];

const chipBase =
  'inline-flex h-7 max-w-full items-center rounded-[5px] px-1.5 text-[12.5px] font-medium whitespace-nowrap transition-[background-color,box-shadow,color] duration-150';

export function HashtagPicker({
  items,
  onInsert,
  disabled,
}: {
  items: SocialHashtagDto[];
  onInsert: (nextText: (prev: string) => string) => void;
  disabled?: boolean;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PickerTab>('usable');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [width, setWidth] = useState(HASHTAG_PICKER_WIDTH);

  useEffect(() => {
    const sync = () => setWidth(clampPopoverWidth(HASHTAG_PICKER_WIDTH, window.innerWidth, 12));
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    let list = items;
    if (tab === 'usable') list = items.filter((item) => item.status === 'ACTIVE');
    if (tab === 'blocked') list = items.filter((item) => item.status === 'BLOCKED');
    if (tab === 'recent') {
      list = items
        .filter((item) => item.status === 'ACTIVE' && item.lastUsedAt)
        .slice()
        .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''));
    }
    if (tab === 'frequent') {
      list = items
        .filter((item) => item.status === 'ACTIVE')
        .slice()
        .sort((a, b) => b.usageCount - a.usageCount || a.tag.localeCompare(b.tag, 'tr'));
    }
    if (!q) return list;
    return list.filter(
      (item) =>
        item.tag.toLocaleLowerCase('tr-TR').includes(q) ||
        (item.category ?? '').toLocaleLowerCase('tr-TR').includes(q),
    );
  }, [items, search, tab]);

  const selectable = tab !== 'blocked';

  function toggle(id: string) {
    setSelected((prev) => toggleHashtagSelection(prev, id, selectable));
  }

  function insertSelected() {
    const tags = items.filter((item) => selected.has(item.id) && item.status === 'ACTIVE').map((item) => item.tag);
    if (!tags.length) return;
    onInsert((prev) => appendHashtagsToText(prev, tags));
    setSelected(new Set());
    setOpen(false);
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="inline-flex h-7 items-center gap-1 rounded-[6px] px-1.5 text-[12px] font-medium leading-[1.25] text-[var(--ww-text-muted)] hover:bg-ink-50/80 hover:text-[var(--ww-text-secondary)] disabled:opacity-45"
      >
        <Plus size={13} strokeWidth={1.75} />
        Hashtag Ekle
      </button>
      <AnchoredPopover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        align="end"
        width={width}
        zIndex={COMPOSER_FLOATING_Z}
        className="overflow-hidden shadow-[var(--ww-shadow-md)]"
      >
        <HashtagPickerPopover
          tab={tab}
          search={search}
          selected={selected}
          filtered={filtered}
          selectable={selectable}
          onTab={(next) => {
            setTab(next);
            setSelected(new Set());
          }}
          onSearch={setSearch}
          onToggle={toggle}
          onInsert={insertSelected}
        />
      </AnchoredPopover>
    </>
  );
}

function HashtagPickerPopover({
  tab,
  search,
  selected,
  filtered,
  selectable,
  onTab,
  onSearch,
  onToggle,
  onInsert,
}: {
  tab: PickerTab;
  search: string;
  selected: Set<string>;
  filtered: SocialHashtagDto[];
  selectable: boolean;
  onTab: (tab: PickerTab) => void;
  onSearch: (value: string) => void;
  onToggle: (id: string) => void;
  onInsert: () => void;
}) {
  return (
    <div className="flex flex-col" style={{ maxHeight: HASHTAG_PICKER_MAX_HEIGHT }}>
      <div className="shrink-0 px-3 pt-2.5 pb-2">
        <p className="mb-2 text-[12px] font-medium text-[var(--ww-text-muted)]">Hashtagler</p>
        <div className="flex flex-nowrap gap-0.5">
          {HASHTAG_PICKER_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              className={`h-7 shrink-0 whitespace-nowrap rounded-[5px] px-2 text-[12px] font-medium leading-[1.25] ${
                tab === item.id
                  ? 'bg-ink-100 text-[var(--ww-text)]'
                  : 'text-ink-400 hover:bg-ink-50 hover:text-ink-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Hashtag ara..."
          className={`${SOCIAL_CONTROL_CLASS} mt-2 w-full bg-[rgb(244_246_248/0.45)] focus:bg-white`}
          style={SOCIAL_BODY_STYLE}
        />
      </div>

      <div
        role={selectable ? 'listbox' : 'list'}
        aria-multiselectable={selectable || undefined}
        aria-label="Hashtagler"
        className="flex min-h-0 flex-1 flex-wrap content-start items-start gap-1.5 overflow-y-auto px-3 py-1 [scrollbar-width:thin]"
        style={{ maxHeight: HASHTAG_PICKER_RESULTS_MAX_HEIGHT }}
      >
        {filtered.length ? (
          filtered.map((item) => {
            const isSelected = selected.has(item.id);
            const title = hashtagPickerChipTooltip(item);
            if (!selectable) {
              return (
                <span
                  key={item.id}
                  role="listitem"
                  title={title}
                  className={`${chipBase} cursor-default bg-red-50/70 text-red-800/75 ring-1 ring-red-200/70`}
                >
                  <span className="max-w-full truncate">{item.tag}</span>
                </span>
              );
            }
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                title={title}
                aria-selected={isSelected}
                onClick={() => onToggle(item.id)}
                className={`${chipBase} cursor-pointer outline-none focus-visible:ring-accent/35 ${
                  isSelected
                    ? 'bg-[rgb(67_97_238/0.12)] text-[var(--ww-text)] ring-1 ring-accent/40'
                    : 'bg-ink-50/80 text-[var(--ww-text)] ring-1 ring-[rgb(10_20_36/0.06)] hover:bg-[rgb(67_97_238/0.08)] hover:ring-accent/20'
                }`}
              >
                <span className="max-w-full truncate">{item.tag}</span>
              </button>
            );
          })
        ) : (
          <div className="w-full px-1 py-6 text-center">
            <p className="text-[12.5px] text-[var(--ww-text-secondary)]">Henüz hashtag yok</p>
            <p className="mt-0.5 text-[11.5px] text-ink-400">Hashtag Kütüphanesi'nden ekleyebilirsiniz.</p>
          </div>
        )}
      </div>

      {selectable ? (
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-t border-[var(--ww-border)] px-3">
          <span className="min-w-0 truncate text-[12px] text-ink-400">
            {hashtagPickerFooterLabel(selected.size)}
          </span>
          <Button type="button" disabled={!selected.size} onClick={onInsert}>
            Seçilenleri Ekle
          </Button>
        </div>
      ) : (
        <p className="flex h-11 shrink-0 items-center border-t border-[var(--ww-border)] px-3 text-[12px] text-ink-400">
          Blocklist yalnızca uyarı içindir; seçilemez.
        </p>
      )}
    </div>
  );
}
