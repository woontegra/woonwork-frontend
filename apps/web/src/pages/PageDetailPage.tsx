import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ImagePlus, MoreHorizontal, Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { PageDto } from '../types';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../components/ui/Toast';
import { EmptyState, PageCanvas, Skeleton } from '../components/ui/PageLoader';
import { Button } from '../components/ui/Form';
import { BlockEditor } from '../components/editor/BlockEditor';
import type { SaveStatus } from '../components/editor/types';
import { ContentAccessActions } from '../components/library/ContentAccessActions';
import { MediaPickerModal } from '../components/media/MediaPickerModal';
import {
  deletePage,
  duplicatePage,
  notifyWorkspaceChanged,
  updatePage,
} from '../lib/workspace';
import { addFavorite, listFavorites, removeFavorite } from '../lib/library';

const PAGE_ICONS = ['📄', '📝', '📘', '📌', '💡', '🎯', '🗂️', '✨', '🧠', '📅', '🧪', '🏠'] as const;

export function PageDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeTenant } = useTenant();
  const { toast } = useToast();
  const [page, setPage] = useState<PageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [iconMenu, setIconMenu] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [favorited, setFavorited] = useState(false);

  async function load() {
    if (!activeTenant || !id) return;
    setLoading(true);
    try {
      const data = await apiRequest<PageDto>(`/pages/${id}`);
      setPage(data);
      setTitle(data.title);
    } catch (err) {
      toast((err as Error).message || 'Sayfa yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenant, id]);

  useEffect(() => {
    if (!id) return;
    void listFavorites(50)
      .then((items) => setFavorited(items.some((f) => f.resourceType === 'PAGE' && f.resourceId === id)))
      .catch(() => setFavorited(false));
  }, [id]);

  async function saveTitle() {
    if (!page || title === page.title) return;
    setSaveStatus('saving');
    try {
      const updated = await updatePage(page.id, { title });
      setPage((p) => (p ? { ...p, ...updated, ancestors: p.ancestors } : updated));
      setSaveStatus('saved');
      notifyWorkspaceChanged();
    } catch (err) {
      setSaveStatus('error');
      toast((err as Error).message || 'Başlık kaydedilemedi', 'error');
    }
  }

  async function saveIcon(icon: string | null) {
    if (!page) return;
    setIconMenu(false);
    try {
      const updated = await updatePage(page.id, { icon });
      setPage((p) => (p ? { ...p, icon: updated.icon } : updated));
      notifyWorkspaceChanged();
    } catch (err) {
      toast((err as Error).message || 'İkon kaydedilemedi', 'error');
    }
  }

  async function saveCover(url: string | null) {
    if (!page) return;
    try {
      const updated = await updatePage(page.id, { coverUrl: url });
      setPage((p) => (p ? { ...p, coverUrl: updated.coverUrl } : updated));
    } catch (err) {
      toast((err as Error).message || 'Kapak güncellenemedi', 'error');
    }
  }

  async function toggleFavorite() {
    if (!page) return;
    try {
      if (favorited) {
        await removeFavorite('PAGE', page.id);
        setFavorited(false);
      } else {
        await addFavorite('PAGE', page.id);
        setFavorited(true);
      }
      notifyWorkspaceChanged();
    } catch (err) {
      toast((err as Error).message || 'Favori güncellenemedi', 'error');
    }
  }

  async function onDuplicate() {
    if (!page) return;
    try {
      const copy = await duplicatePage(page.id);
      notifyWorkspaceChanged();
      navigate(`/notlar/${copy.id}`);
    } catch (err) {
      toast((err as Error).message || 'Çoğaltılamadı', 'error');
    }
  }

  async function remove() {
    if (!page) return;
    if (!window.confirm(`“${page.title}” sayfasını silmek istiyor musunuz?`)) return;
    try {
      await deletePage(page.id);
      notifyWorkspaceChanged();
      toast('Sayfa silindi', 'success');
      navigate('/');
    } catch (err) {
      toast((err as Error).message || 'Silinemedi', 'error');
    }
  }

  if (loading) {
    return (
      <PageCanvas mode="EDITOR_FOCUS">
        <Skeleton className="h-80 w-full" />
      </PageCanvas>
    );
  }
  if (!page) {
    return (
      <PageCanvas mode="EDITOR_FOCUS">
        <EmptyState
          title="Sayfa bulunamadı"
          action={
            <Link to="/kutuphane" className="text-sm font-medium text-accent hover:underline">
              Kütüphaneye dön
            </Link>
          }
        />
      </PageCanvas>
    );
  }

  const crumbs = [
    page.workspaceArea
      ? { to: `/alanlar/${page.workspaceArea.id}`, label: page.workspaceArea.name }
      : { to: '/kutuphane?view=private', label: 'Özel' },
    ...(page.ancestors ?? []).map((a) => ({ to: `/notlar/${a.id}`, label: a.title })),
  ];

  return (
    <PageCanvas mode="EDITOR_FOCUS">
      <div className="flex items-center justify-between gap-3">
        <nav className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] text-[var(--ww-text-muted)]">
          {crumbs.map((c, i) => (
            <span key={c.to} className="inline-flex min-w-0 items-center gap-1.5">
              {i > 0 ? <span>/</span> : null}
              <Link to={c.to} className="truncate hover:text-[var(--ww-text)]">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5">
          {saveStatus === 'saving' ? (
            <span className="text-[11px] text-[var(--ww-text-muted)]">Kaydediliyor…</span>
          ) : null}
          <ContentAccessActions
            resourceType="PAGE"
            resourceId={page.id}
            areaId={page.workspaceAreaId}
            areaName={page.workspaceArea?.name}
            onMoved={() => {
              notifyWorkspaceChanged();
              void load();
            }}
          />
          <div className="relative">
            <Button size="sm" variant="ghost" onClick={() => setMoreOpen((v) => !v)}>
              <MoreHorizontal size={16} />
            </Button>
            {moreOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden border border-[var(--ww-border)] bg-white py-1 text-[13px] shadow-[var(--ww-shadow-sm)]">
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left hover:bg-ink-50"
                  onClick={() => {
                    setMoreOpen(false);
                    document.querySelector<HTMLInputElement>('[data-page-title]')?.focus();
                  }}
                >
                  Yeniden Adlandır
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left hover:bg-ink-50"
                  onClick={() => {
                    setMoreOpen(false);
                    void toggleFavorite();
                  }}
                >
                  {favorited ? 'Favoriden çıkar' : 'Favoriye Ekle'}
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left hover:bg-ink-50"
                  onClick={() => {
                    setMoreOpen(false);
                    void onDuplicate();
                  }}
                >
                  Çoğalt
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-danger hover:bg-ink-50"
                  onClick={() => {
                    setMoreOpen(false);
                    void remove();
                  }}
                >
                  <Trash2 size={13} />
                  Sil
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-hidden border border-[var(--ww-border)] bg-white">
        {page.coverUrl ? (
          <div className="group relative h-40 overflow-hidden bg-ink-50">
            <img src={page.coverUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute right-3 top-3 hidden gap-1 group-hover:flex">
              <Button size="sm" variant="secondary" onClick={() => setCoverOpen(true)}>
                Kapak değiştir
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void saveCover(null)}>
                Kaldır
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-6 pt-3 lg:px-10">
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1.5 text-[12px] text-[var(--ww-text-muted)] hover:text-[var(--ww-text)]"
              onClick={() => setCoverOpen(true)}
            >
              <ImagePlus size={13} />
              Kapak Ekle
            </button>
          </div>
        )}

        <div className="px-6 pb-10 pt-4 lg:px-10 lg:pt-6">
          <div className="relative mb-2 inline-block">
            <button
              type="button"
              className="rounded-md px-1 text-4xl hover:bg-ink-50"
              onClick={() => setIconMenu((v) => !v)}
              title="İkon"
            >
              {page.icon || '📄'}
            </button>
            {iconMenu ? (
              <div className="absolute left-0 top-12 z-20 grid grid-cols-6 gap-1 border border-[var(--ww-border)] bg-white p-2 shadow-[var(--ww-shadow-sm)]">
                <button
                  type="button"
                  className="rounded p-1 text-[12px] text-[var(--ww-text-muted)] hover:bg-ink-50"
                  onClick={() => void saveIcon(null)}
                >
                  Yok
                </button>
                {PAGE_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className="rounded p-1 text-lg hover:bg-ink-50"
                    onClick={() => void saveIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <input
            data-page-title
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void saveTitle()}
            placeholder="Adsız sayfa"
            className="mb-8 w-full border-0 bg-transparent text-[2rem] font-semibold tracking-tight text-[var(--ww-text)] outline-none placeholder:text-[var(--ww-text-muted)]"
          />
          {id ? <BlockEditor pageId={id} onSaveStatusChange={setSaveStatus} /> : null}
        </div>
      </div>

      <MediaPickerModal
        open={coverOpen}
        onClose={() => setCoverOpen(false)}
        title="Kapak görseli"
        allowedCategories={['IMAGE']}
        onSelect={(asset) => {
          if (asset.url) void saveCover(asset.url);
          setCoverOpen(false);
        }}
      />
    </PageCanvas>
  );
}
