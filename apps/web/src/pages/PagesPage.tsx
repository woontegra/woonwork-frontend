import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { PageDto } from '../types';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../components/ui/Toast';
import {
  EmptyState,
  PageCanvas,
  PageContext,
  PageTreeSplit,
  Skeleton,
} from '../components/ui/PageLoader';
import { Button, Input } from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';
import { formatDate } from '../lib/labels';

function buildTree(pages: PageDto[]) {
  const byParent = new Map<string | null, PageDto[]>();
  for (const page of pages) {
    const key = page.parentId;
    const list = byParent.get(key) ?? [];
    list.push(page);
    byParent.set(key, list);
  }
  return byParent;
}

function TreeNodes({
  parentId,
  byParent,
  depth = 0,
}: {
  parentId: string | null;
  byParent: Map<string | null, PageDto[]>;
  depth?: number;
}) {
  const nodes = byParent.get(parentId) ?? [];
  return (
    <ul className={depth === 0 ? 'space-y-0.5' : 'ml-2 space-y-0.5 border-l border-[var(--ww-border)] pl-2'}>
      {nodes.map((page) => (
        <li key={page.id}>
          <Link
            to={`/notlar/${page.id}`}
            className="flex items-center gap-2 px-2 py-1.5 text-sm text-[var(--ww-text-secondary)] transition hover:bg-accent-soft/50 hover:text-[var(--ww-text)]"
          >
            <span className="text-[13px]">{page.icon || '·'}</span>
            <span className="truncate">{page.title}</span>
            {(byParent.get(page.id)?.length ?? 0) > 0 ? (
              <ChevronRight size={14} className="ml-auto text-[var(--ww-text-muted)]" />
            ) : null}
          </Link>
          <TreeNodes parentId={page.id} byParent={byParent} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

export function PagesPage() {
  const navigate = useNavigate();
  const { activeTenant } = useTenant();
  const { toast } = useToast();
  const [pages, setPages] = useState<PageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const data = await apiRequest<PageDto[]>('/pages');
      setPages(data);
    } catch (err) {
      toast((err as Error).message || 'Sayfalar yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenant]);

  const byParent = useMemo(() => buildTree(pages), [pages]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await apiRequest<PageDto>('/pages', {
        method: 'POST',
        body: {
          title,
          parentId: parentId || null,
        },
      });
      toast('Sayfa oluşturuldu', 'success');
      setModalOpen(false);
      setTitle('');
      setParentId('');
      navigate(`/notlar/${created.id}`);
    } catch (err) {
      toast((err as Error).message || 'Sayfa oluşturulamadı', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageCanvas mode="WORKSPACE_WIDE">
      <PageContext
        hideTitle
        description={`${pages.length} sayfa · hiyerarşik belge çalışma alanı`}
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={14} strokeWidth={1.75} />
            Yeni Sayfa
          </Button>
        }
      />

      <PageTreeSplit
        tree={
          <div className="h-full min-h-[420px] border border-[var(--ww-border)] bg-white p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ww-text-muted)]">
                Sayfa ağacı
              </h2>
              <Button size="sm" variant="ghost" onClick={() => setModalOpen(true)} aria-label="Yeni sayfa">
                <Plus size={14} />
              </Button>
            </div>
            {loading ? (
              <Skeleton className="h-40" />
            ) : !pages.length ? (
              <p className="px-1 text-xs text-[var(--ww-text-muted)]">Henüz sayfa yok</p>
            ) : (
              <TreeNodes parentId={null} byParent={byParent} />
            )}
          </div>
        }
        content={
          <div className="min-h-[420px] border border-[var(--ww-border)] bg-white">
            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : !pages.length ? (
              <div className="p-4">
                <EmptyState
                  title="Henüz not veya belge yok"
                  description="Sayfalar oluşturup hiyerarşik şekilde düzenleyebilirsiniz."
                  action={
                    <Button onClick={() => setModalOpen(true)}>
                      <Plus size={14} strokeWidth={1.75} />
                      Yeni Sayfa
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--ww-border)]">
                {pages.map((page) => (
                  <li key={page.id}>
                    <Link
                      to={`/notlar/${page.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-accent-soft/35"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="text-base">{page.icon || '·'}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--ww-text)]">
                            {page.title}
                          </p>
                          <p className="text-xs text-[var(--ww-text-muted)]">
                            {page._count?.children ?? 0} alt sayfa · {formatDate(page.updatedAt)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-[var(--ww-text-muted)]" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        }
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Yeni Sayfa">
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Başlık"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ww-text-muted)]">
              Üst sayfa
            </span>
            <select
              className="w-full rounded-[var(--ww-radius-md)] border border-[var(--ww-border-strong)] bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--ww-accent-soft)]"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">Yok (kök sayfa)</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Oluştur'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageCanvas>
  );
}
