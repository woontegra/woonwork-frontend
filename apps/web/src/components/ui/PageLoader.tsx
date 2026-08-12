import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <motion.div
        className="h-8 w-8 rounded-full border-2 border-ink-200 border-t-accent"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      />
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[var(--ww-radius-md)] bg-ink-100/80 ${className}`}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center border border-dashed border-[var(--ww-border)] bg-white/40 px-5 py-8 text-center"
    >
      <div className="mb-3 h-px w-10 bg-accent/50" />
      <h3 className="text-sm font-semibold tracking-tight text-[var(--ww-text)]">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-[var(--ww-text-muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </motion.div>
  );
}

export {
  PageContext,
  PageContext as PageHeader,
  PageCanvas,
  PageToolbar,
  PageSection,
} from '../layout/PageCanvas';
export {
  PageSplit,
  PageTreeSplit,
  PageEditorSplit,
  PageSettingsSplit,
} from '../layout/PageCanvas';

