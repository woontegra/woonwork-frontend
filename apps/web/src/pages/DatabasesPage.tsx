import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Table2 } from 'lucide-react';
import { createDatabase, listDatabases, type DatabaseDto } from '../lib/database';
import { formatDate } from '../lib/labels';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../components/ui/Toast';
import { EmptyState, PageCanvas, PageHeader, Skeleton } from '../components/ui/PageLoader';
import { Button, Input } from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';

export function DatabasesPage() {
  const navigate = useNavigate();
  const { activeTenant } = useTenant();
  const { toast } = useToast();
  const [items, setItems] = useState<DatabaseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!activeTenant) return;
    setLoading(true);
    try {
      setItems(await listDatabases());
    } catch (err) {
      toast((err as Error).message || 'Tablolar yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [activeTenant]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await createDatabase({ name: name.trim() });
      setOpen(false);
      setName('');
      navigate(`/tablolar/${created.id}`);
    } catch (err) {
      toast((err as Error).message || 'Tablo oluşturulamadı', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageCanvas mode="DATA_WIDE">
      <PageHeader
        hideTitle
        description="Yapılandırılmış kayıtlar ve alanlar"
        actions={
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus size={14} strokeWidth={1.75} />
            Yeni Tablo
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : !items.length ? (
        <EmptyState
          title="Henüz akıllı tablo yok"
          description="İlk tablonuzu oluşturarak kayıt toplamaya başlayın."
          action={
            <Button type="button" onClick={() => setOpen(true)}>
              Tablo Oluştur
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden border border-[var(--ww-border)] bg-white">
          <div className="grid grid-cols-[1fr_120px_140px] gap-3 border-b border-[var(--ww-border)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ww-text-muted)]">
            <span>Tablo</span>
            <span>Kayıt</span>
            <span>Güncelleme</span>
          </div>
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/tablolar/${item.id}`}
              className="grid grid-cols-[1fr_120px_140px] gap-3 border-b border-[var(--ww-border)] px-4 py-3 transition last:border-0 hover:bg-accent-soft/40"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Table2 size={16} className="shrink-0 text-[var(--ww-text-muted)]" />
                <span className="truncate text-sm font-medium text-[var(--ww-text)]">{item.name}</span>
              </span>
              <span className="text-sm text-[var(--ww-text-secondary)]">{item._count?.rows ?? 0}</span>
              <span className="text-sm text-[var(--ww-text-muted)]">{formatDate(item.updatedAt)}</span>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Yeni Akıllı Tablo">
        <form className="space-y-4" onSubmit={onCreate}>
          <Input
            label="Tablo adı"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Müşteri Listesi"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              Oluştur
            </Button>
          </div>
        </form>
      </Modal>
    </PageCanvas>
  );
}
