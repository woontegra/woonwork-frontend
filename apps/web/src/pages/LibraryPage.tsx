import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  FolderKanban,
  Plus,
  Star,
  Table2,
} from 'lucide-react';
import type { ContentResourceType } from '@woonwork/shared';
import { PageCanvas, PageContext, EmptyState, Skeleton, PageToolbar } from '../components/ui/PageLoader';
import { Button, Input, SearchInput, Select } from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { formatDate, fullName } from '../lib/labels';
import {
  addFavorite,
  createArea,
  fetchLibrary,
  listAreas,
  listFavorites,
  removeFavorite,
  resourceHref,
  resourceTypeLabel,
  visibilityLabel,
  type LibraryItem,
  type WorkspaceAreaDto,
} from '../lib/library';
import { createDatabase as createDbApi } from '../lib/database';
import { apiRequest } from '../lib/api';
import type { PageDto, ProjectDto } from '../types';

const VIEWS = [
  { key: 'all', label: 'Tümü' },
  { key: 'areas', label: 'Alanlar' },
  { key: 'recents', label: 'Son Kullanılanlar' },
  { key: 'favorites', label: 'Favoriler' },
  { key: 'shared', label: 'Paylaşılanlar' },
  { key: 'private', label: 'Özel' },
] as const;

function TypeIcon({ type }: { type: ContentResourceType }) {
  if (type === 'DATABASE') return <Table2 size={14} className="text-[var(--ww-text-muted)]" />;
  if (type === 'PROJECT') return <FolderKanban size={14} className="text-[var(--ww-text-muted)]" />;
  return <FileText size={14} className="text-[var(--ww-text-muted)]" />;
}

export function LibraryPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'all';
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [areas, setAreas] = useState<WorkspaceAreaDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);
  const [areaForm, setAreaForm] = useState({
    name: '',
    description: '',
    visibility: 'MEMBERS' as 'PRIVATE' | 'MEMBERS' | 'TENANT',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === 'areas') {
        setAreas(await listAreas());
        setItems([]);
        setTotal(0);
      } else {
        const data = await fetchLibrary({
          view,
          search: searchDebounced.trim() || undefined,
          page: 1,
          limit: 50,
        });
        setItems(data.items);
        setTotal(data.total);
      }
    } catch (err) {
      toast((err as Error).message || 'Kütüphane yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [view, searchDebounced, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listFavorites(100)
      .then((favs) =>
        setFavIds(new Set(favs.map((f) => `${f.resourceType}:${f.resourceId}`))),
      )
      .catch(() => setFavIds(new Set()));
  }, [view, items.length]);

  async function toggleFav(item: LibraryItem) {
    const key = `${item.resourceType}:${item.id}`;
    try {
      if (favIds.has(key)) {
        await removeFavorite(item.resourceType, item.id);
        setFavIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } else {
        await addFavorite(item.resourceType, item.id);
        setFavIds((prev) => new Set(prev).add(key));
      }
    } catch (err) {
      toast((err as Error).message || 'Favori güncellenemedi', 'error');
    }
  }

  async function quickCreate(kind: 'page' | 'database' | 'project') {
    try {
      const privateCtx = view === 'private' || view === 'all';
      if (kind === 'page') {
        const page = await apiRequest<PageDto>('/pages', {
          method: 'POST',
          body: { title: 'Adsız sayfa', workspaceAreaId: null },
        });
        navigate(`/notlar/${page.id}`);
      } else if (kind === 'database') {
        const db = await createDbApi({ name: 'Yeni Tablo', workspaceAreaId: null });
        navigate(`/tablolar/${db.id}`);
      } else {
        const project = await apiRequest<ProjectDto>('/projects', {
          method: 'POST',
          body: { name: 'Yeni Proje', workspaceAreaId: null },
        });
        toast('Proje oluşturuldu', 'success');
        navigate('/projeler');
        void project;
      }
      void privateCtx;
      setCreateOpen(false);
    } catch (err) {
      toast((err as Error).message || 'Oluşturulamadı', 'error');
    }
  }

  async function submitArea() {
    if (!areaForm.name.trim()) return;
    try {
      const area = await createArea({
        name: areaForm.name.trim(),
        description: areaForm.description || null,
        visibility: areaForm.visibility,
      });
      setAreaOpen(false);
      setAreaForm({ name: '', description: '', visibility: 'MEMBERS' });
      navigate(`/alanlar/${area.id}`);
    } catch (err) {
      toast((err as Error).message || 'Alan oluşturulamadı', 'error');
    }
  }

  const emptyCopy = useMemo(() => {
    if (view === 'favorites') return 'Henüz favoriniz yok.';
    if (view === 'shared') return 'Size paylaşılmış içerik yok.';
    if (view === 'private') return 'Özel içeriğiniz yok.';
    if (view === 'recents') return 'Son kullanılan içerik yok.';
    return 'Henüz içerik yok.';
  }, [view]);

  return (
    <PageCanvas mode="DATA_WIDE">
      <PageContext
        hideTitle
        description="Çalışma alanınızın merkezi içerik kütüphanesi"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setAreaOpen(true)}>
              Yeni Alan
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus size={14} strokeWidth={1.75} />
              Yeni
            </Button>
          </div>
        }
      />

      <PageToolbar>
        <div className="flex flex-wrap gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setParams(v.key === 'all' ? {} : { view: v.key })}
              className={`h-8 rounded-[var(--ww-control-radius)] px-2.5 text-[12px] font-medium transition ${
                view === v.key
                  ? 'bg-ink-950 text-white'
                  : 'text-[var(--ww-text-secondary)] hover:bg-ink-50'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view !== 'areas' ? (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Ara..."
            size="sm"
            className="min-w-[180px] max-w-sm"
          />
        ) : null}
      </PageToolbar>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : view === 'areas' ? (
        !areas.length ? (
          <EmptyState
            title="Henüz alan yok"
            description="Ekip bölümleri için yeni bir alan oluşturun."
            action={
              <Button type="button" onClick={() => setAreaOpen(true)}>
                Yeni Alan
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden border border-[var(--ww-border)] bg-white">
            <div className="grid grid-cols-[1fr_120px_100px_100px] gap-3 border-b border-[var(--ww-border)] px-4 py-1.5 text-[11px] font-medium text-[var(--ww-text-muted)]">
              <span>Alan</span>
              <span>Erişim</span>
              <span>Üye</span>
              <span>İçerik</span>
            </div>
            {areas.map((area) => {
              const count =
                (area._count?.pages ?? 0) +
                (area._count?.databases ?? 0) +
                (area._count?.projects ?? 0);
              return (
                <Link
                  key={area.id}
                  to={`/alanlar/${area.id}`}
                  className="grid grid-cols-[1fr_120px_100px_100px] gap-3 border-b border-[var(--ww-border)] px-4 py-3 last:border-0 hover:bg-accent-soft/35"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[var(--ww-text)]">
                      {area.icon ? `${area.icon} ` : ''}
                      {area.name}
                    </span>
                    {area.description ? (
                      <span className="block truncate text-xs text-[var(--ww-text-muted)]">
                        {area.description}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm text-[var(--ww-text-secondary)]">
                    {visibilityLabel(area.visibility)}
                  </span>
                  <span className="text-sm text-[var(--ww-text-secondary)]">
                    {area._count?.members ?? 0}
                  </span>
                  <span className="text-sm text-[var(--ww-text-secondary)]">{count}</span>
                </Link>
              );
            })}
          </div>
        )
      ) : !items.length ? (
        <EmptyState title={emptyCopy} />
      ) : (
        <div className="overflow-hidden border border-[var(--ww-border)] bg-white">
          <div className="grid grid-cols-[1fr_110px_140px_120px_100px_40px] gap-2 border-b border-[var(--ww-border)] px-4 py-1.5 text-[11px] font-medium text-[var(--ww-text-muted)]">
            <span>Ad</span>
            <span>Tür</span>
            <span>Alan</span>
            <span>Sahibi</span>
            <span>Güncelleme</span>
            <span />
          </div>
          {items.map((item, i) => {
            const favKey = `${item.resourceType}:${item.id}`;
            return (
              <motion.div
                key={`${item.resourceType}-${item.id}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.02 }}
                className="group grid grid-cols-[1fr_110px_140px_120px_100px_40px] items-center gap-2 border-b border-[var(--ww-border)] px-4 py-2.5 last:border-0 hover:bg-accent-soft/30"
              >
                <Link
                  to={resourceHref(item.resourceType, item.id)}
                  className="flex min-w-0 items-center gap-2"
                >
                  <TypeIcon type={item.resourceType} />
                  <span className="truncate text-sm font-medium text-[var(--ww-text)]">
                    {item.icon ? `${item.icon} ` : ''}
                    {item.name}
                  </span>
                </Link>
                <span className="text-xs text-[var(--ww-text-muted)]">
                  {resourceTypeLabel(item.resourceType)}
                </span>
                <span className="truncate text-xs text-[var(--ww-text-secondary)]">
                  {item.areaName ?? 'Özel'}
                </span>
                <span className="truncate text-xs text-[var(--ww-text-secondary)]">
                  {item.owner ? fullName(item.owner) : '—'}
                </span>
                <span className="text-xs text-[var(--ww-text-muted)]">
                  {formatDate(item.updatedAt)}
                </span>
                <button
                  type="button"
                  className="rounded p-1 text-[var(--ww-text-muted)] opacity-0 hover:text-accent group-hover:opacity-100"
                  onClick={() => void toggleFav(item)}
                  aria-label="Favori"
                >
                  <Star
                    size={14}
                    className={favIds.has(favKey) ? 'fill-accent text-accent opacity-100' : ''}
                  />
                </button>
              </motion.div>
            );
          })}
          <p className="px-4 py-2 text-[11px] text-[var(--ww-text-muted)]">{total} kayıt</p>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni">
        <div className="space-y-2">
          <Button type="button" className="w-full" onClick={() => void quickCreate('page')}>
            Sayfa
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => void quickCreate('database')}
          >
            Akıllı Tablo
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => void quickCreate('project')}
          >
            Proje
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => {
              setCreateOpen(false);
              setAreaOpen(true);
            }}
          >
            Alan
          </Button>
        </div>
      </Modal>

      <Modal open={areaOpen} onClose={() => setAreaOpen(false)} title="Yeni Alan">
        <div className="space-y-4">
          <Input
            label="Ad"
            value={areaForm.name}
            onChange={(e) => setAreaForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <Input
            label="Açıklama"
            value={areaForm.description}
            onChange={(e) => setAreaForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Select
            label="Erişim"
            value={areaForm.visibility}
            onChange={(e) =>
              setAreaForm((f) => ({
                ...f,
                visibility: e.target.value as typeof areaForm.visibility,
              }))
            }
          >
            <option value="MEMBERS">Sadece davet edilenler</option>
            <option value="TENANT">Çalışma alanındaki herkes</option>
            <option value="PRIVATE">Gizli alan</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAreaOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" onClick={() => void submitArea()}>
              Oluştur
            </Button>
          </div>
        </div>
      </Modal>
    </PageCanvas>
  );
}
