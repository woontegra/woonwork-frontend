import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Select } from '../../components/social/SocialControls';
import { Modal } from '../../components/ui/Modal';
import { PageToolbar } from '../../components/ui/PageLoader';
import { useToast } from '../../components/ui/Toast';
import { PlatformMark } from '../../components/social/PlatformMark';
import {
  META_OAUTH_STATUS_POLL_MAX_MS,
  META_OAUTH_STATUS_POLL_MS,
  isMetaOauthEventTrusted,
  logMetaOauthMessageDev,
  openCenteredPopup,
  parseMetaOauthMessage,
  trustedMetaOauthMessageOrigins,
  watchPopupClosed,
  type MetaOauthPopupPhase,
} from '../../lib/metaOauthPopup';
import {
  accountLabel,
  connectMetaAccounts,
  connectionStatusLabels,
  disconnectSocialAccount,
  fetchMetaDiscovery,
  fetchMetaOauthStatus,
  listSocialAccounts,
  startMetaOauth,
  updateSocialAccount,
  type MetaDiscoveryPage,
  type SocialAccountDto,
} from '../../lib/social';
import { useSocialWorkspace } from './SocialLayout';

type PagePick = {
  pageId: string;
  facebook: boolean;
  instagram: boolean;
};

export function SocialAccountsPage() {
  const { toast } = useToast();
  const { brands } = useSocialWorkspace();
  const [accounts, setAccounts] = useState<SocialAccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [discovery, setDiscovery] = useState<{ connectionId: string; pages: MetaDiscoveryPage[] } | null>(
    null,
  );
  const [picks, setPicks] = useState<Record<string, PagePick>>({});
  const [brandId, setBrandId] = useState('');
  const [brandTarget, setBrandTarget] = useState<SocialAccountDto | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [phase, setPhase] = useState<MetaOauthPopupPhase>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reconnectId, setReconnectId] = useState<string | null>(null);

  const popupRef = useRef<Window | null>(null);
  const stopWatchRef = useRef<(() => void) | null>(null);
  const stopPollRef = useRef<(() => void) | null>(null);
  const settledRef = useRef(false);
  const pollingActiveRef = useRef(false);

  async function reload() {
    setLoading(true);
    try {
      setAccounts(await listSocialAccounts());
    } catch (err) {
      toast((err as Error).message || 'Hesaplar yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearOauthTimers = useCallback(() => {
    stopWatchRef.current?.();
    stopWatchRef.current = null;
    stopPollRef.current?.();
    stopPollRef.current = null;
    pollingActiveRef.current = false;
  }, []);

  const clearPopupWatch = useCallback(() => {
    clearOauthTimers();
    popupRef.current = null;
  }, [clearOauthTimers]);

  const loadDiscovery = useCallback(
    async (connectionId: string) => {
      const data = await fetchMetaDiscovery(connectionId);
      setDiscovery({ connectionId: data.connectionId, pages: data.pages });
      const next: Record<string, PagePick> = {};
      data.pages.forEach((page) => {
        next[page.pageId] = {
          pageId: page.pageId,
          facebook: true,
          instagram: Boolean(page.instagram),
        };
      });
      setPicks(next);
      setPhase('SELECT_ACCOUNTS');
      await reload();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const settleOauthSuccess = useCallback(
    (connectionId: string) => {
      settledRef.current = true;
      const popup = popupRef.current;
      clearPopupWatch();
      try {
        popup?.close();
      } catch {
        /* ignore */
      }
      setPhase('SUCCESS');
      setErrorMessage(null);
      void loadDiscovery(connectionId).catch((err) => {
        setPhase('ERROR');
        setErrorMessage((err as Error).message || 'Hesaplar keşfedilemedi');
      });
    },
    [clearPopupWatch, loadDiscovery],
  );

  useEffect(() => {
    if (!modalOpen) return;

    const allowed = trustedMetaOauthMessageOrigins();
    const onMessage = (event: MessageEvent) => {
      const trusted = isMetaOauthEventTrusted(event, allowed);
      const message = trusted ? parseMetaOauthMessage(event.data) : null;
      logMetaOauthMessageDev(event, message);
      if (!trusted || !message) return;

      if (message.type === 'WOONWORK_META_OAUTH_SUCCESS') {
        settleOauthSuccess(message.connectionId);
        return;
      }

      settledRef.current = true;
      clearPopupWatch();
      setPhase('ERROR');
      setErrorMessage(
        message.error === 'OAUTH_STATE_EXPIRED'
          ? 'Yetkilendirme süresi doldu. Tekrar deneyin.'
          : 'Meta bağlantısı tamamlanamadı. Tekrar deneyin.',
      );
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [modalOpen, clearPopupWatch, settleOauthSuccess]);

  const metaAccounts = useMemo(
    () => accounts.filter((a) => a.platform === 'FACEBOOK' || a.platform === 'INSTAGRAM'),
    [accounts],
  );

  function openConnectModal(reconnectConnectionId?: string) {
    settledRef.current = false;
    clearPopupWatch();
    setReconnectId(reconnectConnectionId ?? null);
    setDiscovery(null);
    setErrorMessage(null);
    setPhase('IDLE');
    setModalOpen(true);
  }

  function closeConnectModal() {
    settledRef.current = true;
    clearPopupWatch();
    setModalOpen(false);
    setPhase('IDLE');
    setErrorMessage(null);
    setReconnectId(null);
  }

  async function launchFacebookPopup() {
    setErrorMessage(null);
    settledRef.current = false;
    pollingActiveRef.current = false;

    // Open synchronously in the click stack to avoid popup blockers, then navigate.
    const popup = openCenteredPopup('about:blank');
    if (!popup) {
      setPhase('ERROR');
      setErrorMessage(
        'Tarayıcı Facebook bağlantı penceresini engelledi. Pop-up izni verip tekrar deneyin.',
      );
      return;
    }

    popupRef.current = popup;
    setPhase('AUTHORIZING');
    clearOauthTimers();
    // While status polling is active, do not treat popup.closed as failure —
    // COOP quirks can report closed=true while the window is still visible,
    // and postMessage / polling may still succeed.
    stopWatchRef.current = watchPopupClosed(
      popup,
      () => {
        if (settledRef.current) return;
        if (pollingActiveRef.current) return;
        settledRef.current = true;
        setPhase('POPUP_CLOSED');
        setErrorMessage('Facebook bağlantı penceresi kapatıldı.');
        clearPopupWatch();
      },
      500,
      2500,
    );

    try {
      const started = await startMetaOauth(reconnectId);
      if (settledRef.current) return;
      popup.location.href = started.authorizationUrl;

      // Fallback: poll OAuth session status (postMessage remains primary).
      pollingActiveRef.current = true;
      const pollStartedAt = Date.now();
      const pollTimer = window.setInterval(() => {
        void (async () => {
          if (settledRef.current) {
            window.clearInterval(pollTimer);
            pollingActiveRef.current = false;
            return;
          }
          if (Date.now() - pollStartedAt > META_OAUTH_STATUS_POLL_MAX_MS) {
            window.clearInterval(pollTimer);
            pollingActiveRef.current = false;
            if (settledRef.current) return;
            settledRef.current = true;
            clearPopupWatch();
            setPhase('ERROR');
            setErrorMessage('Yetkilendirme zaman aşımına uğradı. Tekrar deneyin.');
            return;
          }
          try {
            const status = await fetchMetaOauthStatus(started.sessionId);
            if (settledRef.current) return;
            if (status.status === 'SUCCESS') {
              window.clearInterval(pollTimer);
              pollingActiveRef.current = false;
              settleOauthSuccess(status.connectionId);
              return;
            }
            if (status.status === 'FAILED') {
              window.clearInterval(pollTimer);
              pollingActiveRef.current = false;
              settledRef.current = true;
              clearPopupWatch();
              setPhase('ERROR');
              setErrorMessage(
                status.error === 'OAUTH_STATE_EXPIRED'
                  ? 'Yetkilendirme süresi doldu. Tekrar deneyin.'
                  : 'Meta bağlantısı tamamlanamadı. Tekrar deneyin.',
              );
              return;
            }
            if (status.status === 'EXPIRED') {
              window.clearInterval(pollTimer);
              pollingActiveRef.current = false;
              settledRef.current = true;
              clearPopupWatch();
              setPhase('ERROR');
              setErrorMessage('Yetkilendirme süresi doldu. Tekrar deneyin.');
            }
          } catch {
            /* transient network — keep polling */
          }
        })();
      }, META_OAUTH_STATUS_POLL_MS);
      stopPollRef.current = () => {
        window.clearInterval(pollTimer);
        pollingActiveRef.current = false;
      };
    } catch (err) {
      settledRef.current = true;
      clearPopupWatch();
      try {
        popup.close();
      } catch {
        /* ignore */
      }
      setPhase('ERROR');
      setErrorMessage((err as Error).message || 'Meta OAuth başlatılamadı');
    }
  }

  async function submitDiscovery() {
    if (!discovery) return;
    const pages = Object.values(picks).filter((p) => p.facebook || p.instagram);
    if (!pages.length) {
      toast('En az bir hesap seçin', 'error');
      return;
    }
    setConnecting(true);
    try {
      await connectMetaAccounts({
        connectionId: discovery.connectionId,
        socialBrandId: brandId || null,
        pages: pages.map((p) => ({
          pageId: p.pageId,
          connectFacebook: p.facebook,
          connectInstagram: p.instagram,
        })),
      });
      toast('Hesaplar WoonWork’a bağlandı', 'success');
      setDiscovery(null);
      closeConnectModal();
      await reload();
    } catch (err) {
      toast((err as Error).message || 'Hesaplar bağlanamadı', 'error');
    } finally {
      setConnecting(false);
    }
  }

  async function onDisconnect(account: SocialAccountDto) {
    try {
      await disconnectSocialAccount(account.id);
      toast('Bağlantı kesildi', 'success');
      await reload();
    } catch (err) {
      toast((err as Error).message || 'Kesilemedi', 'error');
    }
  }

  async function saveBrand() {
    if (!brandTarget) return;
    try {
      await updateSocialAccount(brandTarget.id, { socialBrandId: brandId || null });
      toast('Marka güncellendi', 'success');
      setBrandTarget(null);
      await reload();
    } catch (err) {
      toast((err as Error).message || 'Marka güncellenemedi', 'error');
    }
  }

  return (
    <>
      <PageToolbar>
        <Button className="ml-auto" onClick={() => openConnectModal()}>
          Meta Hesabı Bağla
        </Button>
      </PageToolbar>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ww-text-muted)]">
          META
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--ww-text-muted)]">Yükleniyor…</p>
        ) : !metaAccounts.length ? (
          <p className="text-[13px] text-[var(--ww-text-muted)]">Henüz bağlı hesap yok.</p>
        ) : (
          <div className="divide-y divide-[var(--ww-border)] border border-[var(--ww-border)] bg-white">
            {metaAccounts.map((account) => (
              <div key={account.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <PlatformMark platform={account.platform} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{accountLabel(account)}</p>
                  <p className="text-[11px] text-[var(--ww-text-muted)]">
                    {connectionStatusLabels[account.connectionStatus]}
                    {account.brand ? ` · ${account.brand.name}` : ''}
                    {!account.isActive ? ' · Pasif' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setBrandTarget(account);
                      setBrandId(account.socialBrandId ?? '');
                    }}
                  >
                    Markayı Değiştir
                  </Button>
                  {(account.connectionStatus === 'EXPIRED' ||
                    account.connectionStatus === 'REVOKED' ||
                    account.connectionStatus === 'ERROR' ||
                    !account.isActive) && (
                    <Button
                      variant="secondary"
                      onClick={() => openConnectModal(account.socialConnectionId)}
                    >
                      Bağlantıyı Yenile
                    </Button>
                  )}
                  {account.isActive ? (
                    <Button variant="ghost" onClick={() => void onDisconnect(account)}>
                      Bağlantıyı Kes
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={modalOpen}
        onClose={() => {
          if (phase === 'AUTHORIZING') return;
          closeConnectModal();
        }}
        title="Meta Hesabını Bağla"
        wide={phase === 'SELECT_ACCOUNTS'}
      >
        <div className="space-y-3">
          {phase === 'IDLE' ? (
            <>
              <p className="text-[13px] leading-relaxed text-[var(--ww-text-secondary)]">
                Meta hesabınıza bağlanmak için Facebook yetkilendirmesi açılacak.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={closeConnectModal}>
                  İptal
                </Button>
                <Button onClick={() => void launchFacebookPopup()}>Facebook ile Devam Et</Button>
              </div>
            </>
          ) : null}

          {phase === 'AUTHORIZING' ? (
            <div className="flex items-center gap-3 py-2">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-200 border-t-ink-900"
                aria-hidden
              />
              <p className="text-[13px] text-[var(--ww-text-secondary)]">
                Facebook’ta yetkilendirme bekleniyor…
              </p>
            </div>
          ) : null}

          {phase === 'SUCCESS' ? (
            <div className="space-y-2 py-1">
              <p className="text-[13px] font-medium text-[var(--ww-text)]">✓ Meta bağlantısı başarılı</p>
              <p className="text-[12px] text-[var(--ww-text-muted)]">Hesaplar yükleniyor…</p>
            </div>
          ) : null}

          {phase === 'ERROR' || phase === 'POPUP_CLOSED' ? (
            <>
              <p className="text-[13px] text-[var(--ww-text-secondary)]">
                {errorMessage || 'Bağlantı tamamlanamadı.'}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={closeConnectModal}>
                  Kapat
                </Button>
                <Button
                  onClick={() => {
                    setPhase('IDLE');
                    setErrorMessage(null);
                    settledRef.current = false;
                  }}
                >
                  Yeniden Dene
                </Button>
              </div>
            </>
          ) : null}

          {phase === 'SELECT_ACCOUNTS' && discovery ? (
            <>
              <div>
                <p className="text-[13px] font-medium text-[var(--ww-text)]">Meta hesabı bağlandı</p>
                <p className="mt-1 text-[12px] text-[var(--ww-text-muted)]">Kullanılabilir hesaplar</p>
              </div>
              <div className="divide-y divide-[var(--ww-border)] border border-[var(--ww-border)]">
                {discovery.pages.map((page) => {
                  const pick = picks[page.pageId];
                  return (
                    <div key={page.pageId} className="space-y-2 px-3 py-3">
                      <p className="text-[13px] font-medium">{page.name}</p>
                      <label className="flex items-center gap-2 text-[12px]">
                        <input
                          type="checkbox"
                          checked={Boolean(pick?.facebook)}
                          onChange={(e) =>
                            setPicks((prev) => ({
                              ...prev,
                              [page.pageId]: {
                                pageId: page.pageId,
                                facebook: e.target.checked,
                                instagram: prev[page.pageId]?.instagram ?? false,
                              },
                            }))
                          }
                        />
                        Facebook · {page.name}
                      </label>
                      {page.instagram ? (
                        <label className="flex items-center gap-2 text-[12px]">
                          <input
                            type="checkbox"
                            checked={Boolean(pick?.instagram)}
                            onChange={(e) =>
                              setPicks((prev) => ({
                                ...prev,
                                [page.pageId]: {
                                  pageId: page.pageId,
                                  facebook: prev[page.pageId]?.facebook ?? false,
                                  instagram: e.target.checked,
                                },
                              }))
                            }
                          />
                          Instagram · @{page.instagram.username || page.instagram.name}
                        </label>
                      ) : (
                        <p className="text-[11px] text-[var(--ww-text-muted)]">
                          {page.instagramUnlinkedReason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <Select label="Marka" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                <option value="">Seçilmedi</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={closeConnectModal}>
                  Vazgeç
                </Button>
                <Button disabled={connecting} onClick={() => void submitDiscovery()}>
                  {connecting ? 'Bağlanıyor…' : 'Hesapları Bağla'}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      <Modal open={Boolean(brandTarget)} onClose={() => setBrandTarget(null)} title="Markayı Değiştir">
        <div className="space-y-3">
          <Select label="Marka" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Seçilmedi</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBrandTarget(null)}>
              İptal
            </Button>
            <Button onClick={() => void saveBrand()}>Kaydet</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
