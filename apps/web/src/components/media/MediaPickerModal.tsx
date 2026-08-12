import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { FileText, Image as ImageIcon, Search, Upload, Video } from 'lucide-react';
import type { MediaCategory } from '@woonwork/shared';
import { Modal } from '../ui/Modal';
import { Button, Input } from '../ui/Form';
import { useToast } from '../ui/Toast';
import {
  formatBytes,
  listMedia,
  uploadMediaFile,
  type MediaAssetDto,
} from '../../lib/media';

type PickerCategory = MediaCategory | 'DOCUMENT_OTHER' | '';

const FILTERS: Array<{ key: PickerCategory; label: string }> = [
  { key: '', label: 'Tümü' },
  { key: 'IMAGE', label: 'Görseller' },
  { key: 'VIDEO', label: 'Videolar' },
  { key: 'DOCUMENT', label: 'Belgeler' },
];

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
  allowedCategories,
  title = 'Medya Seç',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAssetDto, meta?: { uploaded?: boolean }) => void;
  allowedCategories?: MediaCategory[];
  title?: string;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'library' | 'upload'>('library');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<PickerCategory>('');
  const [items, setItems] = useState<MediaAssetDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const categoryQuery = useMemo(() => {
    if (allowedCategories?.length === 1) return allowedCategories[0];
    if (filter === 'DOCUMENT' || filter === 'DOCUMENT_OTHER') return 'DOCUMENT';
    if (filter === 'IMAGE' || filter === 'VIDEO') return filter;
    return '';
  }, [allowedCategories, filter]);

  const visibleFilters = useMemo(() => {
    if (!allowedCategories?.length) return FILTERS;
    return FILTERS.filter(
      (f) =>
        !f.key ||
        allowedCategories.includes(f.key as MediaCategory) ||
        (f.key === 'DOCUMENT' &&
          (allowedCategories.includes('DOCUMENT') || allowedCategories.includes('OTHER'))),
    );
  }, [allowedCategories]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMedia({
        q: q.trim() || undefined,
        category: categoryQuery || undefined,
        pageSize: 48,
      });
      let next = data.items;
      if (allowedCategories?.length) {
        next = next.filter((item) => allowedCategories.includes(item.category));
      }
      setItems(next);
    } catch (err) {
      toast((err as Error).message || 'Medya listelenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [allowedCategories, categoryQuery, q, toast]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) {
      setTab('library');
      setQ('');
      setFilter(allowedCategories?.length === 1 ? allowedCategories[0] : '');
      setProgress(0);
      setUploading(false);
    }
  }, [open, allowedCategories]);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    try {
      let last: MediaAssetDto | null = null;
      for (const file of list) {
        setProgress(0);
        last = await uploadMediaFile(file, setProgress);
      }
      toast('Dosya yüklendi', 'success');
      if (last) {
        if (
          !allowedCategories?.length ||
          allowedCategories.includes(last.category)
        ) {
          onSelect(last, { uploaded: true });
          onClose();
          return;
        }
      }
      setTab('library');
      await load();
    } catch (err) {
      toast((err as Error).message || 'Yükleme başarısız', 'error');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files?.length) {
      void handleFiles(event.dataTransfer.files);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-navy-100 pb-3">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === 'library' ? 'bg-navy-900 text-white' : 'text-navy-600 hover:bg-navy-50'
            }`}
            onClick={() => setTab('library')}
          >
            Medya Kütüphanesinden Seç
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === 'upload' ? 'bg-navy-900 text-white' : 'text-navy-600 hover:bg-navy-50'
            }`}
            onClick={() => setTab('upload')}
          >
            Yeni Dosya Yükle
          </button>
        </div>

        {tab === 'library' ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Ara..."
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {visibleFilters.map((f) => (
                  <button
                    key={f.key || 'all'}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      filter === f.key
                        ? 'bg-navy-900 text-white'
                        : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {loading ? (
                <p className="py-10 text-center text-sm text-navy-400">Yükleniyor...</p>
              ) : !items.length ? (
                <p className="py-10 text-center text-sm text-navy-400">Medya bulunamadı</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelect(item);
                        onClose();
                      }}
                      className="group overflow-hidden rounded-xl border border-navy-100 text-left transition hover:border-navy-300 hover:bg-navy-50/50"
                    >
                      <div className="flex aspect-video items-center justify-center bg-navy-50">
                        {item.category === 'IMAGE' && item.url ? (
                          <img
                            src={item.url}
                            alt={item.originalFileName}
                            className="h-full w-full object-cover"
                          />
                        ) : item.category === 'VIDEO' ? (
                          <Video size={22} className="text-navy-400" />
                        ) : (
                          <FileText size={22} className="text-navy-400" />
                        )}
                      </div>
                      <div className="space-y-0.5 px-2.5 py-2">
                        <p className="truncate text-xs font-medium text-navy-900">
                          {item.originalFileName}
                        </p>
                        <p className="text-[11px] text-navy-400">{formatBytes(item.size)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-12 transition ${
              dragOver ? 'border-navy-400 bg-navy-50' : 'border-navy-200 bg-navy-50/40'
            }`}
          >
            <Upload size={28} className="text-navy-400" />
            <p className="mt-3 text-sm font-medium text-navy-800">Dosyayı sürükleyip bırakın</p>
            <p className="mt-1 text-xs text-navy-400">veya bilgisayarınızdan seçin</p>
            <Button
              type="button"
              className="mt-4"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? `Yükleniyor ${progress}%` : 'Dosya Seç'}
            </Button>
            {uploading ? (
              <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-navy-100">
                <div
                  className="h-full rounded-full bg-navy-800 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              accept={
                allowedCategories?.includes('IMAGE') && allowedCategories.length === 1
                  ? 'image/*'
                  : allowedCategories?.includes('VIDEO') && allowedCategories.length === 1
                    ? 'video/*'
                    : undefined
              }
              onChange={(e) => {
                if (e.target.files) void handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

export function MediaTypeIcon({ category }: { category: MediaCategory }) {
  if (category === 'IMAGE') return <ImageIcon size={16} />;
  if (category === 'VIDEO') return <Video size={16} />;
  return <FileText size={16} />;
}
