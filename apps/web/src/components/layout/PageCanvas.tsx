import type { ReactNode } from 'react';

export type PageMode = 'DATA_WIDE' | 'WORKSPACE_WIDE' | 'EDITOR_FOCUS';

/**
 * Shared page canvas — always full available width after sidebar.
 * Modes only change internal rhythm/grid helpers, never shrink to a centered column.
 */
export function PageCanvas({
  children,
  mode = 'DATA_WIDE',
  className = '',
}: {
  children: ReactNode;
  mode?: PageMode;
  className?: string;
}) {
  return (
    <div
      data-page-mode={mode}
      className={`ww-page-canvas flex w-full min-w-0 flex-col gap-[var(--ww-page-gap)] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageContext({
  title,
  description,
  actions,
  hideTitle,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  /** When topbar already shows the page name, hide duplicate H1 */
  hideTitle?: boolean;
}) {
  if (!title && !description && !actions) return null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {title && !hideTitle ? (
          <h1 className="truncate text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--ww-text)]">
            {title}
          </h1>
        ) : null}
        {description ? (
          <p
            className={`text-sm text-[var(--ww-text-muted)] ${title && !hideTitle ? 'mt-1' : ''}`}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>
      ) : null}
    </div>
  );
}

export function PageToolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex w-full min-w-0 flex-wrap items-center gap-2.5 ${className}`}>
      {children}
    </div>
  );
}

export function PageSection({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`w-full min-w-0 ${className}`}>{children}</section>;
}

/** Workspace: ~68% main + ~32% rail on xl+ */
export function PageSplit({
  main,
  rail,
}: {
  main: ReactNode;
  rail: ReactNode;
}) {
  return (
    <div className="grid w-full min-w-0 gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(280px,0.9fr)]">
      <div className="min-w-0">{main}</div>
      <aside className="min-w-0">{rail}</aside>
    </div>
  );
}

/** Notes list: fixed tree rail + fluid workspace */
export function PageTreeSplit({
  tree,
  content,
}: {
  tree: ReactNode;
  content: ReactNode;
}) {
  return (
    <div className="grid w-full min-w-0 gap-4 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]">
      <aside className="min-w-0">{tree}</aside>
      <div className="min-w-0">{content}</div>
    </div>
  );
}

/** Editor: readable column (~760–980px) left-aligned; optional future rail uses remaining width */
export function PageEditorSplit({
  editor,
  rail,
}: {
  editor: ReactNode;
  rail?: ReactNode;
}) {
  return (
    <div
      className={`grid w-full min-w-0 gap-4 ${
        rail
          ? 'xl:grid-cols-[minmax(0,980px)_minmax(240px,1fr)]'
          : 'xl:grid-cols-[minmax(0,980px)_minmax(0,1fr)]'
      }`}
    >
      <div className="w-full min-w-0 max-w-[980px]">{editor}</div>
      {rail ? (
        <aside className="min-w-0">{rail}</aside>
      ) : (
        <div className="hidden min-w-0 xl:block" aria-hidden />
      )}
    </div>
  );
}

/** Settings: nav + content, form fields can be narrower inside content */
export function PageSettingsSplit({
  nav,
  content,
}: {
  nav: ReactNode;
  content: ReactNode;
}) {
  return (
    <div className="grid w-full min-w-0 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="min-w-0">{nav}</aside>
      <div className="min-w-0">{content}</div>
    </div>
  );
}

/** @deprecated use PageContext */
export const PageHeader = PageContext;
