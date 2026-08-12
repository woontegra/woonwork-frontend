import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import {
  Button,
  FieldLabel,
  Input,
  Select,
  TextArea,
} from '../SocialControls';
import { SocialPlatformIcon } from '../SocialPlatformIcon';
import { useToast } from '../../ui/Toast';
import {
  accountLabel,
  connectionStatusLabels,
  contentTypeLabels,
  getBrand,
  listSocialAccounts,
  statusLabels,
  updateBrand,
  updateSocialAccount,
  type SocialAccountDto,
  type SocialBrandDto,
} from '../../../lib/social';
import { BRAND_COLOR_PRESETS } from '../../../lib/socialBrands';
import { formatRelative, formatScheduleInline } from '../../../lib/labels';

type DrawerTab = 'general' | 'accounts' | 'hashtags' | 'contents' | 'stats';

const TABS: Array<{ id: DrawerTab; label: string }> = [
  { id: 'general', label: 'Genel' },
  { id: 'accounts', label: 'Hesaplar' },
  { id: 'hashtags', label: 'Hashtagler' },
  { id: 'contents', label: 'İçerikler' },
  { id: 'stats', label: 'İstatistik' },
];

export function BrandDetailDrawer({
  brandId,
  onClose,
  onSaved,
}: {
  brandId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<DrawerTab>('general');
  const [brand, setBrand] = useState<SocialBrandDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>(BRAND_COLOR_PRESETS[0]);
  const [isActive, setIsActive] = useState(true);
  const [allAccounts, setAllAccounts] = useState<SocialAccountDto[]>([]);
  const [attachId, setAttachId] = useState('');

  async function reload() {
    setLoading(true);
    try {
      const [detail, accounts] = await Promise.all([getBrand(brandId), listSocialAccounts()]);
      setBrand(detail);
      setName(detail.name);
      setDescription(detail.description ?? '');
      setColor(detail.color || BRAND_COLOR_PRESETS[0]);
      setIsActive(detail.isActive);
      setAllAccounts(accounts);
    } catch (err) {
      toast((err as Error).message || 'Marka yüklenemedi', 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  const attachable = useMemo(
    () => allAccounts.filter((a) => a.isActive && (!a.socialBrandId || a.socialBrandId === brandId)),
    [allAccounts, brandId],
  );

  const brandAccounts = useMemo(
    () => allAccounts.filter((a) => a.socialBrandId === brandId),
    [allAccounts, brandId],
  );

  async function saveGeneral() {
    if (!name.trim()) {
      toast('Marka adı gerekli', 'error');
      return;
    }
    setSaving(true);
    try {
      const saved = await updateBrand(brandId, {
        name: name.trim(),
        description: description.trim() || null,
        color,
        isActive,
      });
      setBrand((prev) => (prev ? { ...prev, ...saved } : saved));
      onSaved();
      toast('Marka güncellendi', 'success');
    } catch (err) {
      toast((err as Error).message || 'Kaydedilemedi', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function detachAccount(accountId: string) {
    try {
      await updateSocialAccount(accountId, { socialBrandId: null });
      await reload();
      onSaved();
      toast('Hesap markadan ayrıldı', 'success');
    } catch (err) {
      toast((err as Error).message || 'Ayrılamadı', 'error');
    }
  }

  async function attachAccount() {
    if (!attachId) return;
    try {
      await updateSocialAccount(attachId, { socialBrandId: brandId });
      setAttachId('');
      await reload();
      onSaved();
      toast('Hesap bağlandı', 'success');
    } catch (err) {
      toast((err as Error).message || 'Bağlanamadı', 'error');
    }
  }

  return (
    <AnimatePresence>
      <motion.button
        type="button"
        aria-label="Kapat"
        className="fixed inset-0 z-40 bg-ink-950/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-[var(--ww-border)] bg-white shadow-[var(--ww-shadow-md)]"
        initial={reduceMotion ? false : { x: 28, opacity: 0.96 }}
        animate={{ x: 0, opacity: 1 }}
        exit={reduceMotion ? undefined : { x: 16, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      >
        <header className="flex items-start justify-between border-b border-[var(--ww-border)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--ww-text)]">
              {brand?.name ?? 'Marka'}
            </p>
            <p className="text-[11px] text-[var(--ww-text-muted)]">
              Hesap, hashtag ve içerik özeti
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[5px] p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-600"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex gap-0.5 border-b border-[var(--ww-border)] px-3 py-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`h-7 rounded-[5px] px-2 text-[12px] font-medium ${
                tab === t.id ? 'bg-ink-950 text-white' : 'text-[var(--ww-text-secondary)] hover:bg-ink-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading || !brand ? (
            <p className="text-[12px] text-[var(--ww-text-muted)]">Yükleniyor…</p>
          ) : tab === 'general' ? (
            <div className="space-y-3">
              <Input label="Marka adı" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="space-y-0.5">
                <FieldLabel>Renk</FieldLabel>
                <div className="flex flex-wrap items-center gap-1.5">
                  {BRAND_COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      onClick={() => setColor(c)}
                      className={`h-6 w-6 rounded-full ${color === c ? 'ring-2 ring-ink-900 ring-offset-1' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-6 w-8 cursor-pointer bg-transparent"
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
                rows={3}
              />
              <p className="text-[11px] text-[var(--ww-text-muted)]">
                Logo alanı bu sürümde yok (schema genişletilmedi).
              </p>
              <Button disabled={saving} onClick={() => void saveGeneral()}>
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          ) : tab === 'accounts' ? (
            <div className="space-y-3">
              {!brandAccounts.length ? (
                <p className="text-[12px] text-[var(--ww-text-muted)]">Bu markaya bağlı hesap yok.</p>
              ) : (
                <div className="space-y-1">
                  {brandAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center gap-2 rounded-[6px] border border-[var(--ww-border)] px-2.5 py-2"
                    >
                      <SocialPlatformIcon platform={account.platform} size={14} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] text-[var(--ww-text)]">{accountLabel(account)}</p>
                        <p className="text-[10px] text-[var(--ww-text-muted)]">
                          {connectionStatusLabels[account.connectionStatus]}
                        </p>
                      </div>
                      <Button variant="ghost" onClick={() => void detachAccount(account.id)}>
                        Markadan Ayır
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-1.5 rounded-[6px] bg-[rgb(244_246_248/0.5)] px-2.5 py-2">
                <FieldLabel>Hesap bağla</FieldLabel>
                <div className="flex gap-1.5">
                  <Select
                    value={attachId}
                    onChange={(e) => setAttachId(e.target.value)}
                    className="min-w-0 flex-1"
                  >
                    <option value="">Hesap seçin</option>
                    {attachable
                      .filter((a) => a.socialBrandId !== brandId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {accountLabel(a)}
                          {a.socialBrandId ? ' (başka markada)' : ''}
                        </option>
                      ))}
                  </Select>
                  <Button disabled={!attachId} onClick={() => void attachAccount()}>
                    <Plus size={12} />
                    Bağla
                  </Button>
                </div>
                <p className="text-[10px] text-[var(--ww-text-muted)]">
                  Yeni OAuth başlatılmaz; mevcut bağlı hesaplar ilişkilendirilir.
                </p>
              </div>
            </div>
          ) : tab === 'hashtags' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['Kullanılabilir', brand.hashtagBreakdown?.usable ?? 0],
                    ['Blocklist', brand.hashtagBreakdown?.blocked ?? 0],
                    ['Pasif', brand.hashtagBreakdown?.inactive ?? 0],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-[6px] border border-[var(--ww-border)] px-2.5 py-2">
                    <p className="text-[10px] text-[var(--ww-text-muted)]">{label}</p>
                    <p className="text-[16px] font-medium tabular-nums text-[var(--ww-text)]">{value}</p>
                  </div>
                ))}
              </div>
              <Link
                to={`/sosyal-medya/hashtagler?brandId=${brandId}`}
                className="inline-flex h-8 items-center text-[12px] font-medium text-accent-strong hover:underline"
              >
                Hashtagleri Aç
              </Link>
            </div>
          ) : tab === 'contents' ? (
            <div className="space-y-2">
              {!(brand.recentContents?.length) ? (
                <p className="text-[12px] text-[var(--ww-text-muted)]">İçerik yok.</p>
              ) : (
                brand.recentContents.map((item) => {
                  const sched = formatScheduleInline(item.scheduledAt);
                  return (
                    <div
                      key={item.id}
                      className="rounded-[6px] border border-[var(--ww-border)] px-2.5 py-2"
                    >
                      <p className="truncate text-[12px] font-medium text-[var(--ww-text)]">{item.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--ww-text-muted)]">
                        <span>{contentTypeLabels[item.contentType]}</span>
                        <span>·</span>
                        <span>{sched?.inline ?? 'Plansız'}</span>
                        <span>·</span>
                        <span>{item.published ? 'Yayınlandı' : statusLabels[item.status]}</span>
                        {item.platforms.map((p) => (
                          <SocialPlatformIcon key={p.platform} platform={p.platform} size={10} />
                        ))}
                      </p>
                    </div>
                  );
                })
              )}
              <Link
                to={`/sosyal-medya/icerikler?brandId=${brandId}`}
                className="inline-flex h-8 items-center text-[12px] font-medium text-accent-strong hover:underline"
              >
                Tüm İçerikleri Gör
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['Toplam içerik', brand.stats?.contents ?? 0],
                  ['Planlandı', brand.stats?.planned ?? 0],
                  ['Yayınlandı', brand.stats?.published ?? 0],
                  ['Başarısız', brand.stats?.failed ?? 0],
                  ['Hashtag', brand.stats?.hashtags ?? 0],
                  ['Bağlı hesap', brand.stats?.accounts ?? 0],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-[6px] border border-[var(--ww-border)] px-2.5 py-2">
                  <p className="text-[10px] text-[var(--ww-text-muted)]">{label}</p>
                  <p className="text-[16px] font-medium tabular-nums text-[var(--ww-text)]">{value}</p>
                </div>
              ))}
              <p className="col-span-2 text-[11px] text-[var(--ww-text-muted)]">
                Meta insights (reach/engagement) bu sürümde yok.
              </p>
            </div>
          )}
        </div>

        {brand ? (
          <footer className="border-t border-[var(--ww-border)] px-4 py-2 text-[11px] text-[var(--ww-text-muted)]">
            Güncelleme {formatRelative(brand.updatedAt)}
          </footer>
        ) : null}
      </motion.aside>
    </AnimatePresence>
  );
}
