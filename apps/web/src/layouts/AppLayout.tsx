import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from '../components/ui/CommandPalette';
import { OPEN_COMMAND } from '../lib/workspace';

const titles: Record<string, string> = {
  '/': 'Bugün',
  '/kutuphane': 'Kütüphane',
  '/projeler': 'Projeler',
  '/gorevler': 'Görevler',
  '/takvim': 'Takvim',
  '/notlar': 'Notlar & Belgeler',
  '/tablolar': 'Akıllı Tablolar',
  '/medya': 'Medya Kütüphanesi',
  '/sosyal-medya': 'Sosyal Medya',
  '/ekip': 'Ekip',
  '/ayarlar': 'Ayarlar',
};

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const location = useLocation();

  const title = useMemo(() => {
    if (location.pathname.startsWith('/notlar/')) return '';
    if (location.pathname.startsWith('/tablolar/')) return '';
    if (location.pathname.startsWith('/projeler/')) return '';
    if (location.pathname.startsWith('/alanlar/')) return '';
    if (location.pathname.startsWith('/sosyal-medya')) return 'Sosyal Medya';
    return titles[location.pathname] ?? 'WoonWork';
  }, [location.pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    }
    function onOpenCommand() {
      setCommandOpen(true);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_COMMAND, onOpenCommand);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_COMMAND, onOpenCommand);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col ww-canvas">
        <Topbar
          title={title}
          onOpenMobile={() => setMobileOpen(true)}
          onOpenCommand={() => setCommandOpen(true)}
          canvasDimmed={commandOpen}
        />
        <main className="flex-1 px-[var(--ww-page-pad-x)] pb-8 pt-2 lg:px-[var(--ww-page-pad-x-lg)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname.startsWith('/sosyal-medya') ? '/sosyal-medya' : location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="mx-0 w-full min-w-0 max-w-none"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
