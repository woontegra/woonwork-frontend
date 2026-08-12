import { useEffect, useRef } from 'react';

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose, active]);
}

export function useRegisterCommit(
  registerCommit: (fn: (() => Promise<void>) | null) => void,
  isActive: boolean,
  commit: () => Promise<void>,
) {
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    if (!isActive) return;
    registerCommit(() => commitRef.current());
    return () => registerCommit(null);
  }, [isActive, registerCommit]);
}
