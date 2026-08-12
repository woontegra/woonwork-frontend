import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ContentResourceType, SharePermission } from '@woonwork/shared';
import { Button, Select } from '../ui/Form';
import { useToast } from '../ui/Toast';
import { useTenant } from '../../contexts/TenantContext';
import { fullName } from '../../lib/labels';
import {
  createShare,
  deleteShare,
  listShares,
  updateShare,
  type ContentShareDto,
} from '../../lib/library';
import { listTenantMembers, type TenantMemberOption } from '../../lib/database';

export function SharePanel({
  open,
  onClose,
  resourceType,
  resourceId,
  areaName,
}: {
  open: boolean;
  onClose: () => void;
  resourceType: ContentResourceType;
  resourceId: string;
  areaName?: string | null;
}) {
  const { toast } = useToast();
  const { activeTenant } = useTenant();
  const reduceMotion = useReducedMotion();
  const [shares, setShares] = useState<ContentShareDto[]>([]);
  const [members, setMembers] = useState<TenantMemberOption[]>([]);
  const [userId, setUserId] = useState('');
  const [permission, setPermission] = useState<SharePermission>('VIEW');

  async function load() {
    try {
      setShares(await listShares(resourceType, resourceId));
    } catch (err) {
      toast((err as Error).message || 'Paylaşımlar alınamadı', 'error');
    }
  }

  useEffect(() => {
    if (!open) return;
    void load();
    if (activeTenant) {
      void listTenantMembers(activeTenant.id)
        .then(setMembers)
        .catch(() => setMembers([]));
    }
  }, [open, resourceType, resourceId, activeTenant]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Kapat"
            className="fixed inset-0 z-40 bg-ink-950/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-[var(--ww-border)] bg-white shadow-[var(--ww-shadow-md)]"
            initial={reduceMotion ? false : { x: 36, opacity: 0.85 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { x: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="flex items-center justify-between border-b border-[var(--ww-border)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--ww-text)]">Paylaş</p>
              <button type="button" onClick={onClose} className="rounded p-1 hover:bg-ink-50">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div className="border border-[var(--ww-border)] bg-canvas/50 px-3 py-2 text-xs text-[var(--ww-text-secondary)]">
                Alan: {areaName ?? 'Özel'}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ww-text-muted)]">
                  Kişi ekle
                </p>
                <Select size="sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
                  <option value="">Üye seçin</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {fullName(m.user)}
                    </option>
                  ))}
                </Select>
                <Select
                  size="sm"
                  value={permission}
                  onChange={(e) => setPermission(e.target.value as SharePermission)}
                >
                  <option value="VIEW">Görüntüleme</option>
                  <option value="EDIT">Düzenleme</option>
                </Select>
                <Button
                  type="button"
                  disabled={!userId}
                  onClick={() =>
                    void createShare({
                      resourceType,
                      resourceId,
                      sharedWithUserId: userId,
                      permission,
                    })
                      .then(() => {
                        setUserId('');
                        return load();
                      })
                      .catch((err) => toast((err as Error).message, 'error'))
                  }
                >
                  Paylaş
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ww-text-muted)]">
                  Paylaşılan kişiler
                </p>
                {!shares.length ? (
                  <p className="text-xs text-[var(--ww-text-muted)]">Doğrudan paylaşım yok</p>
                ) : (
                  shares.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 border border-[var(--ww-border)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {fullName(s.sharedWithUser)}
                        </p>
                        <p className="truncate text-[11px] text-[var(--ww-text-muted)]">
                          {s.sharedWithUser.email}
                        </p>
                      </div>
                      <Select
                        size="sm"
                        className="w-[112px] shrink-0"
                        value={s.permission}
                        onChange={(e) =>
                          void updateShare(s.id, e.target.value as SharePermission)
                            .then(load)
                            .catch((err) => toast((err as Error).message, 'error'))
                        }
                      >
                        <option value="VIEW">Görüntüle</option>
                        <option value="EDIT">Düzenle</option>
                      </Select>
                      <button
                        type="button"
                        className="text-xs text-danger"
                        onClick={() =>
                          void deleteShare(s.id)
                            .then(load)
                            .catch((err) => toast((err as Error).message, 'error'))
                        }
                      >
                        Kaldır
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
