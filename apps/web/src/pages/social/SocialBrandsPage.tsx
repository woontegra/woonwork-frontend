import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MoreHorizontal, Plus, X } from 'lucide-react';
import { BrandDetailDrawer } from '../../components/social/brands/BrandDetailDrawer';
import { AnchoredPopover } from '../../components/social/AnchoredPopover';
import { SocialPlatformIcon } from '../../components/social/SocialPlatformIcon';
import {
  Button,
  FieldLabel,
  Input,
  SearchInput,
  Select,
  SocialFilterToolbar,
  TextArea,
} from '../../components/social/SocialControls';
import { TableBadgePopover } from '../../components/social/TableBadgePopover';
import { EditableLongTextCell } from '../../components/social/tableCells/EditableLongTextCell';
import { EditableTextCell } from '../../components/social/tableCells/EditableTextCell';
import { useToast } from '../../components/ui/Toast';
import { formatRelative } from '../../lib/labels';
import {
  accountLabel,
  createBrand,
  deleteBrand,
  listBrands,
  updateBrand,
  type SocialBrandAccountPreview,
  type SocialBrandDto,
} from '../../lib/social';
import {
  BRAND_COLOR_PRESETS,
  brandCanHardDelete,
  brandContentCount,
  brandHashtagCount,
  brandPlannedCount,
  filterBrandsForOps,
  sortBrandsForOps,
} from '../../lib/socialBrands';
import { useSocialWorkspace } from './SocialLayout';

type EditField = 'name' | 'description';
type EditingCell = { id: string; field: EditField };
type StatusFilter = '' | 'active' | 'passive';

const TH = 'text-[11px] font-medium text-ink-400';

export function SocialBrandsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { reloadBrands } = useSocialWorkspace();

  const [brands, setBrands] = useState<SocialBrandDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [pending, setPending] = useState<Record<string, Set<string>>>({});
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [drawerBrandId, setDrawerBrandId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const patchSeq = useRef<Record<string, number>>({});

  useEffect(() => {
    const t = window.setTimeout(() => setQ(search), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    void listBrands(false)
      .then(setBrands)
      .catch((err) => toast((err as Error).message || 'Markalar alınamadı', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => sortBrandsForOps(filterBrandsForOps(brands, { search: q, status })),
    [brands, q, status],
  );

  const setFieldPending = useCallback((brandId: string, field: string, on: boolean) => {
    setPending((prev) => {
      const next = { ...prev };
      const set = new Set(next[brandId] ?? []);
      if (on) set.add(field);
      else set.delete(field);
      if (!set.size) delete next[brandId];
      else next[brandId] = set;
      return next;
    });
  }, []);

  const patchBrand = useCallback(
    async (brandId: string, field: string, body: Record<string, unknown>) => {
      const seq = (patchSeq.current[brandId] ?? 0) + 1;
      patchSeq.current[brandId] = seq;
      setFieldPending(brandId, field, true);
      try {
        const saved = await updateBrand(brandId, body);
        if (patchSeq.current[brandId] === seq) {
          setBrands((list) => list.map((b) => (b.id === brandId ? saved : b)));
          reloadBrands();
        }
        return true;
      } catch (err) {
        toast((err as Error).message || 'Kaydedilemedi', 'error');
        return false;
      } finally {
        if (patchSeq.current[brandId] === seq) setFieldPending(brandId, field, false);
      }
    },
    [reloadBrands, setFieldPending, toast],
  );

  async function handleDelete(brand: SocialBrandDto) {
    if (!brandCanHardDelete(brand)) return;
    if (!window.confirm(`"${brand.name}" markası silinecek. Devam?`)) return;
    try {
      await deleteBrand(brand.id);
      toast('Marka silindi', 'success');
      load();
      reloadBrands();
    } catch (err) {
      toast((err as Error).message || 'Silinemedi', 'error');
    }
  }

  return (
    <>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-[var(--ww-text)]">Markalar</h2>
          <p className="text-[12px] text-[var(--ww-text-muted)]">
            Sosyal medya hesaplarını, içerik planını ve hashtag havuzunu marka bazında yönetin.
          </p>
        </div>

        <SocialFilterToolbar className="ww-brands-toolbar">
          <SearchInput
            size="toolbar"
            value={search}
            onChange={setSearch}
            placeholder="Ara..."
            className="ww-brands-search"
          />
          <Select
            size="toolbar"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="w-[100px] shrink-0"
          >
            <option value="">Durum</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </Select>
          <Button size="toolbar" className="ml-auto shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus size={12} strokeWidth={1.75} />
            Yeni Marka
          </Button>
        </SocialFilterToolbar>

        {loading ? (
          <p className="text-[12px] text-ink-400">Yükleniyor…</p>
        ) : !brands.length ? (
          <div className="border border-dashed border-[var(--ww-border)] bg-white px-4 py-8 text-center">
            <p className="text-[12px] font-medium text-[var(--ww-text)]">Henüz marka yok.</p>
            <p className="mt-1 text-[12px] text-[var(--ww-text-muted)]">
              İçerikleri ve sosyal hesapları marka bazında yönetmek için ilk markanızı oluşturun.
            </p>
            <Button size="toolbar" className="mt-3" onClick={() => setCreateOpen(true)}>
              <Plus size={12} strokeWidth={1.75} />
              Yeni Marka
            </Button>
          </div>
        ) : (
          <div className="ww-brands-ops overflow-auto border border-[var(--ww-border)] bg-white">
            <table className="ww-table min-w-[920px] table-fixed">
              <colgroup>
                <col className="w-[280px]" />
                <col className="w-[200px]" />
                <col className="w-[210px]" />
                <col className="w-[84px]" />
                <col className="w-[95px]" />
                <col className="w-[30px]" />
              </colgroup>
              <thead className="sticky top-0 z-[1]">
                <tr>
                  <th className={TH}>Marka</th>
                  <th className={TH}>Hesaplar</th>
                  <th className={TH}>Özet</th>
                  <th className={TH}>Durum</th>
                  <th className={TH}>Güncelleme</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {visible.map((brand) => {
                  const fieldPending = pending[brand.id];
                  return (
                    <tr key={brand.id}>
                      <td className="px-2 py-0 align-middle">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <BrandColorCell
                            color={brand.color || BRAND_COLOR_PRESETS[0]}
                            pending={fieldPending?.has('color')}
                            onSelect={(next) => {
                              if (next === (brand.color || BRAND_COLOR_PRESETS[0])) return;
                              void patchBrand(brand.id, 'color', { color: next });
                            }}
                          />
                          <div className="min-w-0 flex-1 leading-tight">
                            <EditableTextCell
                              value={brand.name}
                              isEditing={editingCell?.id === brand.id && editingCell.field === 'name'}
                              onStartEdit={() => setEditingCell({ id: brand.id, field: 'name' })}
                              onSave={(next) => {
                                const trimmed = next.trim();
                                if (!trimmed) {
                                  toast('Marka adı gerekli', 'error');
                                  return Promise.resolve(false);
                                }
                                return patchBrand(brand.id, 'name', { name: trimmed });
                              }}
                              onCancelEdit={() => setEditingCell(null)}
                              registerCommit={() => undefined}
                              placeholder="Marka adı"
                              pending={fieldPending?.has('name')}
                              className="!px-0 !py-0 text-[12.5px] leading-tight"
                            />
                            <EditableLongTextCell
                              value={brand.description}
                              isEditing={
                                editingCell?.id === brand.id && editingCell.field === 'description'
                              }
                              onStartEdit={() =>
                                setEditingCell({ id: brand.id, field: 'description' })
                              }
                              onSave={(next) =>
                                patchBrand(brand.id, 'description', { description: next })
                              }
                              onCancelEdit={() => setEditingCell(null)}
                              registerCommit={() => undefined}
                              popoverWidth={320}
                              placeholder="Açıklama ekle"
                              className="!mt-0 text-[11px] leading-none text-ink-400"
                              pending={fieldPending?.has('description')}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-0 align-middle">
                        <BrandAccountsCell accounts={brand.accounts} />
                      </td>
                      <td className="px-2 py-0 align-middle">
                        <BrandSummaryCell brand={brand} />
                      </td>
                      <td className="px-2 py-0 align-middle">
                        <TableBadgePopover
                          value={brand.isActive ? 'active' : 'passive'}
                          label={brand.isActive ? 'Aktif' : 'Pasif'}
                          options={[
                            { value: 'active', label: 'Aktif' },
                            { value: 'passive', label: 'Pasif' },
                          ]}
                          onSelect={(value) => {
                            const next = value === 'active';
                            if (next === brand.isActive) return;
                            void patchBrand(brand.id, 'isActive', { isActive: next });
                          }}
                          badgeClassName={
                            brand.isActive
                              ? 'bg-emerald-50/90 text-emerald-700'
                              : 'bg-ink-50 text-ink-500'
                          }
                          disabled={fieldPending?.has('isActive')}
                        />
                      </td>
                      <td className="px-2 py-0 align-middle whitespace-nowrap text-[11px] text-ink-400">
                        {formatRelative(brand.updatedAt)}
                      </td>
                      <td className="px-1 py-0 align-middle">
                        <BrandRowMenu
                          brand={brand}
                          open={menuId === brand.id}
                          onOpenChange={(open) => setMenuId(open ? brand.id : null)}
                          onEdit={() => setDrawerBrandId(brand.id)}
                          onViewContents={() =>
                            navigate(`/sosyal-medya/icerikler?brandId=${brand.id}`)
                          }
                          onViewHashtags={() =>
                            navigate(`/sosyal-medya/hashtagler?brandId=${brand.id}`)
                          }
                          onToggleActive={() =>
                            void patchBrand(brand.id, 'isActive', { isActive: !brand.isActive })
                          }
                          onDelete={() => void handleDelete(brand)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!visible.length ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-ink-400">
                      Eşleşen marka yok
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawerBrandId ? (
        <BrandDetailDrawer
          brandId={drawerBrandId}
          onClose={() => setDrawerBrandId(null)}
          onSaved={() => {
            load();
            reloadBrands();
          }}
        />
      ) : null}

      <CreateBrandModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          load();
          reloadBrands();
        }}
      />
    </>
  );
}

function BrandColorCell({
  color,
  pending,
  onSelect,
}: {
  color: string;
  pending?: boolean;
  onSelect: (color: string) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(color);

  useEffect(() => {
    if (!open) setCustom(color);
  }, [color, open]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
        aria-label="Renk seç"
      >
        <span
          className="h-2.5 w-2.5 rounded-full ring-1 ring-ink-200/80"
          style={{ background: color }}
        />
      </button>
      <AnchoredPopover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        width={168}
        align="start"
        className="p-2"
      >
        <p className="mb-1.5 text-[10px] font-medium text-ink-400">Renk</p>
        <div className="flex flex-wrap gap-1">
          {BRAND_COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={preset}
              onClick={() => {
                onSelect(preset);
                setOpen(false);
              }}
              className={`h-5 w-5 rounded-full ${color === preset ? 'ring-2 ring-ink-900 ring-offset-1' : ''}`}
              style={{ background: preset }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <input
            type="color"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="h-5 w-7 cursor-pointer bg-transparent"
            aria-label="Özel renk"
          />
          <button
            type="button"
            onClick={() => {
              onSelect(custom);
              setOpen(false);
            }}
            className="text-[11px] font-medium text-accent-strong hover:underline"
          >
            Uygula
          </button>
        </div>
      </AnchoredPopover>
    </>
  );
}

function BrandAccountsCell({ accounts }: { accounts?: SocialBrandAccountPreview[] }) {
  const list = accounts ?? [];
  if (!list.length) {
    return <span className="text-[11px] text-ink-300">—</span>;
  }
  const shown = list.slice(0, 2);
  const extra = list.length - shown.length;
  return (
    <div className="flex flex-col gap-px">
      {shown.map((account) => (
        <div key={account.id} className="flex min-w-0 items-center gap-1 leading-none">
          <SocialPlatformIcon platform={account.platform} size={13} muted={!account.isActive} />
          <span className="truncate text-[11.5px] leading-none text-[var(--ww-text-secondary)]">
            {accountLabel(account)}
          </span>
        </div>
      ))}
      {extra > 0 ? <span className="text-[10px] leading-none text-ink-400">+{extra}</span> : null}
    </div>
  );
}

function BrandSummaryCell({ brand }: { brand: SocialBrandDto }) {
  const items = [
    `${brandContentCount(brand)} içerik`,
    `${brandPlannedCount(brand)} planlı`,
    `${brandHashtagCount(brand)} hashtag`,
  ];
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-none text-[var(--ww-text-muted)]">
      {items.map((item, index) => (
        <span key={item} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {index > 0 ? <span className="text-ink-300" aria-hidden>·</span> : null}
          <span>{item}</span>
        </span>
      ))}
    </div>
  );
}

function BrandRowMenu({
  brand,
  open,
  onOpenChange,
  onEdit,
  onViewContents,
  onViewHashtags,
  onToggleActive,
  onDelete,
}: {
  brand: SocialBrandDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onViewContents: () => void;
  onViewHashtags: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const canDelete = brandCanHardDelete(brand);

  const itemClass =
    'flex w-full px-2.5 py-1.5 text-left text-[12px] text-[var(--ww-text)] hover:bg-ink-50';

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
        aria-label="Menü"
      >
        <MoreHorizontal size={14} />
      </button>
      <AnchoredPopover
        open={open}
        anchorRef={anchorRef}
        onClose={() => onOpenChange(false)}
        align="end"
        width={168}
        className="py-1"
      >
        <button
          type="button"
          className={itemClass}
          onClick={() => {
            onOpenChange(false);
            onEdit();
          }}
        >
          Düzenle
        </button>
        <button
          type="button"
          className={itemClass}
          onClick={() => {
            onOpenChange(false);
            onViewContents();
          }}
        >
          İçerikleri Gör
        </button>
        <button
          type="button"
          className={itemClass}
          onClick={() => {
            onOpenChange(false);
            onViewHashtags();
          }}
        >
          Hashtagleri Gör
        </button>
        <button
          type="button"
          className={itemClass}
          onClick={() => {
            onOpenChange(false);
            onToggleActive();
          }}
        >
          {brand.isActive ? 'Pasife Al' : 'Aktifleştir'}
        </button>
        {canDelete ? (
          <button
            type="button"
            className="flex w-full px-2.5 py-1.5 text-left text-[12px] text-danger hover:bg-red-50/70"
            onClick={() => {
              onOpenChange(false);
              onDelete();
            }}
          >
            Sil
          </button>
        ) : null}
      </AnchoredPopover>
    </>
  );
}

function CreateBrandModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>(BRAND_COLOR_PRESETS[0]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setColor(BRAND_COLOR_PRESETS[0]);
      setIsActive(true);
    }
  }, [open]);

  async function save() {
    if (!name.trim()) {
      toast('Marka adı gerekli', 'error');
      return;
    }
    setSaving(true);
    try {
      await createBrand({
        name: name.trim(),
        description: description.trim() || null,
        color,
        isActive,
      });
      toast('Marka oluşturuldu', 'success');
      onCreated();
    } catch (err) {
      toast((err as Error).message || 'Kaydedilemedi', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          <button
            type="button"
            aria-label="Kapat"
            className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Yeni Marka"
            className="relative w-full max-w-[400px] overflow-hidden rounded-[var(--ww-control-radius)] border border-[var(--ww-border)] bg-white shadow-[var(--ww-shadow-md)]"
            initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-[var(--ww-border)] px-3 py-2">
              <p className="text-[13px] font-semibold text-[var(--ww-text)]">Yeni Marka</p>
              <button
                type="button"
                aria-label="Kapat"
                onClick={onClose}
                className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-ink-400 hover:bg-ink-50 hover:text-ink-600"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2.5 px-3 py-3">
              <Input label="Marka adı" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="space-y-1">
                <FieldLabel>Renk</FieldLabel>
                <div className="flex flex-wrap items-center gap-1">
                  {BRAND_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-label={preset}
                      onClick={() => setColor(preset)}
                      className={`h-5 w-5 rounded-full ${color === preset ? 'ring-2 ring-ink-900 ring-offset-1' : ''}`}
                      style={{ background: preset }}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-5 w-7 cursor-pointer bg-transparent"
                    aria-label="Özel renk"
                  />
                </div>
              </div>
              <Select
                label="Durum"
                value={isActive ? 'active' : 'passive'}
                onChange={(e) => setIsActive(e.target.value === 'active')}
              >
                <option value="active">Aktif</option>
                <option value="passive">Pasif</option>
              </Select>
              <TextArea
                label="Açıklama"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--ww-border)] px-3 py-2.5">
              <Button variant="secondary" onClick={onClose}>
                İptal
              </Button>
              <Button disabled={saving} onClick={() => void save()}>
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
