import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { roleLabels } from '../lib/labels';
import { formatBytes, getMediaUsage, type MediaUsageDto } from '../lib/media';
import { useToast } from '../components/ui/Toast';
import { PageCanvas, PageContext, PageSettingsSplit } from '../components/ui/PageLoader';

const tabs = ['Genel', 'Çalışma Alanı', 'Üyeler', 'Depolama', 'Güvenlik'] as const;

export function SettingsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Genel');
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  const { toast } = useToast();
  const [usage, setUsage] = useState<MediaUsageDto | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'Depolama' || !activeTenant) return;
    setUsageLoading(true);
    void getMediaUsage()
      .then(setUsage)
      .catch((err) => toast((err as Error).message || 'Kullanım alınamadı', 'error'))
      .finally(() => setUsageLoading(false));
  }, [tab, activeTenant, toast]);

  return (
    <PageCanvas mode="WORKSPACE_WIDE">
      <PageContext hideTitle description="Çalışma alanı ve hesap tercihleri" />

      <PageSettingsSplit
        nav={
          <aside className="space-y-0.5 border border-[var(--ww-border)] bg-white p-2">
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`relative flex w-full items-center rounded-[6px] px-3 py-2 text-left text-sm transition ${
                  tab === item
                    ? 'bg-accent-soft font-semibold text-accent-strong'
                    : 'text-[var(--ww-text-secondary)] hover:bg-ink-50'
                }`}
              >
                {tab === item ? (
                  <motion.span
                    layoutId="ww-settings-rail"
                    className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-accent"
                  />
                ) : null}
                {item}
              </button>
            ))}
          </aside>
        }
        content={
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-[var(--ww-border)] bg-white p-5"
          >
            <div className="w-full max-w-[720px]">
              {tab === 'Genel' ? (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-[var(--ww-text)]">Genel</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Info
                      label="Ad Soyad"
                      value={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`}
                    />
                    <Info label="E-posta" value={user?.email ?? '—'} />
                  </div>
                </div>
              ) : null}

              {tab === 'Çalışma Alanı' ? (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-[var(--ww-text)]">Çalışma Alanı</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Info label="Ad" value={activeTenant?.name ?? '—'} />
                    <Info label="Slug" value={activeTenant?.slug ?? '—'} />
                    <Info
                      label="Rolünüz"
                      value={roleLabels[activeTenant?.role ?? ''] ?? activeTenant?.role ?? '—'}
                    />
                  </div>
                </div>
              ) : null}

              {tab === 'Üyeler' ? (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-[var(--ww-text)]">Üyeler</h2>
                  <p className="text-sm text-[var(--ww-text-muted)]">
                    Üye yönetimi için Ekip sayfasını kullanın. Davet sistemi sonraki aşamada
                    eklenecek.
                  </p>
                </div>
              ) : null}

              {tab === 'Depolama' ? (
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-[var(--ww-text)]">Depolama</h2>
                  {usageLoading ? (
                    <p className="text-sm text-[var(--ww-text-muted)]">Kullanım hesaplanıyor...</p>
                  ) : (
                    <>
                      <div className="border border-[var(--ww-border)] bg-canvas/70 p-4">
                        <p className="text-xs uppercase tracking-[0.1em] text-[var(--ww-text-muted)]">
                          Kullanılan Alan
                        </p>
                        <p className="mt-1 text-3xl font-semibold tracking-tight text-[var(--ww-text)]">
                          {formatBytes(usage?.totalBytes ?? 0)}
                        </p>
                        <p className="mt-2 text-xs text-[var(--ww-text-muted)]">
                          {usage?.assetCount ?? 0} medya dosyası
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Info label="Görseller" value={formatBytes(usage?.imageBytes ?? 0)} />
                        <Info label="Videolar" value={formatBytes(usage?.videoBytes ?? 0)} />
                        <Info label="Belgeler" value={formatBytes(usage?.documentBytes ?? 0)} />
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {tab === 'Güvenlik' ? (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-[var(--ww-text)]">Güvenlik</h2>
                  <p className="text-sm text-[var(--ww-text-muted)]">
                    Oturumlar JWT + refresh token ile korunur. Şifre değiştirme ve oturum yönetimi
                    sonraki aşamada eklenecek.
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        }
      />
    </PageCanvas>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--ww-border)] bg-canvas/50 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ww-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--ww-text)]">{value}</p>
    </div>
  );
}
