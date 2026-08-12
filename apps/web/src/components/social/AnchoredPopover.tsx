import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  computeAnchoredPosition,
  TABLE_FLOATING_Z,
  type PopoverAlign,
} from '../../lib/anchoredPopover';

export function AnchoredPopover({
  open,
  anchorRef,
  onClose,
  align = 'start',
  width,
  zIndex = TABLE_FLOATING_Z,
  className = '',
  children,
  closeOnOutside = true,
  closeOnEscape = true,
  closeOnScroll = false,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  align?: PopoverAlign;
  width?: number;
  zIndex?: number;
  className?: string;
  children: ReactNode;
  closeOnOutside?: boolean;
  closeOnEscape?: boolean;
  closeOnScroll?: boolean;
}) {
  const floatingRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    const floating = floatingRef.current;
    if (!anchor || !floating) return;
    const a = anchor.getBoundingClientRect();
    const f = floating.getBoundingClientRect();
    const next = computeAnchoredPosition({
      anchor: a,
      width: width ?? (f.width || 160),
      height: f.height || 80,
      align,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    setPos((prev) => (prev.top === next.top && prev.left === next.left ? prev : next));
  }, [align, anchorRef, width]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    const el = floatingRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, update]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => {
      if (closeOnScroll) onClose();
      else update();
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, update, closeOnScroll, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (closeOnEscape && e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    function onDown(e: MouseEvent) {
      if (!closeOnOutside) return;
      const t = e.target as Node;
      if (floatingRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose, closeOnOutside, closeOnEscape, anchorRef]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={floatingRef}
      role="dialog"
      className={`rounded-[var(--ww-control-radius)] border border-[var(--ww-border)] bg-white shadow-[var(--ww-shadow-sm)] ${className}`}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: width ?? undefined,
        zIndex,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
