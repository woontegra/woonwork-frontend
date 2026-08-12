import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  SUGGESTED_HASHTAG_CATEGORIES,
  previewBulkHashtags,
  type SocialHashtagStatus,
} from '@woonwork/shared';
import { Button, Input, SearchInput, Select, SocialFilterToolbar, TextArea } from '../../components/social/SocialControls';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { AnchoredPopover } from '../../components/social/AnchoredPopover';
import { HashtagCategoryCell } from '../../components/social/HashtagCategoryCell';
import { TableBadgePopover } from '../../components/social/TableBadgePopover';
import { EditableLongTextCell } from '../../components/social/tableCells/EditableLongTextCell';
import { EditableTextCell } from '../../components/social/tableCells/EditableTextCell';
import { formatCompactDate } from '../../lib/labels';
import {
  bulkCreateHashtags,
  createHashtag,
  deleteHashtag,
  fetchHashtags,
  hashtagStatusBadgeClass,
  hashtagStatusLabels,
  updateHashtag,
  type SocialHashtagDto,
} from '../../lib/socialHashtags';
import { useSocialWorkspace } from './SocialLayout';

type EditField = 'tag' | 'notes';
type EditingCell = { id: string; field: EditField };

const STATUS_OPTIONS: Array<{ value: SocialHashtagStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'BLOCKED', label: 'Blocklist' },
  { value: 'DISABLED', label: 'Pasif' },
];

export function SocialHashtagsPage() {
  const { toast } = useToast();
  const { brands, bump } = useSocialWorkspace();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<SocialHashtagDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [brandId, setBrandId] = useState(() => searchParams.get('brandId') ?? '');
  const [status, setStatus] = useState<'' | SocialHashtagStatus>('');
  const [category, setCategory] = useState('');
  const [pending, setPending] = useState<Record<string, Set<string>>>({});
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const patchSeq = useRef<Record<string, number>>({});

  useEffect(() => {
    const t = window.setTimeout(() => setQ(search), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const reload = useCallback(() => {
    void fetchHashtags({
      page,
      limit: 50,
      search: q || undefined,
      brandId: brandId || undefined,
      status: status || undefined,
      category: category || undefined,
    })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => toast((err as Error).message || 'Hashtagler alınamadı', 'error'));
  }, [page, q, brandId, status, category, toast]);

  useEffect(() => {
    reload();
  }, [reload, bump]);

  const categories = useMemo(() => {
    const fromItems = items.map((item) => item.category).filter((value): value is string => Boolean(value));
    return [...new Set([...SUGGESTED_HASHTAG_CATEGORIES, ...fromItems])];
  }, [items]);

  const setFieldPending = useCallback((itemId: string, field: string, on: boolean) => {
    setPending((prev) => {
      const next = { ...prev };
      const set = new Set(next[itemId] ?? []);
      if (on) set.add(field);
      else set.delete(field);
      if (!set.size) delete next[itemId];
      else next[itemId] = set;
      return next;
    });
  }, []);

  const patchItem = useCallback(
    async (itemId: string, field: string, body: Record<string, unknown>) => {
      const seq = (patchSeq.current[itemId] ?? 0) + 1;
      patchSeq.current[itemId] = seq;
      setFieldPending(itemId, field, true);
      try {
        const saved = await updateHashtag(itemId, body);
        if (patchSeq.current[itemId] === seq) {
          setItems((list) => list.map((item) => (item.id === itemId ? saved : item)));
        }
        return true;
      } catch (err) {
        toast((err as Error).message || 'Kaydedilemedi', 'error');
        return false;
      } finally {
        if (patchSeq.current[itemId] === seq) setFieldPending(itemId, field, false);
      }
    },
    [setFieldPending, toast],
  );

  async function handleDelete(item: SocialHashtagDto) {
    if (!window.confirm(`${item.tag} silinecek. İçerik metinleri değişmez.`)) return;
    try {
      await deleteHashtag(item.id);
      toast('Hashtag silindi', 'success');
      reload();
    } catch (err) {
      toast((err as Error).message || 'Silinemedi', 'error');
    }
  }

  const TH = 'text-[11px] font-medium text-ink-400';
  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <>
      <div className="flex min-w-0 flex-col gap-2">
      <SocialFilterToolbar>
        <SearchInput size="toolbar" value={search} onChange={setSearch} placeholder="Hashtag ara..." />
        <Select
          size="toolbar"
          value={brandId}
          onChange={(e) => {
            setBrandId(e.target.value);
            setPage(1);
          }}
          className="w-[110px]"
        >
          <option value="">Marka</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </Select>
        <Select
          size="toolbar"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as '' | SocialHashtagStatus);
            setPage(1);
          }}
          className="w-[105px]"
        >
          <option value="">Durum</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Select
          size="toolbar"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="w-[110px]"
        >
          <option value="">Kategori</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="toolbar" variant="secondary" onClick={() => setBulkOpen(true)}>
            Toplu Ekle
          </Button>
          <Button size="toolbar" onClick={() => setCreateOpen(true)}>
            <Plus size={12} strokeWidth={1.75} />
            Yeni Hashtag
          </Button>
        </div>
      </SocialFilterToolbar>

      <div className="overflow-auto border border-[var(--ww-border)] bg-white">
        <table className="ww-table min-w-[1100px] table-fixed">
          <colgroup>
            <col className="w-[200px]" />
            <col className="w-[170px]" />
            <col className="w-[140px]" />
            <col className="w-[110px]" />
            <col className="w-[90px]" />
            <col className="w-[120px]" />
            <col />
            <col className="w-[30px]" />
          </colgroup>
          <thead className="sticky top-0 z-[1]">
            <tr>
              <th className={TH}>Hashtag</th>
              <th className={TH}>Marka</th>
              <th className={TH}>Kategori</th>
              <th className={TH}>Durum</th>
              <th className={TH}>Kullanım</th>
              <th className={TH}>Son Kullanım</th>
              <th className={TH}>Not</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const last = formatCompactDate(item.lastUsedAt);
              const fieldPending = pending[item.id];
              return (
                <tr key={item.id}>
                  <td className="px-2">
                    <EditableTextCell
                      value={item.tag}
                      isEditing={editingCell?.id === item.id && editingCell.field === 'tag'}
                      onStartEdit={() => setEditingCell({ id: item.id, field: 'tag' })}
                      onSave={(next) => patchItem(item.id, 'tag', { tag: next })}
                      onCancelEdit={() => setEditingCell(null)}
                      registerCommit={() => undefined}
                      placeholder="#hashtag"
                      pending={fieldPending?.has('tag')}
                    />
                  </td>
                  <td className="px-2">
                    <TableBadgePopover
                      value={item.socialBrandId}
                      label={item.brand?.name ?? 'Marka'}
                      options={brands.map((brand) => ({ value: brand.id, label: brand.name }))}
                      onSelect={(value) => {
                        if (!value || value === item.socialBrandId) return;
                        void patchItem(item.id, 'socialBrandId', { socialBrandId: value });
                      }}
                      badgeClassName="bg-ink-50/80 text-ink-600"
                      disabled={fieldPending?.has('socialBrandId')}
                    />
                  </td>
                  <td className="px-2">
                    <HashtagCategoryCell
                      value={item.category}
                      extraOptions={categories}
                      pending={fieldPending?.has('category')}
                      onSave={(next) => patchItem(item.id, 'category', { category: next })}
                    />
                  </td>
                  <td className="px-2">
                    <TableBadgePopover
                      value={item.status}
                      label={hashtagStatusLabels[item.status]}
                      options={STATUS_OPTIONS}
                      onSelect={(value) => {
                        if (!value || value === item.status) return;
                        void patchItem(item.id, 'status', { status: value });
                      }}
                      badgeClassName={hashtagStatusBadgeClass[item.status]}
                      disabled={fieldPending?.has('status')}
                    />
                  </td>
                  <td className="px-2 text-[12px] text-ink-500">{item.usageCount}</td>
                  <td className="px-2 text-[12px] text-ink-500">{last?.date ?? '—'}</td>
                  <td className="px-2">
                    <EditableLongTextCell
                      value={item.notes}
                      isEditing={editingCell?.id === item.id && editingCell.field === 'notes'}
                      onStartEdit={() => setEditingCell({ id: item.id, field: 'notes' })}
                      onSave={(next) => patchItem(item.id, 'notes', { notes: next })}
                      onCancelEdit={() => setEditingCell(null)}
                      registerCommit={() => undefined}
                      popoverWidth={360}
                      placeholder="Not"
                      pending={fieldPending?.has('notes')}
                    />
                  </td>
                  <td className="px-1">
                    <HashtagRowMenu
                      open={menuId === item.id}
                      onOpenChange={(open) => setMenuId(open ? item.id : null)}
                      onDelete={() => void handleDelete(item)}
                    />
                  </td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-ink-400">
                  Hashtag yok
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      </div>

      {pages > 1 ? (
        <div className="mt-2 flex items-center justify-end gap-2 text-[12px] text-ink-500">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="hover:text-ink-800 disabled:opacity-40">
            Önceki
          </button>
          <span>
            {page} / {pages}
          </span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="hover:text-ink-800 disabled:opacity-40">
            Sonraki
          </button>
        </div>
      ) : null}

      <CreateHashtagModal
        open={createOpen}
        brands={brands}
        categories={categories}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          reload();
        }}
      />
      <BulkHashtagModal
        open={bulkOpen}
        brands={brands}
        categories={categories}
        onClose={() => setBulkOpen(false)}
        onCreated={reload}
      />
    </>
  );
}

function HashtagRowMenu({
  open,
  onOpenChange,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
        className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] text-ink-400 hover:bg-ink-50 hover:text-ink-600"
      >
        <MoreHorizontal size={14} />
      </button>
      <AnchoredPopover open={open} anchorRef={anchorRef} onClose={() => onOpenChange(false)} align="end" width={140} className="py-1">
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            onDelete();
          }}
          className="flex w-full px-2.5 py-1.5 text-left text-[12px] text-danger hover:bg-red-50/70"
        >
          Sil
        </button>
      </AnchoredPopover>
    </>
  );
}

function CreateHashtagModal({
  open,
  brands,
  categories,
  onClose,
  onCreated,
}: {
  open: boolean;
  brands: Array<{ id: string; name: string }>;
  categories: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [socialBrandId, setSocialBrandId] = useState(brands[0]?.id ?? '');
  const [tag, setTag] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<SocialHashtagStatus>('ACTIVE');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSocialBrandId(brands[0]?.id ?? '');
      setTag('');
      setCategory('');
      setStatus('ACTIVE');
      setNotes('');
    }
  }, [open, brands]);

  async function save() {
    if (!socialBrandId) {
      toast('Marka seçin', 'error');
      return;
    }
    setSaving(true);
    try {
      await createHashtag({
        socialBrandId,
        tag,
        status,
        category: category || null,
        notes: notes || null,
      });
      toast('Hashtag eklendi', 'success');
      onCreated();
    } catch (err) {
      toast((err as Error).message || 'Kaydedilemedi', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Yeni Hashtag">
      <div className="space-y-3">
        <Select label="Marka" value={socialBrandId} onChange={(e) => setSocialBrandId(e.target.value)}>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </Select>
        <Input
          label="Hashtag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="#bilirkisihesap"
        />
        <Input
          label="Kategori"
          list="hashtag-category-options"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Marka"
        />
        <datalist id="hashtag-category-options">
          {categories.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        <Select label="Durum" value={status} onChange={(e) => setStatus(e.target.value as SocialHashtagStatus)}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <TextArea label="Not" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            İptal
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BulkHashtagModal({
  open,
  brands,
  categories,
  onClose,
  onCreated,
}: {
  open: boolean;
  brands: Array<{ id: string; name: string }>;
  categories: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [socialBrandId, setSocialBrandId] = useState(brands[0]?.id ?? '');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<SocialHashtagStatus>('ACTIVE');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    duplicate: number;
    invalid: number;
    duplicates: string[];
    invalidTags: string[];
  } | null>(null);

  useEffect(() => {
    if (open) {
      setSocialBrandId(brands[0]?.id ?? '');
      setCategory('');
      setStatus('ACTIVE');
      setText('');
      setResult(null);
    }
  }, [open, brands]);

  const preview = useMemo(() => previewBulkHashtags(text), [text]);

  async function save() {
    if (!socialBrandId) {
      toast('Marka seçin', 'error');
      return;
    }
    if (!text.trim()) {
      toast('Hashtag listesi gerekli', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await bulkCreateHashtags({
        socialBrandId,
        text,
        status,
        category: category || null,
      });
      setResult({
        created: res.created,
        duplicate: res.duplicate,
        invalid: res.invalid,
        duplicates: res.duplicates ?? [],
        invalidTags: res.invalidTags ?? [],
      });
      toast(`${res.created} hashtag eklendi · ${res.duplicate} zaten vardı · ${res.invalid} geçersiz`, 'success');
      if (res.created) onCreated();
    } catch (err) {
      toast((err as Error).message || 'Toplu ekleme başarısız', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Toplu Ekle">
      <div className="space-y-3">
        <Select
          label="Marka"
          value={socialBrandId}
          onChange={(e) => setSocialBrandId(e.target.value)}
        >
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </Select>
        <Input
          label="Kategori"
          list="hashtag-bulk-categories"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Marka"
        />
        <datalist id="hashtag-bulk-categories">
          {categories.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        <Select
          label="Durum"
          value={status}
          onChange={(e) => setStatus(e.target.value as SocialHashtagStatus)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <TextArea
          label="Hashtagler"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          className="min-h-[180px] max-h-[240px]"
          placeholder={'#bilirkisihesap\n#ishukuku\n#fazlamesai'}
        />
        {text.trim() ? (
          <div className="space-y-0.5 text-[12.5px] text-[var(--ww-text-secondary)]">
            <p>
              {preview.unique.length} hashtag algılandı
              {preview.duplicateCount ? ` · ${preview.duplicateCount} tekrar` : ''}
              {preview.invalidCount ? ` · ${preview.invalidCount} geçersiz` : ''}
            </p>
            {preview.duplicates.length ? (
              <p className="text-[12px] text-ink-400">Tekrar: {preview.duplicates.join(' ')}</p>
            ) : null}
            {preview.invalid.length ? (
              <p className="text-[12px] text-ink-400">Geçersiz: {preview.invalid.join(' ')}</p>
            ) : null}
          </div>
        ) : null}
        {result ? (
          <div className="space-y-0.5 text-[12.5px] text-[var(--ww-text-secondary)]">
            <p>
              {result.created} hashtag eklendi · {result.duplicate} zaten vardı · {result.invalid} geçersiz
            </p>
            {result.duplicates.length ? (
              <p className="text-[12px] text-ink-400">Zaten vardı: {result.duplicates.join(' ')}</p>
            ) : null}
            {result.invalidTags.length ? (
              <p className="text-[12px] text-ink-400">Geçersiz: {result.invalidTags.join(' ')}</p>
            ) : null}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Kapat
          </Button>
          <Button disabled={saving || !preview.unique.length} onClick={() => void save()}>
            {saving ? 'Ekleniyor…' : 'Hashtagleri Ekle'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
