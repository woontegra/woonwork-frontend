import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { SocialContentStatus, SocialContentType, SocialPlatform } from '@woonwork/shared';
import { Button, DateInput, SearchInput, Select, SocialFilterToolbar } from '../../components/social/SocialControls';
import { useToast } from '../../components/ui/Toast';
import {
  ALL_PLATFORMS,
  ALL_STATUSES,
  ALL_TYPES,
  contentTypeLabels,
  deleteContent,
  duplicateContent,
  fetchContents,
  platformLabels,
  publishContent,
  statusLabels,
  updateContent,
  type SocialContentDto,
} from '../../lib/social';
import {
  type EditingCell,
  type TableCellField,
  type WorkflowField,
  validateWorkflowToggle,
  workflowPatchBody,
  workflowToggleToast,
} from '../../lib/socialContentTable';
import { failedDestinationIds, SocialContentTableRow } from '../../components/social/SocialContentTableRow';
import { useSocialWorkspace } from './SocialLayout';

export function SocialContentsPage() {
  const { toast } = useToast();
  const { brands, openComposer, bump } = useSocialWorkspace();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<SocialContentDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [brandId, setBrandId] = useState(() => searchParams.get('brandId') ?? '');
  const [platform, setPlatform] = useState<'' | SocialPlatform>('');
  const [status, setStatus] = useState<'' | SocialContentStatus>('');
  const [contentType, setContentType] = useState<'' | SocialContentType>('');
  const [approved, setApproved] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('scheduledAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pending, setPending] = useState<Record<string, Set<string>>>({});
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const patchSeq = useRef<Record<string, number>>({});
  const commitRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(search), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const reload = useMemo(
    () => () =>
      void fetchContents({
        page,
        limit: 50,
        search: q || undefined,
        brandId: brandId || undefined,
        platform: platform || undefined,
        status: status || undefined,
        contentType: contentType || undefined,
        approved: approved === '' ? undefined : approved === 'true',
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortDirection,
      })
        .then((res) => {
          setItems(res.items);
          setTotal(res.total);
        })
        .catch((err) => toast((err as Error).message || 'İçerikler alınamadı', 'error')),
    [page, q, brandId, platform, status, contentType, approved, dateFrom, dateTo, sortBy, sortDirection, toast],
  );

  useEffect(() => {
    reload();
  }, [reload, bump]);

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
    async (
      itemId: string,
      field: string,
      body: Record<string, unknown>,
      opts?: { retainOnError?: boolean },
    ): Promise<boolean> => {
      let prev: SocialContentDto | undefined;
      setItems((list) => {
        prev = list.find((i) => i.id === itemId);
        if (!prev) return list;
        return list.map((i) => (i.id === itemId ? ({ ...i, ...body } as SocialContentDto) : i));
      });
      if (!prev) return false;

      const seq = (patchSeq.current[itemId] ?? 0) + 1;
      patchSeq.current[itemId] = seq;
      setFieldPending(itemId, field, true);

      try {
        const saved = await updateContent(itemId, body);
        if (patchSeq.current[itemId] === seq) {
          setItems((list) => list.map((i) => (i.id === itemId ? saved : i)));
        }
        return true;
      } catch (err) {
        if (patchSeq.current[itemId] === seq) {
          if (!opts?.retainOnError) {
            const snapshot = prev;
            setItems((list) => list.map((i) => (i.id === itemId ? snapshot : i)));
          }
          toast((err as Error).message || 'Değişiklik kaydedilemedi.', 'error');
        }
        return false;
      } finally {
        if (patchSeq.current[itemId] === seq) {
          setFieldPending(itemId, field, false);
        }
      }
    },
    [setFieldPending, toast],
  );

  const registerCommit = useCallback((fn: (() => Promise<void>) | null) => {
    commitRef.current = fn;
  }, []);

  const startEdit = useCallback(
    async (contentId: string, field: TableCellField) => {
      if (
        editingCell &&
        (editingCell.contentId !== contentId || editingCell.field !== field)
      ) {
        await commitRef.current?.();
      }
      setEditingCell({ contentId, field });
    },
    [editingCell],
  );

  const stopEdit = useCallback(() => {
    setEditingCell(null);
    commitRef.current = null;
  }, []);

  const toggleWorkflow = useCallback(
    async (itemId: string, field: WorkflowField, value: boolean) => {
      let prev: SocialContentDto | undefined;
      setItems((list) => {
        prev = list.find((i) => i.id === itemId);
        return list;
      });
      if (!prev) return;

      const check = validateWorkflowToggle(prev, field, value);
      if (!check.ok) {
        toast(check.message, 'error');
        return;
      }

      const body = workflowPatchBody(field, value);
      const seq = (patchSeq.current[itemId] ?? 0) + 1;
      patchSeq.current[itemId] = seq;
      setFieldPending(itemId, field, true);

      setItems((list) =>
        list.map((i) => (i.id === itemId ? ({ ...i, ...body } as SocialContentDto) : i)),
      );

      try {
        const saved = await updateContent(itemId, body);
        if (patchSeq.current[itemId] === seq) {
          setItems((list) => list.map((i) => (i.id === itemId ? saved : i)));
          toast(workflowToggleToast(field, value), 'success');
        }
      } catch (err) {
        if (patchSeq.current[itemId] === seq) {
          const snapshot = prev;
          setItems((list) => list.map((i) => (i.id === itemId ? snapshot : i)));
          toast((err as Error).message || 'İş akışı güncellenemedi', 'error');
        }
      } finally {
        if (patchSeq.current[itemId] === seq) {
          setFieldPending(itemId, field, false);
        }
      }
    },
    [setFieldPending, toast],
  );

  async function handleDelete(item: SocialContentDto) {
    if (!window.confirm(`"${item.title}" silinecek. Devam?`)) return;
    try {
      await deleteContent(item.id);
      toast('İçerik silindi', 'success');
      reload();
    } catch (err) {
      toast((err as Error).message || 'Silinemedi', 'error');
    }
  }

  async function handleDuplicate(item: SocialContentDto) {
    try {
      await duplicateContent(item.id);
      toast('İçerik çoğaltıldı', 'success');
      reload();
    } catch (err) {
      toast((err as Error).message || 'Çoğaltılamadı', 'error');
    }
  }

  async function handlePublish(item: SocialContentDto) {
    try {
      const result = await publishContent(item.id);
      setItems((list) => list.map((i) => (i.id === item.id ? result.content : i)));
      toast('Yayınlama tamamlandı', 'success');
    } catch (err) {
      toast((err as Error).message || 'Yayınlanamadı', 'error');
    }
  }

  async function handleRetry(item: SocialContentDto) {
    const ids = failedDestinationIds(item);
    if (!ids.length) return;
    try {
      const result = await publishContent(item.id, ids);
      setItems((list) => list.map((i) => (i.id === item.id ? result.content : i)));
      toast('Yeniden deneme tamamlandı', 'success');
    } catch (err) {
      toast((err as Error).message || 'Yeniden denenemedi', 'error');
    }
  }

  const TH = 'text-[11px] font-medium tracking-normal text-ink-400';

  return (
    <>
      <div className="ww-contents-ops">
      <div className="ww-contents-shell">
      <SocialFilterToolbar className="ww-contents-toolbar">
        <SearchInput
          size="toolbar"
          className="ww-contents-search"
          value={search}
          onChange={setSearch}
          placeholder="Ara..."
        />
        <Select size="toolbar" value={brandId} onChange={(e) => { setBrandId(e.target.value); setPage(1); }} className="w-[100px] shrink-0">
          <option value="">Marka</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select size="toolbar" value={platform} onChange={(e) => { setPlatform(e.target.value as '' | SocialPlatform); setPage(1); }} className="w-[96px] shrink-0">
          <option value="">Platform</option>
          {ALL_PLATFORMS.map((p) => <option key={p} value={p}>{platformLabels[p]}</option>)}
        </Select>
        <Select size="toolbar" value={status} onChange={(e) => { setStatus(e.target.value as '' | SocialContentStatus); setPage(1); }} className="w-[88px] shrink-0">
          <option value="">Durum</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </Select>
        <Select size="toolbar" value={contentType} onChange={(e) => { setContentType(e.target.value as '' | SocialContentType); setPage(1); }} className="w-[80px] shrink-0">
          <option value="">Tip</option>
          {ALL_TYPES.map((t) => <option key={t} value={t}>{contentTypeLabels[t]}</option>)}
        </Select>
        <Select size="toolbar" value={approved} onChange={(e) => { setApproved(e.target.value); setPage(1); }} className="w-[80px] shrink-0">
          <option value="">Onay</option>
          <option value="true">Onaylı</option>
          <option value="false">Onaysız</option>
        </Select>
        <DateInput
          density="toolbar"
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          aria-label="Başlangıç tarihi"
          className="w-[108px] shrink-0"
        />
        <DateInput
          density="toolbar"
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          aria-label="Bitiş tarihi"
          className="w-[108px] shrink-0"
        />
        <Select size="toolbar" value={`${sortBy}:${sortDirection}`} onChange={(e) => {
          const [s, d] = e.target.value.split(':');
          setSortBy(s);
          setSortDirection(d as 'asc' | 'desc');
        }} className="w-[100px] shrink-0">
          <option value="scheduledAt:asc">Yayın ↑</option>
          <option value="scheduledAt:desc">Yayın ↓</option>
          <option value="createdAt:desc">Oluşturma ↓</option>
          <option value="updatedAt:desc">Güncelleme ↓</option>
          <option value="title:asc">Başlık A–Z</option>
        </Select>
        <Button size="toolbar" className="ww-contents-new ml-auto shrink-0" onClick={() => openComposer()}>
          <Plus size={12} strokeWidth={1.75} />
          Yeni İçerik
        </Button>
      </SocialFilterToolbar>

      <div className="overflow-auto">
        <table className="ww-table min-w-[1450px] table-fixed">
          <colgroup>
            <col className="w-[160px]" />
            <col className="w-[115px]" />
            <col className="w-[200px]" />
            <col className="w-[300px]" />
            <col className="w-[135px]" />
            <col className="w-[95px]" />
            <col className="w-[85px]" />
            <col className="w-[46px]" />
            <col className="w-[46px]" />
            <col className="w-[46px]" />
            <col className="w-[100px]" />
            <col className="w-[95px]" />
            <col className="w-[30px]" />
          </colgroup>
          <thead className="sticky top-0 z-[1]">
            <tr>
              <th className={TH}>Marka</th>
              <th className={TH}>Yayın</th>
              <th className={TH}>Başlık</th>
              <th className={TH}>Açıklama</th>
              <th className={TH}>Notlar</th>
              <th className={TH}>Tip</th>
              <th className={TH}>Platformlar</th>
              <th className={`${TH} text-center`} title="Düzenlendi">Düz.</th>
              <th className={`${TH} text-center`} title="Onay">Onay</th>
              <th className={`${TH} text-center`} title="Yayına Hazır">Yay.</th>
              <th className={TH}>Durum</th>
              <th className={TH}>Güncelleme</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {!items.length ? (
              <tr>
                <td colSpan={13} className="px-3 py-10 text-center text-[13px] text-ink-400">
                  İçerik bulunamadı
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <SocialContentTableRow
                  key={item.id}
                  item={item}
                  brands={brands}
                  pending={pending[item.id] ?? new Set()}
                  editingCell={editingCell}
                  onStartEdit={(field) => void startEdit(item.id, field)}
                  onStopEdit={stopEdit}
                  registerCommit={registerCommit}
                  onOpenEditor={() => openComposer({ contentId: item.id })}
                  onPatch={(body, opts) => {
                    const field = Object.keys(body)[0] ?? 'patch';
                    return patchItem(item.id, field, body, opts);
                  }}
                  onWorkflowToggle={(field, value) => toggleWorkflow(item.id, field, value)}
                  onDuplicate={() => void handleDuplicate(item)}
                  onPublish={() => void handlePublish(item)}
                  onRetry={() => void handleRetry(item)}
                  onDelete={() => void handleDelete(item)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>

      <div className="flex items-center justify-between px-0.5 text-[11px] text-ink-400">
        <span>{total} içerik</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Önceki
          </Button>
          <Button size="sm" variant="ghost" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>
            Sonraki
          </Button>
        </div>
      </div>
      </div>
    </>
  );
}
