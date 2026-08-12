import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileText,
  FolderKanban,
  Home,
  Library,
  Plus,
  Search,
  Share2,
  SquareCheckBig,
  Table2,
} from 'lucide-react';
import { fetchLibrary, resourceHref, resourceTypeLabel, type LibraryItem } from '../../lib/library';
import { createPage, notifyWorkspaceChanged } from '../../lib/workspace';

type PaletteRow =
  | {
      kind: 'command';
      id: string;
      label: string;
      hint?: string;
      run: () => void | Promise<void>;
    }
  | {
      kind: 'result';
      id: string;
      label: string;
      hint?: string;
      item: LibraryItem;
    };

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<LibraryItem[]>([]);

  const commands = useMemo<PaletteRow[]>(
    () => [
      {
        kind: 'command',
        id: 'new-page',
        label: 'Yeni Sayfa',
        hint: 'Özel',
        run: async () => {
          const page = await createPage({ title: 'Adsız sayfa', workspaceAreaId: null });
          notifyWorkspaceChanged();
          navigate(`/notlar/${page.id}`);
        },
      },
      {
        kind: 'command',
        id: 'new-task',
        label: 'Yeni Görev',
        run: () => navigate('/gorevler'),
      },
      {
        kind: 'command',
        id: 'open-library',
        label: 'Kütüphaneyi Aç',
        run: () => navigate('/kutuphane'),
      },
      {
        kind: 'command',
        id: 'open-social',
        label: 'Sosyal Medyayı Aç',
        run: () => navigate('/sosyal-medya'),
      },
      { kind: 'command', id: 'home', label: 'Ana Sayfa', run: () => navigate('/') },
    ],
    [navigate],
  );

  useEffect(() => {
    if (!open) {
      setQuery('');
      setIndex(0);
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchLibrary({ search: q, page: 1, limit: 8 })
        .then((res) => setResults(res.items))
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const items = useMemo<PaletteRow[]>(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    const cmds = !q
      ? commands
      : commands.filter((c) => c.label.toLocaleLowerCase('tr-TR').includes(q));
    const searchRows: PaletteRow[] = results.map((item) => ({
      kind: 'result',
      id: `${item.resourceType}:${item.id}`,
      label: item.name,
      hint: `${resourceTypeLabel(item.resourceType)}${item.areaName ? ` · ${item.areaName}` : ''}`,
      item,
    }));
    return [...searchRows, ...cmds];
  }, [commands, query, results]);

  useEffect(() => {
    setIndex(0);
  }, [query, results]);

  async function run(row: PaletteRow) {
    if (row.kind === 'result') {
      navigate(resourceHref(row.item.resourceType, row.item.id));
      onClose();
      return;
    }
    await row.run();
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => (i + 1) % Math.max(items.length, 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
      }
      if (e.key === 'Enter' && items[index]) {
        e.preventDefault();
        void run(items[index]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, index, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[85] flex items-start justify-center px-4 pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          <button
            type="button"
            aria-label="Kapat"
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-xl overflow-hidden rounded-[var(--ww-radius-lg)] border border-[var(--ww-border)] bg-white shadow-[var(--ww-shadow-overlay)]"
            role="dialog"
            aria-label="Komut paleti"
          >
            <div className="flex items-center gap-3 border-b border-[var(--ww-border)] px-4 py-3">
              <Search size={16} className="text-[var(--ww-text-muted)]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Sayfa, tablo, proje veya komut ara…"
                className="w-full bg-transparent text-sm text-[var(--ww-text)] outline-none placeholder:text-[var(--ww-text-muted)]"
              />
              <kbd className="hidden rounded border border-[var(--ww-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ww-text-muted)] sm:inline">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-1.5">
              {!items.length ? (
                <p className="px-3 py-8 text-center text-sm text-[var(--ww-text-muted)]">Sonuç yok</p>
              ) : (
                items.map((item, i) => {
                  const Icon =
                    item.kind === 'result'
                      ? item.item.resourceType === 'DATABASE'
                        ? Table2
                        : item.item.resourceType === 'PROJECT'
                          ? FolderKanban
                          : FileText
                      : item.id.startsWith('new')
                        ? Plus
                        : item.id === 'home'
                          ? Home
                          : item.id === 'open-library'
                            ? Library
                            : item.id === 'open-social'
                              ? Share2
                              : SquareCheckBig;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-[var(--ww-radius-md)] px-3 py-2 text-left transition ${
                        i === index ? 'bg-accent-soft text-accent-strong' : 'hover:bg-ink-50'
                      }`}
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => void run(item)}
                    >
                      {item.kind === 'result' && item.item.icon ? (
                        <span className="w-4 text-center text-[13px]">{item.item.icon}</span>
                      ) : (
                        <Icon size={15} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.label}</span>
                        {item.hint ? (
                          <span className="block truncate text-[11px] text-[var(--ww-text-muted)]">
                            {item.hint}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
