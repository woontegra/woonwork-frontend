import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Copy, Trash2, X } from 'lucide-react';
import { CellEditor } from './CellEditor';
import { Button } from '../ui/Form';
import {
  cellValue,
  deleteRow,
  duplicateRow,
  updateCell,
  type DatabaseDto,
  type DatabasePropertyDto,
  type DatabaseRowDto,
  type TenantMemberOption,
} from '../../lib/database';
import { useToast } from '../ui/Toast';

export function DatabaseRecordPanel({
  open,
  database,
  row,
  members,
  onClose,
  onChanged,
  onDeleted,
}: {
  open: boolean;
  database: DatabaseDto;
  row: DatabaseRowDto | null;
  members: TenantMemberOption[];
  onClose: () => void;
  onChanged: (row: DatabaseRowDto) => void;
  onDeleted: (rowId: string) => void;
}) {
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [local, setLocal] = useState<DatabaseRowDto | null>(row);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setLocal(row);
    setDrafts({});
  }, [row]);

  const titleProp = useMemo(
    () => database.properties?.find((p) => p.type === 'TITLE') ?? null,
    [database.properties],
  );
  const otherProps = useMemo(
    () => (database.properties ?? []).filter((p) => p.type !== 'TITLE'),
    [database.properties],
  );

  async function saveProperty(property: DatabasePropertyDto, value: unknown) {
    if (!local) return;
    const snapshot = local;
    const nextCells = [...local.cells];
    const idx = nextCells.findIndex((c) => c.propertyId === property.id);
    if (idx >= 0) nextCells[idx] = { ...nextCells[idx], value };
    else {
      nextCells.push({
        id: `temp-${property.id}`,
        tenantId: local.tenantId,
        rowId: local.id,
        propertyId: property.id,
        value,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    const optimistic = { ...local, cells: nextCells };
    setLocal(optimistic);
    onChanged(optimistic);
    try {
      await updateCell(database.id, local.id, property.id, value);
    } catch (err) {
      setLocal(snapshot);
      onChanged(snapshot);
      toast((err as Error).message || 'Kaydedilemedi', 'error');
    }
  }

  async function onDuplicate() {
    if (!local) return;
    try {
      const created = await duplicateRow(database.id, local.id);
      onChanged(created);
      toast('Kayıt çoğaltıldı', 'success');
    } catch (err) {
      toast((err as Error).message || 'Çoğaltılamadı', 'error');
    }
  }

  async function onDelete() {
    if (!local) return;
    if (!window.confirm('Bu kaydı silmek istiyor musunuz?')) return;
    try {
      await deleteRow(database.id, local.id);
      onDeleted(local.id);
      onClose();
      toast('Kayıt silindi', 'success');
    } catch (err) {
      toast((err as Error).message || 'Silinemedi', 'error');
    }
  }

  const titleValue =
    titleProp && local
      ? (drafts[titleProp.id] ?? cellValue(local, titleProp.id) ?? '')
      : '';

  return (
    <AnimatePresence>
      {open && local ? (
        <>
          <motion.button
            type="button"
            aria-label="Paneli kapat"
            className="fixed inset-0 z-40 bg-ink-950/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-[var(--ww-border)] bg-white shadow-[var(--ww-shadow-md)]"
            initial={reduceMotion ? false : { x: 40, opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { x: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--ww-border)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ww-text-muted)]">
                Kayıt
              </p>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => void onDuplicate()}>
                  <Copy size={14} />
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => void onDelete()}>
                  <Trash2 size={14} />
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                  <X size={14} />
                </Button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {titleProp ? (
                <input
                  value={typeof titleValue === 'string' ? titleValue : String(titleValue ?? '')}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [titleProp.id]: e.target.value }))
                  }
                  onBlur={() => {
                    const next = drafts[titleProp.id];
                    if (next === undefined) return;
                    void saveProperty(titleProp, next);
                  }}
                  placeholder="Adsız"
                  className="w-full border-0 bg-transparent text-2xl font-semibold tracking-tight text-[var(--ww-text)] outline-none placeholder:text-[var(--ww-text-muted)]"
                />
              ) : null}

              <div className="space-y-3">
                {otherProps.map((property) => {
                  const value = drafts[property.id] ?? cellValue(local, property.id);
                  return (
                    <div key={property.id} className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ww-text-muted)]">
                        {property.name}
                      </p>
                      <div className="rounded-[var(--ww-radius-md)] border border-[var(--ww-border)] bg-canvas/40 px-2 py-1.5">
                        <CellEditor
                          property={property}
                          value={value}
                          members={members}
                          onChange={(next) =>
                            setDrafts((d) => ({ ...d, [property.id]: next }))
                          }
                          onCommit={(next) => {
                            setDrafts((d) => ({ ...d, [property.id]: next }));
                            void saveProperty(property, next);
                          }}
                          onCancel={() =>
                            setDrafts((d) => {
                              const copy = { ...d };
                              delete copy[property.id];
                              return copy;
                            })
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
