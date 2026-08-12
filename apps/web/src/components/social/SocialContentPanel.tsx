import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Copy, ExternalLink, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import type { SocialContentType, SocialPlatform, SocialPublicationStatus } from '@woonwork/shared';
import { PLATFORM_CONTENT_TYPES, hashtagKey, parseHashtagsFromText } from '@woonwork/shared';
import { Button, DateInput, FieldLabel, Select, SOCIAL_TEXTAREA_CLASS } from './SocialControls';
import { SOCIAL_BODY_STYLE } from '../../lib/socialControlTypography';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { MediaPickerModal } from '../media/MediaPickerModal';
import { ApiClientError } from '../../lib/api';
import {
  ALL_PLATFORMS,
  ALL_STATUSES,
  ALL_TYPES,
  accountLabel,
  attachMedia,
  contentTypeLabels,
  createContent,
  deleteContent,
  detachMedia,
  duplicateContent,
  fromLocalInput,
  getContent,
  listSocialAccounts,
  platformLabels,
  publicationStatusLabels,
  publishContent,
  reorderMedia,
  statusLabels,
  toLocalInput,
  updateContent,
  type SocialAccountDto,
  type SocialBrandDto,
  type SocialContentDto,
  type SocialDestinationDto,
} from '../../lib/social';
import { deleteMediaAsset, type MediaAssetDto } from '../../lib/media';
import {
  addDraftMediaPick,
  hasUnsavedNewDraftChanges,
  removeDraftMediaPick,
  reorderDraftMediaPicks,
  sessionUploadAssetIds,
  type DraftMediaPick,
} from '../../lib/socialContentDraft';
import { WorkflowRail, WorkflowStepRail, type WorkflowFlags } from './WorkflowDots';
import { PlatformMark } from './PlatformMark';
import { HashtagPicker } from './HashtagPicker';
import { fetchHashtags, type SocialHashtagDto } from '../../lib/socialHashtags';

const metaAccountsOnly = (a: SocialAccountDto) =>
  a.platform === 'INSTAGRAM' || a.platform === 'FACEBOOK';

export function SocialContentPanel({
  open,
  contentId,
  preset,
  brands,
  onClose,
  onSaved,
}: {
  open: boolean;
  contentId?: string | null;
  preset?: { scheduledAt?: string | null };
  brands: SocialBrandDto[];
  onClose: () => void;
  onSaved: (item: SocialContentDto) => void;
}) {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [item, setItem] = useState<SocialContentDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [contentText, setContentText] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [otherAccountsOpen, setOtherAccountsOpen] = useState(false);
  const [contentType, setContentType] = useState<SocialContentType>('POST');
  const [status, setStatus] = useState<SocialContentDto['status']>('DRAFT');
  const [brandId, setBrandId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
  const [accounts, setAccounts] = useState<SocialAccountDto[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [draftMedia, setDraftMedia] = useState<DraftMediaPick[]>([]);
  const [publishing, setPublishing] = useState(false);
  const savingRef = useRef(false);
  const [publishProgress, setPublishProgress] = useState<Record<string, SocialPublicationStatus>>({});
  const [libraryHashtags, setLibraryHashtags] = useState<SocialHashtagDto[]>([]);
  const [flags, setFlags] = useState<WorkflowFlags>({
    edited: false,
    approved: false,
    readyToPublish: false,
    published: false,
  });

  useEffect(() => {
    if (!open) return;
    void listSocialAccounts(true)
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, [open]);

  useEffect(() => {
    if (!open || !brandId) {
      setLibraryHashtags([]);
      return;
    }
    void fetchHashtags({ brandId, limit: 200 })
      .then((res) => setLibraryHashtags(res.items))
      .catch(() => setLibraryHashtags([]));
  }, [open, brandId]);

  useEffect(() => {
    if (!open) return;
    if (!contentId) {
      setItem(null);
      setTitle('');
      setContentText('');
      setInternalNotes('');
      setNotesOpen(false);
      setOtherAccountsOpen(false);
      setContentType('POST');
      setStatus('DRAFT');
      setBrandId(brands[0]?.id ?? '');
      setScheduledAt(toLocalInput(preset?.scheduledAt));
      setPlatforms([]);
      setAccountIds([]);
      setDraftMedia([]);
      setPublishProgress({});
      setFlags({ edited: false, approved: false, readyToPublish: false, published: false });
      return;
    }
    setLoading(true);
    void getContent(contentId)
      .then((data) => {
        setItem(data);
        setTitle(data.title);
        setContentText(data.contentText ?? '');
        setInternalNotes(data.internalNotes ?? '');
        setNotesOpen(Boolean(data.internalNotes));
        setContentType(data.contentType);
        setStatus(data.status);
        setBrandId(data.socialBrandId ?? '');
        setScheduledAt(toLocalInput(data.scheduledAt));
        setPlatforms(data.platforms.map((p) => p.platform));
        setAccountIds((data.destinations ?? []).map((d) => d.socialAccountId));
        setDraftMedia([]);
        setPublishProgress({});
        setFlags({
          edited: data.edited,
          approved: data.approved,
          readyToPublish: data.readyToPublish,
          published: data.published,
        });
      })
      .catch((err) => toast((err as Error).message || 'İçerik yüklenemedi', 'error'))
      .finally(() => setLoading(false));
  }, [open, contentId, brands, preset?.scheduledAt, toast]);

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => accountIds.includes(a.id)),
    [accounts, accountIds],
  );

  const derivedPlatforms = useMemo(() => {
    if (selectedAccounts.length) return [...new Set(selectedAccounts.map((a) => a.platform))];
    return platforms;
  }, [selectedAccounts, platforms]);

  const suggestedTypes = useMemo(() => {
    if (!derivedPlatforms.length) return ALL_TYPES;
    const set = new Set<SocialContentType>();
    derivedPlatforms.forEach((p) => PLATFORM_CONTENT_TYPES[p].forEach((t) => set.add(t)));
    return [...set];
  }, [derivedPlatforms]);

  const brandAccounts = useMemo(() => {
    const list = accounts.filter(metaAccountsOnly);
    if (!brandId) return { primary: list, other: [] as SocialAccountDto[] };
    const primary = list.filter((a) => a.socialBrandId === brandId);
    const other = list.filter((a) => a.socialBrandId !== brandId);
    return { primary, other };
  }, [accounts, brandId]);

  const defaultBrandId = brands[0]?.id ?? '';

  const hasDraftChanges = useMemo(
    () =>
      !item &&
      hasUnsavedNewDraftChanges({
        title,
        contentText,
        internalNotes,
        accountIds,
        draftMedia,
        platforms,
        scheduledAt,
        brandId,
        defaultBrandId,
        presetScheduledAt: preset?.scheduledAt,
      }),
    [
      item,
      title,
      contentText,
      internalNotes,
      accountIds,
      draftMedia,
      platforms,
      scheduledAt,
      brandId,
      defaultBrandId,
      preset?.scheduledAt,
    ],
  );

  const displayMedia = useMemo(() => {
    if (item) return item.media;
    return draftMedia.map((pick, index) => ({
      id: `draft-${pick.asset.id}`,
      mediaAssetId: pick.asset.id,
      position: (index + 1) * 1000,
      role: null as string | null,
      mediaAsset: {
        id: pick.asset.id,
        url: pick.asset.url,
        originalFileName: pick.asset.originalFileName,
        mimeType: pick.asset.mimeType,
        category: pick.asset.category,
        size: pick.asset.size,
      },
    }));
  }, [item, draftMedia]);

  const parsedHashtags = useMemo(() => parseHashtagsFromText(contentText), [contentText]);

  const blockedHashtagsInText = useMemo(() => {
    if (!parsedHashtags.length) return [];
    const blockedKeys = new Set(
      libraryHashtags.filter((row) => row.status === 'BLOCKED').map((row) => row.tagKey),
    );
    return parsedHashtags.filter((tag) => blockedKeys.has(hashtagKey(tag)));
  }, [parsedHashtags, libraryHashtags]);

  const publishBlockedReason = useMemo(() => {
    if (!item) return 'Yayınlamak için önce taslağı kaydedin.';
    if (contentType === 'STORY') return 'Hikâye yayını Meta entegrasyonunun sonraki sürümünde desteklenecek.';
    if (!flags.approved) return 'Yayınlamak için içeriğin onaylanmış ve yayına hazır olması gerekir.';
    if (!flags.readyToPublish) return 'Yayınlamak için içeriğin onaylanmış ve yayına hazır olması gerekir.';
    if (accounts.length && !accountIds.length) return 'Yayınlanacak hesap seçin.';
    if (!accounts.length && !platforms.length) return 'Yayınlanacak hesap bağlı değil.';
    if (derivedPlatforms.includes('INSTAGRAM') && !accounts.some((a) => a.platform === 'INSTAGRAM' && accountIds.includes(a.id))) {
      return 'Instagram hesabı bağlı değil.';
    }
    if (derivedPlatforms.includes('FACEBOOK') && !accounts.some((a) => a.platform === 'FACEBOOK' && accountIds.includes(a.id))) {
      return 'Facebook hesabı bağlı değil.';
    }
    return null;
  }, [item, contentType, flags.approved, flags.readyToPublish, accounts, accountIds, platforms, derivedPlatforms]);

  const saveStatusLabel = saving ? 'Kaydediliyor…' : item ? 'Kaydedildi' : 'Kaydedilmedi';

  const firstMedia = displayMedia[0];
  const previewExcerpt =
    contentText.trim().length > 140 ? `${contentText.trim().slice(0, 140)}…` : contentText.trim() || 'Metin yok';

  function toggleAccount(id: string, on: boolean) {
    setAccountIds((prev) => (on ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllBrandAccounts() {
    const ids = brandAccounts.primary.map((a) => a.id);
    setAccountIds((prev) => [...new Set([...prev, ...ids])]);
  }

  function requestClose() {
    if (hasDraftChanges) {
      setDiscardConfirmOpen(true);
      return;
    }
    onClose();
  }

  async function cleanupSessionUploads(picks: DraftMediaPick[]) {
    const ids = sessionUploadAssetIds(picks);
    await Promise.all(
      ids.map((id) =>
        deleteMediaAsset(id).catch(() => {
          /* best-effort */
        }),
      ),
    );
  }

  async function confirmDiscard() {
    const pending = draftMedia;
    setDiscardConfirmOpen(false);
    setDraftMedia([]);
    await cleanupSessionUploads(pending);
    onClose();
  }

  async function save(extra?: Record<string, unknown>) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const body = {
        title: title.trim() || 'Adsız içerik',
        contentText: contentText || null,
        internalNotes: internalNotes || null,
        contentType,
        status,
        socialBrandId: brandId || null,
        scheduledAt: fromLocalInput(scheduledAt),
        platforms: derivedPlatforms,
        accountIds: accountIds.length ? accountIds : undefined,
        edited: flags.edited,
        approved: flags.approved,
        readyToPublish: flags.readyToPublish,
        published: flags.published,
        ...extra,
      };
      let saved = item ? await updateContent(item.id, body) : await createContent(body);
      if (!item && draftMedia.length) {
        for (const pick of draftMedia) {
          saved = await attachMedia(saved.id, pick.asset.id);
        }
        setDraftMedia([]);
      }
      setItem(saved);
      onSaved(saved);
      toast(item ? 'İçerik kaydedildi' : 'Taslak kaydedildi.', 'success');
    } catch (err) {
      toast((err as Error).message || 'Kaydedilemedi', 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function handleDraftMediaSelect(asset: MediaAssetDto, uploadedInSession = false) {
    if (item) {
      void attachMedia(item.id, asset.id)
        .then((saved) => {
          setItem(saved);
          onSaved(saved);
        })
        .catch((err) => toast((err as Error).message || 'Medya eklenemedi', 'error'));
      return;
    }
    setDraftMedia((prev) => addDraftMediaPick(prev, asset, uploadedInSession));
  }

  function handleRemoveMedia(mediaId: string, assetId: string) {
    if (item) {
      void detachMedia(item.id, mediaId)
        .then((saved) => {
          setItem(saved);
          onSaved(saved);
        })
        .catch((err) => toast((err as Error).message, 'error'));
      return;
    }
    const removed = draftMedia.find((m) => m.asset.id === assetId);
    setDraftMedia((prev) => removeDraftMediaPick(prev, assetId));
    if (removed?.uploadedInSession) {
      void deleteMediaAsset(assetId).catch(() => {
        /* best-effort */
      });
    }
  }

  function handleReorderMedia(from: number, to: number) {
    if (!item) {
      setDraftMedia((prev) => reorderDraftMediaPicks(prev, from, to));
      return;
    }
    const ids = item.media.map((x) => x.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    void reorderMedia(item.id, ids)
      .then((saved) => {
        setItem(saved);
        onSaved(saved);
      })
      .catch((err) => toast((err as Error).message, 'error'));
  }

  async function toggleFlag(key: keyof WorkflowFlags, value: boolean) {
    const next = { ...flags, [key]: value };
    setFlags(next);
    if (!item) return;
    try {
      const saved = await updateContent(item.id, { [key]: value });
      setItem(saved);
      setFlags({
        edited: saved.edited,
        approved: saved.approved,
        readyToPublish: saved.readyToPublish,
        published: saved.published,
      });
      setStatus(saved.status);
      onSaved(saved);
    } catch (err) {
      setFlags(flags);
      toast((err as Error).message || 'İş akışı güncellenemedi', 'error');
    }
  }

  async function onDuplicate() {
    if (!item) return;
    try {
      const copy = await duplicateContent(item.id);
      toast('İçerik çoğaltıldı', 'success');
      onSaved(copy);
      onClose();
    } catch (err) {
      toast((err as Error).message || 'Çoğaltılamadı', 'error');
    }
  }

  async function runPublish(destinationIds?: string[]) {
    if (!item) return;
    setPublishing(true);
    const targets =
      destinationIds ??
      (item.destinations ?? [])
        .filter((d) => d.publicationStatus !== 'PUBLISHED')
        .map((d) => d.id);
    const nextProgress: Record<string, SocialPublicationStatus> = { ...publishProgress };
    targets.forEach((id) => {
      nextProgress[id] = 'PUBLISHING';
    });
    setPublishProgress(nextProgress);
    try {
      let latest = item;
      for (const destId of targets) {
        setPublishProgress((prev) => ({ ...prev, [destId]: 'PUBLISHING' }));
        const result = await publishContent(latest.id, [destId]);
        latest = result.content;
        setItem(result.content);
        onSaved(result.content);
        const row = result.results[0];
        if (row) {
          setPublishProgress((prev) => ({ ...prev, [destId]: row.status }));
          if (row.status === 'FAILED' && row.errorMessage) {
            toast(row.errorMessage, 'error');
          }
        }
      }
      if (latest.published) toast('İçerik yayınlandı', 'success');
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'SOCIAL_BLOCKED_HASHTAGS') {
        const blocked = Array.isArray((err.details as { blocked?: unknown } | undefined)?.blocked)
          ? ((err.details as { blocked: string[] }).blocked)
          : [];
        toast(
          blocked.length
            ? `İçerikte kullanılması engellenmiş hashtagler bulundu. ${blocked.join(' ')}`
            : 'İçerikte kullanılması engellenmiş hashtagler bulundu.',
          'error',
        );
      } else {
        toast((err as Error).message || 'Yayın başarısız', 'error');
      }
    } finally {
      setPublishing(false);
      setConfirmOpen(false);
    }
  }

  async function onDelete() {
    if (!item) return;
    if (!window.confirm(`“${item.title}” içeriğini silmek istiyor musunuz?`)) return;
    try {
      await deleteContent(item.id);
      toast('İçerik silindi', 'success');
      onSaved(item);
      onClose();
    } catch (err) {
      toast((err as Error).message || 'Silinemedi', 'error');
    }
  }

  const publishDisabled = saving || publishing || Boolean(publishBlockedReason) || !item;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Kapat"
            className="fixed inset-0 z-40 bg-ink-950/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={requestClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[720px] flex-col border-l border-[var(--ww-border)] bg-white shadow-[var(--ww-shadow-md)]"
            initial={reduceMotion ? false : { x: 40, opacity: 0.9 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { x: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-[var(--ww-border)] bg-white/95 px-4 py-2.5 backdrop-blur-sm">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold tracking-tight text-[var(--ww-text)]">
                  {item ? 'İçerik' : 'Yeni içerik'}
                </p>
                <div className="mt-0.5">
                  <WorkflowRail flags={flags} />
                </div>
              </div>
              <button
                type="button"
                onClick={requestClose}
                className="rounded-[6px] p-1.5 text-[var(--ww-text-muted)] hover:bg-ink-50 hover:text-[var(--ww-text)]"
              >
                <X size={16} />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {loading ? (
                <p className="text-[13px] text-[var(--ww-text-muted)]">Yükleniyor…</p>
              ) : (
                <>
                  {/* Title — primary */}
                  <label className="block">
                    <FieldLabel tone="editorial">Başlık</FieldLabel>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="İçerik başlığı"
                      className="mt-0.5 h-8 w-full border-0 border-b border-[var(--ww-border)] bg-transparent px-0 font-sans text-[13px] font-normal leading-[1.25] tracking-normal text-[var(--ww-text)] outline-none placeholder:text-[12px] placeholder:font-normal placeholder:leading-[1.25] placeholder:text-ink-300 focus:border-accent/45"
                      style={{ fontFamily: 'inherit' }}
                    />
                  </label>

                  {/* Metadata — secondary, drives account grouping */}
                  <section className="grid gap-x-3 gap-y-1 rounded-[7px] bg-[rgb(244_246_248/0.4)] px-2 py-1.5 sm:grid-cols-2">
                    <Select
                      label="Marka"
                      value={brandId}
                      onChange={(e) => {
                        setBrandId(e.target.value);
                        setOtherAccountsOpen(false);
                      }}
                    >
                      <option value="">Seçilmedi</option>
                      {(brands.filter((b) => b.isActive).length ? brands.filter((b) => b.isActive) : brands).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="İçerik tipi"
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value as SocialContentType)}
                    >
                      {(suggestedTypes.length ? suggestedTypes : ALL_TYPES).map((t) => (
                        <option key={t} value={t}>
                          {contentTypeLabels[t]}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="Durum"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as SocialContentDto['status'])}
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabels[s]}
                        </option>
                      ))}
                    </Select>
                    <label className="block space-y-0.5">
                      <FieldLabel tone="editorial">Yayın tarihi</FieldLabel>
                      <DateInput
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="w-full"
                      />
                    </label>
                  </section>

                  {/* Accounts — primary */}
                  <section className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel tone="editorial">Yayınlanacak hesaplar</FieldLabel>
                      {brandAccounts.primary.length > 1 ? (
                        <button
                          type="button"
                          onClick={selectAllBrandAccounts}
                          className="text-[12px] font-medium text-accent-strong/90 hover:text-accent-strong"
                        >
                          Tümünü seç
                        </button>
                      ) : null}
                    </div>

                    {accounts.filter(metaAccountsOnly).length ? (
                      <div className="space-y-1">
                        {brandAccounts.primary.map((account) => (
                          <AccountRow
                            key={account.id}
                            account={account}
                            selected={accountIds.includes(account.id)}
                            onToggle={() => toggleAccount(account.id, accountIds.includes(account.id))}
                          />
                        ))}
                        {brandId && brandAccounts.primary.length === 0 ? (
                          <p className="text-[12px] text-[var(--ww-text-muted)]">
                            Bu markaya bağlı hesap yok. Diğer hesaplardan seçebilir veya Hesaplar’dan marka
                            atayabilirsiniz.
                          </p>
                        ) : null}

                        {brandId && brandAccounts.other.length ? (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setOtherAccountsOpen((v) => !v)}
                              className="inline-flex h-7 items-center gap-1 text-[12px] text-[var(--ww-text-muted)] hover:text-[var(--ww-text-secondary)]"
                            >
                              <ChevronDown
                                size={14}
                                className={`transition ${otherAccountsOpen ? 'rotate-0' : '-rotate-90'}`}
                              />
                              Diğer hesaplar
                              <span className="text-ink-300">({brandAccounts.other.length})</span>
                            </button>
                            {otherAccountsOpen ? (
                              <div className="mt-1 space-y-1">
                                {brandAccounts.other.map((account) => (
                                  <AccountRow
                                    key={account.id}
                                    account={account}
                                    selected={accountIds.includes(account.id)}
                                    onToggle={() =>
                                      toggleAccount(account.id, accountIds.includes(account.id))
                                    }
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <p className="text-[12px] text-[var(--ww-text-muted)]">
                          Bağlı hesap yok. Önce Sosyal Medya → Hesaplar üzerinden Meta bağlayın. Geçici olarak
                          platform seçebilirsiniz.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {ALL_PLATFORMS.map((p) => {
                            const on = platforms.includes(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() =>
                                  setPlatforms((prev) =>
                                    on ? prev.filter((x) => x !== p) : [...prev, p],
                                  )
                                }
                                className={`inline-flex h-8 items-center gap-1.5 rounded-[6px] px-2 text-[12px] transition ${
                                  on
                                    ? 'bg-[rgb(67_97_238/0.1)] text-accent-strong ring-1 ring-accent/25'
                                    : 'text-[var(--ww-text-secondary)] ring-1 ring-[rgb(10_20_36/0.08)] hover:bg-ink-50'
                                }`}
                              >
                                <PlatformMark platform={p} />
                                {platformLabels[p]}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {contentType === 'STORY' ? (
                      <p className="text-[12px] text-[var(--ww-text-muted)]">
                        Hikâye yayını Meta entegrasyonunun sonraki sürümünde desteklenecek.
                      </p>
                    ) : null}
                  </section>

                  {/* Content — primary */}
                  <label className="block space-y-0.5">
                    <div className="flex items-center justify-between">
                      <FieldLabel tone="editorial">İçerik</FieldLabel>
                      <span className="text-[11px] text-[var(--ww-text-muted)]">
                        {contentText.length} karakter
                      </span>
                    </div>
                    <textarea
                      value={contentText}
                      onChange={(e) => setContentText(e.target.value)}
                      rows={7}
                      className={`${SOCIAL_TEXTAREA_CLASS} min-h-[140px] resize-y bg-[rgb(244_246_248/0.45)] focus:bg-white`}
                      placeholder="Paylaşım metnini yazın…"
                      style={{ ...SOCIAL_BODY_STYLE, lineHeight: 1.45 }}
                    />
                  </label>

                  <section className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <FieldLabel tone="editorial">Hashtagler</FieldLabel>
                      {brandId ? (
                        <HashtagPicker
                          items={libraryHashtags}
                          onInsert={(updater) => setContentText((prev) => updater(prev))}
                        />
                      ) : (
                        <span className="text-[11px] text-ink-400">Önce marka seçin</span>
                      )}
                    </div>
                    {parsedHashtags.length ? (
                      <div className="flex flex-wrap gap-1">
                        {parsedHashtags.map((tag) => {
                          const blocked = blockedHashtagsInText.includes(tag);
                          return (
                            <span
                              key={tag}
                              className={`inline-flex h-[20px] items-center rounded-[4px] px-1.5 text-[11px] font-medium ${
                                blocked ? 'bg-red-50/70 text-red-800/70' : 'bg-ink-50 text-ink-600'
                              }`}
                            >
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                    {blockedHashtagsInText.length ? (
                      <div className="rounded-[8px] border border-red-200/80 bg-red-50/50 px-3 py-2">
                        <p className="text-[12px] font-medium text-red-800/80">
                          Bu içerikte Blocklist’te bulunan {blockedHashtagsInText.length} hashtag var.
                        </p>
                        <p className="mt-1 text-[12px] text-red-700/75">{blockedHashtagsInText.join(' ')}</p>
                      </div>
                    ) : null}
                  </section>

                  {/* Media */}
                  <section className="space-y-1.5">
                    <FieldLabel tone="editorial">Medya</FieldLabel>
                    {!displayMedia.length ? (
                      <div className="flex items-center justify-between gap-3 rounded-[8px] border border-dashed border-[rgb(10_20_36/0.1)] bg-[rgb(244_246_248/0.35)] px-3 py-2.5">
                        <div>
                          <p className="text-[13px] text-[var(--ww-text-secondary)]">Görsel veya video ekleyin</p>
                          <p className="text-[11px] text-[var(--ww-text-muted)]">Kompakt medya şeridi</p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setPickerOpen(true)}
                        >
                          <Plus size={13} strokeWidth={1.75} />
                          Medya Ekle
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {displayMedia.map((m, index) => (
                            <div
                              key={m.id}
                              draggable
                              onDragStart={(e) => e.dataTransfer.setData('text/plain', String(index))}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const from = Number(e.dataTransfer.getData('text/plain'));
                                if (Number.isNaN(from) || from === index) return;
                                handleReorderMedia(from, index);
                              }}
                              className="group relative h-[72px] w-[72px] overflow-hidden rounded-[6px] ring-1 ring-[rgb(10_20_36/0.08)] bg-ink-50"
                            >
                              {m.mediaAsset.url && m.mediaAsset.category === 'IMAGE' ? (
                                <img
                                  src={m.mediaAsset.url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : m.mediaAsset.url && m.mediaAsset.category === 'VIDEO' ? (
                                <video
                                  src={m.mediaAsset.url}
                                  className="h-full w-full object-cover"
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                              ) : (
                                <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-[var(--ww-text-muted)]">
                                  {m.mediaAsset.originalFileName}
                                </span>
                              )}
                              <button
                                type="button"
                                className="absolute right-0.5 top-0.5 hidden rounded bg-white/90 p-0.5 text-danger group-hover:block"
                                onClick={() => handleRemoveMedia(m.id, m.mediaAsset.id)}
                                aria-label="Medyayı kaldır"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setPickerOpen(true)}
                            className="inline-flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-[6px] text-[11px] text-[var(--ww-text-muted)] ring-1 ring-dashed ring-[rgb(10_20_36/0.12)] hover:bg-ink-50 hover:text-[var(--ww-text-secondary)]"
                          >
                            <ImagePlus size={16} strokeWidth={1.6} />
                            Ekle
                          </button>
                        </div>
                        {contentType === 'CAROUSEL' ? (
                          <p className="text-[11px] text-[var(--ww-text-muted)]">
                            Sıralamak için sürükleyin.
                            {(displayMedia.length ?? 0) < 2 ? ' Carousel için birden fazla medya ekleyin.' : ''}
                          </p>
                        ) : null}
                      </div>
                    )}
                    {['VIDEO', 'REEL', 'SHORT'].includes(contentType) &&
                    !displayMedia.some((m) => m.mediaAsset.category === 'VIDEO') ? (
                      <p className="text-[11px] text-[var(--ww-text-muted)]">
                        Video içerik için en az bir video eklemeniz önerilir.
                      </p>
                    ) : null}
                  </section>

                  {/* Notes — collapsible */}
                  <section>
                    {notesOpen || internalNotes ? (
                      <label className="block space-y-0.5">
                        <div className="flex items-center justify-between">
                          <FieldLabel tone="editorial">Notlar</FieldLabel>
                          {!internalNotes ? (
                            <button
                              type="button"
                              className="text-[12px] text-[var(--ww-text-muted)] hover:text-[var(--ww-text-secondary)]"
                              onClick={() => setNotesOpen(false)}
                            >
                              Gizle
                            </button>
                          ) : null}
                        </div>
                        <textarea
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value)}
                          rows={2}
                          className={`${SOCIAL_TEXTAREA_CLASS} min-h-[64px] resize-y bg-transparent text-[var(--ww-text-secondary)]`}
                          placeholder="İç notlar"
                          style={{ ...SOCIAL_BODY_STYLE, lineHeight: 1.45 }}
                        />
                      </label>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setNotesOpen(true)}
                        className="inline-flex h-7 items-center gap-1 text-[12px] text-[var(--ww-text-muted)] hover:text-[var(--ww-text-secondary)]"
                      >
                        <Plus size={13} strokeWidth={1.75} />
                        Not ekle
                      </button>
                    )}
                  </section>

                  {item?.destinations?.length ? (
                    <div className="space-y-1.5 rounded-[8px] ring-1 ring-[rgb(10_20_36/0.07)] px-3 py-2.5">
                      <FieldLabel tone="editorial">Yayın durumu</FieldLabel>
                      <div className="space-y-1.5">
                        {item.destinations.map((dest) => (
                          <DestinationRow
                            key={dest.id}
                            dest={dest}
                            progress={publishProgress[dest.id]}
                            publishing={publishing}
                            onRetry={() => void runPublish([dest.id])}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Workflow */}
                  <section className="space-y-1.5">
                    <FieldLabel tone="editorial">İş akışı</FieldLabel>
                    <WorkflowStepRail flags={flags} onToggle={(k, v) => void toggleFlag(k, v)} />
                  </section>

                  {/* Preview */}
                  <section className="rounded-[8px] bg-[rgb(244_246_248/0.55)] px-3 py-2.5">
                    <FieldLabel tone="editorial">Önizleme</FieldLabel>
                    <div className="mt-2 flex gap-3">
                      {firstMedia?.mediaAsset.url && firstMedia.mediaAsset.category === 'IMAGE' ? (
                        <img
                          src={firstMedia.mediaAsset.url}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-[6px] object-cover ring-1 ring-[rgb(10_20_36/0.08)]"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[6px] bg-white text-[10px] text-[var(--ww-text-muted)] ring-1 ring-[rgb(10_20_36/0.06)]">
                          Medya yok
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1">
                          {derivedPlatforms.map((p) => (
                            <PlatformMark key={p} platform={p} />
                          ))}
                        </div>
                        <p className="truncate text-[13px] font-medium text-[var(--ww-text)]">
                          {title || 'Adsız içerik'}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[var(--ww-text-secondary)]">
                          {previewExcerpt}
                        </p>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </div>

            <footer className="sticky bottom-0 z-10 shrink-0 border-t border-[var(--ww-border)] bg-white/95 px-4 py-2.5 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] text-[var(--ww-text-muted)]">{saveStatusLabel}</p>
                  {item ? (
                    <div className="mt-0.5 flex gap-1">
                      <Button type="button" variant="ghost" onClick={() => void onDuplicate()}>
                        <Copy size={13} />
                        Çoğalt
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => void onDelete()}>
                        <Trash2 size={13} />
                        Sil
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {publishDisabled && publishBlockedReason ? (
                    <p className="max-w-[280px] text-right text-[11px] leading-snug text-[var(--ww-text-muted)]">
                      {publishBlockedReason}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-1.5">
                    <Button type="button" variant="ghost" onClick={requestClose}>
                      Kapat
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => void save()}
                    >
                      {saving ? 'Kaydediliyor…' : 'Taslağı Kaydet'}
                    </Button>
                    <Button
                      type="button"
                      disabled={publishDisabled}
                      title={publishBlockedReason ?? undefined}
                      onClick={() => {
                        if (!item) return;
                        void updateContent(item.id, {
                          platforms: derivedPlatforms,
                          accountIds: accountIds.length ? accountIds : undefined,
                          approved: flags.approved,
                          readyToPublish: flags.readyToPublish,
                        })
                          .then((saved) => {
                            setItem(saved);
                            onSaved(saved);
                            setConfirmOpen(true);
                          })
                          .catch((err) => toast((err as Error).message || 'Kaydedilemedi', 'error'));
                      }}
                    >
                      {publishing ? 'Yayınlanıyor…' : 'Şimdi Yayınla'}
                    </Button>
                  </div>
                </div>
              </div>
            </footer>
          </motion.aside>

          <Modal open={confirmOpen} onClose={() => !publishing && setConfirmOpen(false)} title="Şimdi Yayınla">
            <div className="space-y-4">
              {blockedHashtagsInText.length ? (
                <div className="rounded-[8px] border border-red-200/80 bg-red-50/50 px-3 py-2">
                  <p className="text-[13px] font-medium text-red-800/80">
                    İçerikte kullanılması engellenmiş hashtagler bulundu.
                  </p>
                  <p className="mt-1 text-[12px] text-red-700/75">{blockedHashtagsInText.join(' ')}</p>
                </div>
              ) : null}
              <p className="text-[13px] text-[var(--ww-text-secondary)]">
                {selectedAccounts.length || (item?.destinations?.length ?? 0)} hesaba yayınlanacak:
              </p>
              <ul className="space-y-1 text-[13px]">
                {(selectedAccounts.length
                  ? selectedAccounts
                  : (item?.destinations ?? []).map((d) => d.account).filter(Boolean)
                ).map((account) =>
                  account ? (
                    <li key={account.id}>
                      {account.platform === 'INSTAGRAM' ? 'Instagram' : 'Facebook'} · {accountLabel(account)}
                    </li>
                  ) : null,
                )}
              </ul>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" disabled={publishing} onClick={() => setConfirmOpen(false)}>
                  İptal
                </Button>
                <Button disabled={publishing} onClick={() => void runPublish()}>
                  {publishing ? 'Yayınlanıyor…' : 'Yayınla'}
                </Button>
              </div>
            </div>
          </Modal>

          <Modal
            open={discardConfirmOpen}
            onClose={() => setDiscardConfirmOpen(false)}
            title="Kaydedilmemiş değişiklikler"
          >
            <div className="space-y-4">
              <p className="text-[13px] text-[var(--ww-text-secondary)]">
                Kaydedilmemiş değişiklikler var. Çıkmak istediğinize emin misiniz?
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setDiscardConfirmOpen(false)}>
                  Devam Et
                </Button>
                <Button variant="danger" onClick={() => void confirmDiscard()}>
                  Vazgeç
                </Button>
              </div>
            </div>
          </Modal>

          <MediaPickerModal
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={(asset, meta) => {
              handleDraftMediaSelect(asset, meta?.uploaded === true);
            }}
          />
        </>
      ) : null}
    </AnimatePresence>
  );
}

function AccountRow({
  account,
  selected,
  onToggle,
}: {
  account: SocialAccountDto;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex h-8 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[12px] transition ${
        selected
          ? 'bg-[rgb(67_97_238/0.08)] text-[var(--ww-text)] ring-1 ring-accent/20'
          : 'text-[var(--ww-text-secondary)] ring-1 ring-[rgb(10_20_36/0.07)] hover:bg-ink-50/80'
      }`}
    >
      <input
        type="checkbox"
        className="accent-[var(--ww-accent)]"
        checked={selected}
        onChange={onToggle}
      />
      <PlatformMark platform={account.platform} />
      <span className="min-w-0 truncate">
        {account.platform === 'INSTAGRAM' ? 'Instagram' : 'Facebook'} · {accountLabel(account)}
      </span>
    </label>
  );
}

function DestinationRow({
  dest,
  progress,
  publishing,
  onRetry,
}: {
  dest: SocialDestinationDto;
  progress?: SocialPublicationStatus;
  publishing: boolean;
  onRetry: () => void;
}) {
  const status = progress ?? dest.publicationStatus;
  const label =
    status === 'PUBLISHING'
      ? dest.platform === 'INSTAGRAM'
        ? 'Medya hazırlanıyor… / Yayınlanıyor…'
        : 'Yayınlanıyor…'
      : publicationStatusLabels[status];
  const name = dest.account ? accountLabel(dest.account) : dest.platform;
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <PlatformMark platform={dest.platform} />
      <span className="min-w-0 flex-1 truncate">
        {dest.platform === 'INSTAGRAM' ? 'Instagram' : dest.platform === 'FACEBOOK' ? 'Facebook' : dest.platform} ·{' '}
        {name}
      </span>
      <span className="text-[var(--ww-text-muted)]">{label}</span>
      {dest.permalink ? (
        <a
          href={dest.permalink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-accent-strong hover:underline"
        >
          <ExternalLink size={12} />
          Gönderiyi Aç
        </a>
      ) : null}
      {status === 'FAILED' ? (
        <Button type="button" variant="ghost" disabled={publishing} onClick={onRetry}>
          Yeniden Dene
        </Button>
      ) : null}
    </div>
  );
}
