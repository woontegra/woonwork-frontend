import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, LogOut, Plus, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fullName } from '../lib/labels';
import { IconButton } from '../components/ui/Form';
import { MobileMenuButton, useQuickCreateTargets } from './Sidebar';

export function Topbar({
  title,
  onOpenMobile,
  onOpenCommand,
  canvasDimmed,
}: {
  title: string;
  onOpenMobile: () => void;
  onOpenCommand: () => void;
  canvasDimmed?: boolean;
}) {
  const { user, logout } = useAuth();
  const [userOpen, setUserOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const createTargets = useQuickCreateTargets();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setUserOpen(false);
        setCreateOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 transition duration-[var(--ww-motion-normal)] ${
        canvasDimmed ? 'brightness-[0.97]' : ''
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
        <MobileMenuButton onClick={onOpenMobile} />

        {title ? (
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ww-text-muted)]">
              Çalışma Alanı
            </p>
            <p className="truncate text-sm font-semibold tracking-tight text-[var(--ww-text)]">
              {title}
            </p>
          </div>
        ) : (
          <div className="w-2 shrink-0" />
        )}

        <button
          type="button"
          onClick={onOpenCommand}
          className="mx-auto hidden max-w-xl flex-1 items-center gap-3 rounded-[var(--ww-radius-md)] border border-[var(--ww-border-strong)] bg-white/80 px-3.5 py-2 text-left text-sm text-[var(--ww-text-muted)] shadow-[var(--ww-shadow-sm)] transition hover:border-accent/30 hover:shadow-[0_0_0_3px_var(--ww-accent-soft)] md:flex"
        >
          <Search size={15} />
          <span className="flex-1">Ara veya komut çalıştır...</span>
          <kbd className="rounded border border-[var(--ww-border)] bg-ink-50 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ww-text-muted)]">
            Ctrl K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1.5" ref={menuRef}>
          <div className="relative">
            <IconButton label="Hızlı oluştur" onClick={() => setCreateOpen((v) => !v)}>
              <Plus size={18} />
            </IconButton>
            <AnimatePresence>
              {createOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-[var(--ww-radius-md)] border border-[var(--ww-border)] bg-white p-1 shadow-[var(--ww-shadow-float)]"
                >
                  {createTargets.map((item, i) => (
                    <motion.button
                      key={item.label}
                      type="button"
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => {
                        item.onSelect();
                        setCreateOpen(false);
                      }}
                      className="block w-full rounded-[6px] px-3 py-2 text-left text-sm text-[var(--ww-text)] hover:bg-accent-soft hover:text-accent-strong"
                    >
                      {item.label}
                    </motion.button>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <IconButton label="Bildirimler">
            <Bell size={17} />
          </IconButton>

          <div className="relative">
            <button
              type="button"
              onClick={() => setUserOpen((v) => !v)}
              className="flex items-center gap-2 rounded-[var(--ww-radius-md)] px-1.5 py-1 hover:bg-black/[0.03]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-ink-900 text-[11px] font-semibold text-white">
                {(user?.firstName?.[0] || 'U').toUpperCase()}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold text-[var(--ww-text)]">{fullName(user)}</p>
              </div>
            </button>

            <AnimatePresence>
              {userOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-[var(--ww-radius-md)] border border-[var(--ww-border)] bg-white shadow-[var(--ww-shadow-float)]"
                >
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-danger hover:bg-danger-soft"
                  >
                    <LogOut size={15} />
                    Çıkış Yap
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
