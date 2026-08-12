import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Table2 } from 'lucide-react';
import type { BlockContent } from '@woonwork/shared';
import { Modal } from '../ui/Modal';
import { Button, Input } from '../ui/Form';
import { useToast } from '../ui/Toast';
import { DatabaseWorkspace } from './DatabaseWorkspace';
import {
  createDatabase,
  listDatabases,
  type DatabaseDto,
} from '../../lib/database';

export function DatabaseBlock({
  database,
  content,
  onLink,
  onContentChange,
}: {
  database?: DatabaseDto | null;
  content?: BlockContent;
  onLink: (databaseId: string) => void;
  onContentChange?: (content: BlockContent) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(!database);
  const [mode, setMode] = useState<'choose' | 'create' | 'link'>('choose');
  const [name, setName] = useState('');
  const [items, setItems] = useState<DatabaseDto[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (database) setOpen(false);
  }, [database]);

  useEffect(() => {
    if (!open || mode !== 'link') return;
    void listDatabases()
      .then(setItems)
      .catch((err) => toast((err as Error).message || 'Listelenemedi', 'error'));
  }, [mode, open, toast]);

  if (database?.id) {
    const viewId =
      typeof content?.viewId === 'string'
        ? content.viewId
        : database.views?.[0]?.id ?? null;

    return (
      <div className="space-y-2 py-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--ww-text)]">
            <Table2 size={16} className="text-[var(--ww-text-muted)]" />
            {database.name}
          </div>
          <Link
            to={`/tablolar/${database.id}`}
            className="text-xs text-[var(--ww-text-muted)] hover:text-[var(--ww-text)]"
          >
            Tam sayfa
          </Link>
        </div>
        <DatabaseWorkspace
          databaseId={database.id}
          compact
          initialViewId={viewId}
          onViewIdChange={(nextViewId) => {
            onContentChange?.({ ...(content ?? {}), viewId: nextViewId });
          }}
        />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMode('choose');
          setOpen(true);
        }}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-navy-200 bg-navy-50/50 px-4 py-6 text-sm text-navy-500 hover:border-navy-300 hover:bg-navy-50"
      >
        <Table2 size={18} className="text-navy-400" />
        Akıllı tablo ekle
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Akıllı Tablo">
        {mode === 'choose' ? (
          <div className="space-y-2">
            <Button type="button" className="w-full" onClick={() => setMode('create')}>
              Yeni Akıllı Tablo Oluştur
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => setMode('link')}
            >
              Mevcut Akıllı Tabloyu Bağla
            </Button>
          </div>
        ) : null}

        {mode === 'create' ? (
          <div className="space-y-3">
            <Input
              label="Tablo adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setMode('choose')}>
                Geri
              </Button>
              <Button
                type="button"
                disabled={saving || !name.trim()}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const created = await createDatabase({ name: name.trim() });
                    onLink(created.id);
                    setOpen(false);
                  } catch (err) {
                    toast((err as Error).message || 'Oluşturulamadı', 'error');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Oluştur
              </Button>
            </div>
          </div>
        ) : null}

        {mode === 'link' ? (
          <div className="space-y-3">
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {!items.length ? (
                <p className="py-6 text-center text-sm text-navy-400">Tablo bulunamadı</p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-navy-50"
                    onClick={() => {
                      onLink(item.id);
                      setOpen(false);
                    }}
                  >
                    <Table2 size={14} className="text-navy-400" />
                    {item.name}
                  </button>
                ))
              )}
            </div>
            <Button type="button" variant="secondary" onClick={() => setMode('choose')}>
              Geri
            </Button>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
