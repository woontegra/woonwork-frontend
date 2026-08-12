import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { PageCanvas, PageHeader } from '../../components/ui/PageLoader';
import { SocialContentPanel } from '../../components/social/SocialContentPanel';
import { listBrands, type SocialBrandDto } from '../../lib/social';

type ComposerState = {
  open: boolean;
  contentId?: string | null;
  scheduledAt?: string | null;
};

const SocialWorkspaceContext = createContext<{
  brands: SocialBrandDto[];
  reloadBrands: () => void;
  openComposer: (opts?: { contentId?: string | null; scheduledAt?: string | null }) => void;
  bump: number;
} | null>(null);

export function useSocialWorkspace() {
  const ctx = useContext(SocialWorkspaceContext);
  if (!ctx) throw new Error('Social workspace missing');
  return ctx;
}

const NAV = [
  { to: '/sosyal-medya', label: 'Genel Bakış', end: true },
  { to: '/sosyal-medya/icerikler', label: 'İçerikler' },
  { to: '/sosyal-medya/takvim', label: 'Takvim' },
  { to: '/sosyal-medya/markalar', label: 'Markalar' },
  { to: '/sosyal-medya/hesaplar', label: 'Hesaplar' },
  { to: '/sosyal-medya/hashtagler', label: 'Hashtagler' },
];

export function SocialLayout() {
  const location = useLocation();
  const isContents = location.pathname.includes('/icerikler');
  const [brands, setBrands] = useState<SocialBrandDto[]>([]);
  const [composer, setComposer] = useState<ComposerState>({ open: false });
  const [bump, setBump] = useState(0);

  const reloadBrands = useCallback(() => {
    void listBrands().then(setBrands).catch(() => setBrands([]));
  }, []);

  useEffect(() => {
    reloadBrands();
  }, [reloadBrands]);

  const openComposer = useCallback(
    (opts?: { contentId?: string | null; scheduledAt?: string | null }) => {
      setComposer({
        open: true,
        contentId: opts?.contentId ?? null,
        scheduledAt: opts?.scheduledAt ?? null,
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ brands, reloadBrands, openComposer, bump }),
    [brands, reloadBrands, openComposer, bump],
  );

  return (
    <SocialWorkspaceContext.Provider value={value}>
      <PageCanvas mode="WORKSPACE_WIDE" className={isContents ? 'ww-contents-canvas' : ''}>
        {isContents ? null : (
          <PageHeader
            hideTitle
            description="İçeriklerinizi hazırlayın, onaylayın ve yayın planınızı yönetin."
          />
        )}
        <nav className={`flex flex-wrap gap-1 ${isContents ? 'ww-contents-tabs' : ''}`}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `inline-flex h-8 items-center rounded-[var(--ww-control-radius)] px-2.5 text-[12px] font-medium ${
                  isActive
                    ? 'bg-ink-950 text-white'
                    : 'text-[var(--ww-text-secondary)] hover:bg-ink-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </PageCanvas>
      <SocialContentPanel
        open={composer.open}
        contentId={composer.contentId}
        preset={{ scheduledAt: composer.scheduledAt }}
        brands={brands}
        onClose={() => setComposer({ open: false })}
        onSaved={() => {
          setBump((n) => n + 1);
          reloadBrands();
        }}
      />
    </SocialWorkspaceContext.Provider>
  );
}
