import { useMemo, useState } from 'react';
import { Copy, MoreHorizontal, Plus, Pencil, Trash2 } from 'lucide-react';
import type { DatabaseViewType } from '@woonwork/shared';
import { Button, Input } from '../ui/Form';
import { Modal } from '../ui/Modal';
import type { DatabasePropertyDto, DatabaseViewDto } from '../../lib/database';

const TYPE_LABELS: Record<DatabaseViewType, string> = {
  TABLE: 'Tablo',
  KANBAN: 'Kanban',
  CALENDAR: 'Takvim',
};

export function DatabaseViewSwitcher({
  views,
  activeViewId,
  properties,
  compact,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
}: {
  views: DatabaseViewDto[];
  activeViewId: string | null;
  properties: DatabasePropertyDto[];
  compact?: boolean;
  onSelect: (viewId: string) => void;
  onCreate: (input: {
    name: string;
    type: DatabaseViewType;
    groupByPropertyId?: string;
    datePropertyId?: string;
  }) => Promise<void>;
  onRename: (viewId: string, name: string) => Promise<void>;
  onDuplicate: (viewId: string) => Promise<void>;
  onDelete: (viewId: string) => Promise<void>;
}) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<DatabaseViewType>('TABLE');
  const [groupByPropertyId, setGroupByPropertyId] = useState('');
  const [datePropertyId, setDatePropertyId] = useState('');
  const [saving, setSaving] = useState(false);

  const groupProps = useMemo(
    () => properties.filter((p) => p.type === 'STATUS' || p.type === 'SELECT'),
    [properties],
  );
  const dateProps = useMemo(() => properties.filter((p) => p.type === 'DATE'), [properties]);

  const defaultStatus = groupProps.find((p) => p.type === 'STATUS') ?? groupProps[0];

  function openCreate() {
    setName('');
    setType('TABLE');
    setGroupByPropertyId(defaultStatus?.id ?? '');
    setDatePropertyId(dateProps[0]?.id ?? '');
    setCreateOpen(true);
  }

  async function submitCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        type,
        groupByPropertyId: type === 'KANBAN' ? groupByPropertyId || undefined : undefined,
        datePropertyId: type === 'CALENDAR' ? datePropertyId || undefined : undefined,
      });
      setCreateOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function submitRename() {
    if (!renameId || !name.trim()) return;
    setSaving(true);
    try {
      await onRename(renameId, name.trim());
      setRenameId(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={`flex min-w-0 flex-wrap items-center gap-1 ${compact ? '' : ''}`}>
        {views.map((view) => {
          const active = view.id === activeViewId;
          return (
            <div key={view.id} className="relative flex items-center">
              <button
                type="button"
                onClick={() => onSelect(view.id)}
                className={`rounded-[6px] px-2.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-ink-950 text-white'
                    : 'text-[var(--ww-text-secondary)] hover:bg-ink-50'
                }`}
              >
                {view.name}
              </button>
              <button
                type="button"
                className="rounded p-1 text-[var(--ww-text-muted)] hover:bg-ink-50 hover:text-[var(--ww-text)]"
                onClick={() => setMenuId((v) => (v === view.id ? null : view.id))}
                aria-label="Görünüm menüsü"
              >
                <MoreHorizontal size={14} />
              </button>
              {menuId === view.id ? (
                <div className="absolute left-0 top-8 z-20 min-w-[160px] border border-[var(--ww-border)] bg-white py-1 shadow-[var(--ww-shadow-sm)]">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-ink-50"
                    onClick={() => {
                      setMenuId(null);
                      setName(view.name);
                      setRenameId(view.id);
                    }}
                  >
                    <Pencil size={12} /> Yeniden adlandır
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-ink-50"
                    onClick={() => {
                      setMenuId(null);
                      void onDuplicate(view.id);
                    }}
                  >
                    <Copy size={12} /> Çoğalt
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-danger hover:bg-danger-soft"
                    disabled={views.length <= 1}
                    onClick={() => {
                      setMenuId(null);
                      void onDelete(view.id);
                    }}
                  >
                    <Trash2 size={12} /> Sil
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
        <Button type="button" size="sm" variant="ghost" onClick={openCreate} aria-label="Yeni görünüm">
          <Plus size={14} />
        </Button>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Görünüm">
        <div className="space-y-4">
          <Input label="Görünüm adı" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ww-text-muted)]">
              Tür
            </span>
            <select
              className="w-full rounded-[var(--ww-radius-md)] border border-[var(--ww-border-strong)] bg-white px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as DatabaseViewType)}
            >
              {(Object.keys(TYPE_LABELS) as DatabaseViewType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          {type === 'KANBAN' ? (
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ww-text-muted)]">
                Gruplama alanı
              </span>
              <select
                className="w-full rounded-[var(--ww-radius-md)] border border-[var(--ww-border-strong)] bg-white px-3 py-2 text-sm"
                value={groupByPropertyId}
                onChange={(e) => setGroupByPropertyId(e.target.value)}
              >
                {!groupProps.length ? <option value="">Uygun alan yok</option> : null}
                {groupProps.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type === 'STATUS' ? 'Durum' : 'Seçim'})
                  </option>
                ))}
              </select>
              {!groupProps.length ? (
                <p className="text-xs text-[var(--ww-text-muted)]">
                  Uygun alan yoksa oluşturma sırasında Durum alanı eklenecek.
                </p>
              ) : null}
            </label>
          ) : null}

          {type === 'CALENDAR' ? (
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ww-text-muted)]">
                Tarih alanı
              </span>
              <select
                className="w-full rounded-[var(--ww-radius-md)] border border-[var(--ww-border-strong)] bg-white px-3 py-2 text-sm"
                value={datePropertyId}
                onChange={(e) => setDatePropertyId(e.target.value)}
              >
                {!dateProps.length ? <option value="">Uygun alan yok</option> : null}
                {dateProps.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {!dateProps.length ? (
                <p className="text-xs text-[var(--ww-text-muted)]">
                  Tarih alanı yoksa oluşturma sırasında otomatik eklenecek.
                </p>
              ) : null}
            </label>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={saving || !name.trim()}
              onClick={() => void submitCreate()}
            >
              Oluştur
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(renameId)} onClose={() => setRenameId(null)} title="Görünümü Yeniden Adlandır">
        <div className="space-y-4">
          <Input label="Ad" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRenameId(null)}>
              Vazgeç
            </Button>
            <Button type="button" disabled={saving || !name.trim()} onClick={() => void submitRename()}>
              Kaydet
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
