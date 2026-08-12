import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from './Form';

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
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
            className="absolute inset-0 bg-ink-950/45 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} overflow-hidden rounded-[var(--ww-radius-lg)] border border-[var(--ww-border)] bg-white shadow-[var(--ww-shadow-overlay)]`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex items-center justify-between border-b border-[var(--ww-border)] px-4 py-2.5">
              <h2 className="text-[14px] font-semibold tracking-tight text-[var(--ww-text)]">{title}</h2>
              <IconButton label="Kapat" onClick={onClose}>
                <X size={16} />
              </IconButton>
            </div>
            <div className="px-4 py-3">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
