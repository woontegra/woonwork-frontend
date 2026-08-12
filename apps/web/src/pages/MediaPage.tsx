import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Download, ExternalLink, Trash2, Upload } from 'lucide-react';
import type { MediaCategory } from '@woonwork/shared';
import { ApiClientError } from '../lib/api';
import {
  deleteMediaAsset,
  formatBytes,
  listMedia,
  uploadMediaFile,
  type MediaAssetDto,
} from '../lib/media';
import { formatDate } from '../lib/labels';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../components/ui/Toast';
import { Button, SearchInput } from '../components/ui/Form';
import { EmptyState, PageCanvas, PageHeader, PageToolbar, Skeleton } from '../components/ui/PageLoader';
import { Modal } from '../components/ui/Modal';
import { MediaTypeIcon } from '../components/media/MediaPickerModal';

const FILTERS: Array<{ key: '' | MediaCategory; label: string }> = [
  { key: '', label: 'Tümü' },
  { key: 'IMAGE', label: 'Görseller' },
  { key: 'VIDEO', label: 'Videolar' },
  { key: 'DOCUMENT', label: 'Belgeler' },
];

interface UploadJob {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

export function MediaPage() {
  const { activeTenant } = useTenant();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaAssetDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [category, setCategory] = useState<'' | MediaCategory>('');
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<MediaAssetDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    asset: MediaAssetDto;
    references: number;
  } | null>(null);

  const load = useCallback(async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const data = await listMedia({
        q: qDebounced.trim() || undefined,
        category: category || undefined,
        pageSize: 60,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      toast((err as Error).message || 'Medya yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTenant, category, qDebounced, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQDebounced(q), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const images = useMemo(() => items.filter((i) => i.category === 'IMAGE'), [items]);
  const videos = useMemo(() => items.filter((i) => i.category === 'VIDEO'), [items]);
  const docs = useMemo(
    () => items.filter((i) => i.category === 'DOCUMENT' || i.category === 'OTHER'),
    [items],
  );

  async function runUploads(files: FileList | File[]) {
    const list = Array.from(files);
    for (const file of list) {
      const id = crypto.randomUUID();
      setJobs((prev) => [...prev, { id, name: file.name, progress: 0 }]);
      try {
        await uploadMediaFile(file, (progress) => {
          setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, progress } : j)));
        });
        setJobs((prev) => prev.filter((j) => j.id !== id));
      } catch (err) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === id ? { ...j, error: (err as Error).message || 'Hata' } : j,
          ),
        );
        toast((err as Error).message || 'Yükleme başarısız', 'error');
      }
    }
    await load();
  }

  async function requestDelete(asset: MediaAssetDto, force = false) {
    try {
      await deleteMediaAsset(asset.id, force);
      toast('Dosya silindi', 'success');
      setPendingDelete(null);
      if (preview?.id === asset.id) setPreview(null);
      await load();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        const references = Number((err.details as { references?: number })?.references ?? 0);
        setPendingDelete({ asset, references });
        return;
      }
      toast((err as Error).message || 'Silinemedi', 'error');
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files?.length) void runUploads(event.dataTransfer.files);
  }

  return (
    <PageCanvas mode="DATA_WIDE">
      <PageHeader hideTitle description={`${total} dosya · çalışma alanına özel depolama`} />
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void runUploads(e.target.files);
          e.target.value = '';
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border border-dashed px-4 py-5 transition ${
          dragOver ? 'border-accent bg-accent-soft/40' : 'border-[var(--ww-border-strong)] bg-white/60'
        }`}
      >
        <p className="text-center text-sm text-[var(--ww-text-muted)]">
          Dosyaları buraya sürükleyip bırakın veya yukarıdan yükleyin
        </p>
      </div>

      {jobs.length ? (
        <div className="space-y-2 rounded-xl border border-navy-100 bg-white p-3">
          {jobs.map((job) => (
            <div key={job.id} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-medium text-navy-800">{job.name}</span>
                <span className="text-navy-400">
                  {job.error ? job.error : `${job.progress}%`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-navy-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    job.error ? 'bg-red-500' : 'bg-navy-800'
                  }`}
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <PageToolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Dosya ara..." size="sm" />
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key || 'all'}
              type="button"
              onClick={() => setCategory(f.key)}
              className={`h-8 rounded-[var(--ww-control-radius)] px-2.5 text-[12px] font-medium transition ${
                category === f.key
                  ? 'bg-ink-950 text-white'
                  : 'text-[var(--ww-text-secondary)] hover:bg-ink-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button className="ml-auto" type="button" onClick={() => inputRef.current?.click()}>
          <Upload size={14} strokeWidth={1.75} />
          Dosya Yükle
        </Button>
      </PageToolbar>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : !items.length ? (
        <EmptyState
          title="Henüz medya yok"
          description="Görsel, video veya belge yükleyerek başlayın."
        />
      ) : (
        <div className="space-y-8">
          {(!category || category === 'IMAGE') && images.length ? (
            <section className="space-y-3">
              {!category ? (
                <h2 className="text-sm font-semibold text-navy-800">Görseller</h2>
              ) : null}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {images.map((item) => (
                  <article
                    key={item.id}
                    className="group overflow-hidden rounded-xl border border-navy-100 bg-white"
                  >
                    <button
                      type="button"
                      className="block w-full"
                      onClick={() => setPreview(item)}
                    >
                      <div className="aspect-square bg-navy-50">
                        {item.url ? (
                          <img
                            src={item.url}
                            alt={item.originalFileName}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                    </button>
                    <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-navy-900">
                          {item.originalFileName}
                        </p>
                        <p className="text-[11px] text-navy-400">
                          {formatBytes(item.size)} · {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-md p-1 text-navy-400 opacity-0 transition hover:bg-navy-50 hover:text-red-600 group-hover:opacity-100"
                        onClick={() => void requestDelete(item)}
                        title="Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {(!category || category === 'VIDEO') && videos.length ? (
            <section className="space-y-3">
              {!category ? (
                <h2 className="text-sm font-semibold text-navy-800">Videolar</h2>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {videos.map((item) => (
                  <article
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-navy-100 bg-white px-3 py-2.5"
                  >
                    <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-400">
                      <MediaTypeIcon category="VIDEO" />
                    </div>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setPreview(item)}
                    >
                      <p className="truncate text-sm font-medium text-navy-900">
                        {item.originalFileName}
                      </p>
                      <p className="text-xs text-navy-400">
                        {formatBytes(item.size)} · {formatDate(item.createdAt)}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 hover:text-red-600"
                      onClick={() => void requestDelete(item)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {(!category || category === 'DOCUMENT') && docs.length ? (
            <section className="space-y-3">
              {!category ? (
                <h2 className="text-sm font-semibold text-navy-800">Belgeler</h2>
              ) : null}
              <div className="divide-y divide-navy-50 overflow-hidden rounded-xl border border-navy-100 bg-white">
                {docs.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy-500">
                      <MediaTypeIcon category={item.category} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy-900">
                        {item.originalFileName}
                      </p>
                      <p className="text-xs text-navy-400">
                        {formatBytes(item.size)} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700"
                        title="Aç"
                      >
                        <ExternalLink size={14} />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-navy-400 hover:bg-navy-50 hover:text-red-600"
                      onClick={() => void requestDelete(item)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.originalFileName || 'Önizleme'}
        wide
      >
        {preview ? (
          <div className="space-y-4">
            {preview.category === 'IMAGE' && preview.url ? (
              <img
                src={preview.url}
                alt={preview.originalFileName}
                className="max-h-[60vh] w-full rounded-xl object-contain bg-navy-50"
              />
            ) : preview.category === 'VIDEO' && preview.url ? (
              <video
                src={preview.url}
                controls
                className="max-h-[60vh] w-full rounded-xl bg-navy-950"
              />
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-navy-100 px-4 py-6">
                <MediaTypeIcon category={preview.category} />
                <div>
                  <p className="text-sm font-medium text-navy-900">{preview.originalFileName}</p>
                  <p className="text-xs text-navy-400">{formatBytes(preview.size)}</p>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {preview.url ? (
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-3.5 py-2 text-sm font-medium text-white"
                >
                  <Download size={14} />
                  Aç / İndir
                </a>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() => void requestDelete(preview)}
              >
                Sil
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Dosya kullanımda"
      >
        {pendingDelete ? (
          <div className="space-y-4">
            <p className="text-sm text-navy-600">
              Bu dosya {pendingDelete.references} içerikte kullanılıyor. Yine de silmek
              istiyor musunuz? Bağlı bloklardan medya referansı kaldırılır.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPendingDelete(null)}>
                Vazgeç
              </Button>
              <Button
                type="button"
                onClick={() => void requestDelete(pendingDelete.asset, true)}
              >
                Zorla Sil
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageCanvas>
  );
}
