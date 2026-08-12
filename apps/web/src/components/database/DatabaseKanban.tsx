import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, useReducedMotion } from 'framer-motion';
import { MoreHorizontal, Plus } from 'lucide-react';
import { colorForNewOption, type SelectOption } from '@woonwork/shared';
import { CellDisplay } from './CellEditor';
import { Button, Input } from '../ui/Form';
import {
  cellValue,
  createRow,
  moveRow,
  updateCell,
  updateProperty,
  type DatabaseDto,
  type DatabasePropertyDto,
  type DatabaseRowDto,
  type DatabaseViewDto,
  type TenantMemberOption,
} from '../../lib/database';
import { useToast } from '../ui/Toast';

const NULL_COLUMN = '__none__';

const DOT: Record<string, string> = {
  gray: 'bg-ink-300',
  brown: 'bg-amber-700',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-400',
  green: 'bg-emerald-500',
  blue: 'bg-sky-500',
  purple: 'bg-violet-500',
  pink: 'bg-pink-500',
  red: 'bg-rose-500',
  teal: 'bg-teal-500',
};

function KanbanCard({
  row,
  titleProp,
  cardProps,
  members,
  onOpen,
}: {
  row: DatabaseRowDto;
  titleProp: DatabasePropertyDto | null;
  cardProps: DatabasePropertyDto[];
  members: TenantMemberOption[];
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const title = titleProp ? String(cellValue(row, titleProp.id) ?? '') : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab border border-[var(--ww-border)] bg-white px-3 py-2.5 active:cursor-grabbing ${
        isDragging ? 'opacity-40 shadow-[var(--ww-shadow-md)]' : 'hover:border-accent/30'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <p className="text-sm font-medium text-[var(--ww-text)]">{title || 'Adsız'}</p>
      {cardProps.length ? (
        <div className="mt-2 space-y-1">
          {cardProps.map((p) => (
            <div key={p.id} className="text-[11px] text-[var(--ww-text-muted)]">
              <CellDisplay property={p} value={cellValue(row, p.id)} members={members} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Column({
  id,
  title,
  color,
  rows,
  titleProp,
  cardProps,
  members,
  onOpen,
  onQuickAdd,
  onRename,
  onRecolor,
  onDeleteOption,
}: {
  id: string;
  title: string;
  color?: string;
  rows: DatabaseRowDto[];
  titleProp: DatabasePropertyDto | null;
  cardProps: DatabasePropertyDto[];
  members: TenantMemberOption[];
  onOpen: (row: DatabaseRowDto) => void;
  onQuickAdd: (groupValue: string | null) => void;
  onRename?: () => void;
  onRecolor?: (color: string) => void;
  onDeleteOption?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [menu, setMenu] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[280px] shrink-0 flex-col border border-[var(--ww-border)] bg-canvas/50 ${
        isOver ? 'border-accent/40 bg-accent-soft/20' : ''
      }`}
    >
      <div className="flex items-center gap-2 border-b border-[var(--ww-border)] px-3 py-2.5">
        <span className={`h-2 w-2 rounded-full ${DOT[color ?? 'gray'] ?? DOT.gray}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-[var(--ww-text)]">{title}</p>
          <p className="text-[10px] text-[var(--ww-text-muted)]">{rows.length} kayıt</p>
        </div>
        {id !== NULL_COLUMN ? (
          <div className="relative">
            <button
              type="button"
              className="rounded p-1 text-[var(--ww-text-muted)] hover:bg-white"
              onClick={() => setMenu((v) => !v)}
            >
              <MoreHorizontal size={14} />
            </button>
            {menu ? (
              <div className="absolute right-0 top-7 z-20 w-40 border border-[var(--ww-border)] bg-white py-1 shadow-[var(--ww-shadow-sm)]">
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-ink-50"
                  onClick={() => {
                    setMenu(false);
                    onRename?.();
                  }}
                >
                  Yeniden adlandır
                </button>
                <div className="flex flex-wrap gap-1 px-3 py-2">
                  {Object.keys(DOT).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`h-4 w-4 rounded-full ${DOT[c]}`}
                      onClick={() => {
                        setMenu(false);
                        onRecolor?.(c);
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-xs text-danger hover:bg-danger-soft"
                  onClick={() => {
                    setMenu(false);
                    onDeleteOption?.();
                  }}
                >
                  Sil
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          className="rounded p-1 text-[var(--ww-text-muted)] hover:bg-white"
          onClick={() => onQuickAdd(id === NULL_COLUMN ? null : id)}
          aria-label="Kayıt ekle"
        >
          <Plus size={14} />
        </button>
      </div>

      <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
          {rows.map((row, i) => (
            <motion.div
              key={row.id}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.02 }}
            >
              <KanbanCard
                row={row}
                titleProp={titleProp}
                cardProps={cardProps}
                members={members}
                onOpen={() => onOpen(row)}
              />
            </motion.div>
          ))}
        </div>
      </SortableContext>

      <button
        type="button"
        className="m-2 border border-dashed border-[var(--ww-border)] px-2 py-2 text-left text-xs font-medium text-[var(--ww-text-muted)] hover:border-accent/40 hover:text-[var(--ww-text)]"
        onClick={() => onQuickAdd(id === NULL_COLUMN ? null : id)}
      >
        + Kayıt Ekle
      </button>
    </div>
  );
}

export function DatabaseKanban({
  database,
  view,
  rows,
  members,
  onRowsChange,
  onDatabaseChange,
  onOpenRecord,
}: {
  database: DatabaseDto;
  view: DatabaseViewDto;
  rows: DatabaseRowDto[];
  members: TenantMemberOption[];
  onRowsChange: (rows: DatabaseRowDto[]) => void;
  onDatabaseChange: (db: DatabaseDto) => void;
  onOpenRecord: (row: DatabaseRowDto) => void;
}) {
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const groupPropId = view.config.groupByPropertyId;
  const groupProp = useMemo(
    () => database.properties?.find((p) => p.id === groupPropId) ?? null,
    [database.properties, groupPropId],
  );
  const titleProp = useMemo(
    () => database.properties?.find((p) => p.type === 'TITLE') ?? null,
    [database.properties],
  );
  const cardProps = useMemo(() => {
    const ids = view.config.cardPropertyIds ?? [];
    return (database.properties ?? []).filter((p) => ids.includes(p.id)).slice(0, 3);
  }, [database.properties, view.config.cardPropertyIds]);

  const options = (groupProp?.config?.options ?? []) as SelectOption[];

  const columns = useMemo(() => {
    const map = new Map<string, DatabaseRowDto[]>();
    map.set(NULL_COLUMN, []);
    for (const opt of options) map.set(opt.id, []);
    for (const row of rows) {
      if (!groupProp) {
        map.get(NULL_COLUMN)!.push(row);
        continue;
      }
      const val = cellValue(row, groupProp.id);
      const key = typeof val === 'string' && map.has(val) ? val : NULL_COLUMN;
      map.get(key)!.push(row);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.position - b.position);
    }
    return map;
  }, [groupProp, options, rows]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function patchCellLocal(rowId: string, propertyId: string, value: unknown) {
    return rows.map((row) => {
      if (row.id !== rowId) return row;
      const cells = [...row.cells];
      const idx = cells.findIndex((c) => c.propertyId === propertyId);
      if (idx >= 0) cells[idx] = { ...cells[idx], value };
      else {
        cells.push({
          id: `temp-${propertyId}`,
          tenantId: row.tenantId,
          rowId,
          propertyId,
          value,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return { ...row, cells };
    });
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || !groupProp) return;
    const rowId = String(active.id);
    const overId = String(over.id);

    let targetColumn = overId;
    if (!columns.has(overId)) {
      for (const [colId, list] of columns) {
        if (list.some((r) => r.id === overId)) {
          targetColumn = colId;
          break;
        }
      }
    }

    const groupValue = targetColumn === NULL_COLUMN ? null : targetColumn;
    const current = cellValue(rows.find((r) => r.id === rowId)!, groupProp.id);
    const currentKey =
      typeof current === 'string' && columns.has(current) ? current : NULL_COLUMN;

    const overRow = rows.find((r) => r.id === overId);
    const afterRowId =
      overRow && overRow.id !== rowId
        ? overRow.id
        : columns.get(targetColumn)?.filter((r) => r.id !== rowId).at(-1)?.id ?? null;

    const snapshot = rows;
    let next = patchCellLocal(rowId, groupProp.id, groupValue);
    onRowsChange(next);

    try {
      if (currentKey !== targetColumn) {
        await updateCell(database.id, rowId, groupProp.id, groupValue);
      }
      if (afterRowId !== undefined) {
        const moved = await moveRow(database.id, { rowId, afterRowId });
        next = next.map((r) => (r.id === rowId ? moved : r));
        onRowsChange(next);
      }
    } catch (err) {
      onRowsChange(snapshot);
      toast((err as Error).message || 'Taşıma başarısız', 'error');
    }
  }

  async function quickAdd(groupValue: string | null) {
    if (!titleProp) return;
    try {
      const cells: Array<{ propertyId: string; value: unknown }> = [
        { propertyId: titleProp.id, value: '' },
      ];
      if (groupProp && groupValue) {
        cells.push({ propertyId: groupProp.id, value: groupValue });
      }
      const created = await createRow(database.id, { cells });
      onRowsChange([...rows, created]);
      onOpenRecord(created);
    } catch (err) {
      toast((err as Error).message || 'Kayıt eklenemedi', 'error');
    }
  }

  async function saveOptions(nextOptions: SelectOption[]) {
    if (!groupProp) return;
    try {
      const updated = await updateProperty(database.id, groupProp.id, {
        config: { options: nextOptions },
      });
      onDatabaseChange({
        ...database,
        properties: (database.properties ?? []).map((p) =>
          p.id === updated.id ? updated : p,
        ),
      });
    } catch (err) {
      toast((err as Error).message || 'Grup güncellenemedi', 'error');
    }
  }

  async function addGroup() {
    if (!groupProp || !newGroupName.trim()) return;
    const opt: SelectOption = {
      id: `opt-${Date.now()}`,
      name: newGroupName.trim(),
      color: colorForNewOption(newGroupName.trim(), options, groupProp.type),
    };
    await saveOptions([...options, opt]);
    setNewGroupName('');
    setAddingGroup(false);
  }

  if (!groupProp) {
    return (
      <div className="border border-dashed border-[var(--ww-border)] px-4 py-8 text-sm text-[var(--ww-text-muted)]">
        Kanban için gruplama alanı yapılandırılmamış.
      </div>
    );
  }

  const activeRow = activeId ? rows.find((r) => r.id === activeId) : null;

  return (
    <div className="w-full min-w-0">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={(e) => void onDragEnd(e)}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-3 overflow-x-auto pb-2">
          {options.map((opt) => (
            <Column
              key={opt.id}
              id={opt.id}
              title={opt.name}
              color={opt.color}
              rows={columns.get(opt.id) ?? []}
              titleProp={titleProp}
              cardProps={cardProps}
              members={members}
              onOpen={onOpenRecord}
              onQuickAdd={(v) => void quickAdd(v)}
              onRename={() => {
                const name = window.prompt('Kolon adı', opt.name);
                if (!name?.trim()) return;
                void saveOptions(
                  options.map((o) => (o.id === opt.id ? { ...o, name: name.trim() } : o)),
                );
              }}
              onRecolor={(color) => {
                void saveOptions(
                  options.map((o) =>
                    o.id === opt.id ? { ...o, color: color as SelectOption['color'] } : o,
                  ),
                );
              }}
              onDeleteOption={() => {
                if (!window.confirm(`“${opt.name}” grubunu silmek istiyor musunuz?`)) return;
                void saveOptions(options.filter((o) => o.id !== opt.id));
              }}
            />
          ))}
          <Column
            id={NULL_COLUMN}
            title="Durum Yok"
            rows={columns.get(NULL_COLUMN) ?? []}
            titleProp={titleProp}
            cardProps={cardProps}
            members={members}
            onOpen={onOpenRecord}
            onQuickAdd={(v) => void quickAdd(v)}
          />

          <div className="w-[220px] shrink-0">
            {addingGroup ? (
              <div className="space-y-2 border border-[var(--ww-border)] bg-white p-3">
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Grup adı"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => void addGroup()}>
                    Ekle
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setAddingGroup(false)}>
                    Vazgeç
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="secondary" className="w-full" onClick={() => setAddingGroup(true)}>
                <Plus size={14} /> Grup Ekle
              </Button>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeRow ? (
            <div className="w-[260px] border border-accent/30 bg-white px-3 py-2.5 shadow-[var(--ww-shadow-md)]">
              <p className="text-sm font-medium">
                {titleProp ? String(cellValue(activeRow, titleProp.id) ?? 'Adsız') : 'Adsız'}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
