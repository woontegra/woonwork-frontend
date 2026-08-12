import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownWideNarrow,
  ChevronDown,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Table2,
  Trash2,
  Copy,
} from 'lucide-react';
import {
  defaultStatusOptions,
  colorForNewOption,
  propertyTypeLabel,
  type DatabaseFilter,
  type DatabasePropertyType,
  type DatabaseSort,
  type DatabaseViewConfig,
  type SelectOption,
} from '@woonwork/shared';
import { useTenant } from '../../contexts/TenantContext';
import { useToast } from '../ui/Toast';
import { useDebouncedCallback } from '../editor/useDebouncedCallback';
import { CellDisplay, CellEditor } from './CellEditor';
import {
  cellValue,
  createProperty,
  createRow,
  deleteProperty,
  deleteRow,
  duplicateRow,
  getDatabase,
  listRows,
  listTenantMembers,
  reorderProperties,
  updateCell,
  updateProperty,
  updateView,
  type DatabaseDto,
  type DatabaseRowDto,
  type TenantMemberOption,
} from '../../lib/database';

const ADDABLE_TYPES: Array<Exclude<DatabasePropertyType, 'TITLE'>> = [
  'TEXT',
  'NUMBER',
  'SELECT',
  'MULTI_SELECT',
  'STATUS',
  'DATE',
  'CHECKBOX',
  'URL',
  'EMAIL',
  'PHONE',
  'PERSON',
];

const TEXT_OPS = [
  { value: 'contains', label: 'içerir' },
  { value: 'not_contains', label: 'içermez' },
  { value: 'is_empty', label: 'boş' },
  { value: 'is_not_empty', label: 'boş değil' },
] as const;

function operatorsFor(type: DatabasePropertyType) {
  if (type === 'NUMBER') {
    return [
      { value: 'equals', label: '=' },
      { value: 'not_equals', label: '!=' },
      { value: 'gt', label: '>' },
      { value: 'gte', label: '≥' },
      { value: 'lt', label: '<' },
      { value: 'lte', label: '≤' },
      { value: 'is_empty', label: 'boş' },
      { value: 'is_not_empty', label: 'boş değil' },
    ];
  }
  if (type === 'SELECT' || type === 'STATUS' || type === 'PERSON') {
    return [
      { value: 'equals', label: 'eşittir' },
      { value: 'not_equals', label: 'eşit değildir' },
      { value: 'is_empty', label: 'boş' },
      { value: 'is_not_empty', label: 'boş değil' },
    ];
  }
  if (type === 'CHECKBOX') {
    return [
      { value: 'is_checked', label: 'işaretli' },
      { value: 'is_unchecked', label: 'işaretsiz' },
    ];
  }
  if (type === 'DATE') {
    return [
      { value: 'before', label: 'önce' },
      { value: 'after', label: 'sonra' },
      { value: 'equals', label: 'eşittir' },
      { value: 'is_empty', label: 'boş' },
      { value: 'is_not_empty', label: 'boş değil' },
    ];
  }
  return TEXT_OPS;
}

export function DatabaseTable({
  databaseId,
  compact,
  viewId,
  externalDatabase,
  onDatabaseChange,
  onOpenRecord,
}: {
  databaseId: string;
  compact?: boolean;
  viewId?: string;
  externalDatabase?: DatabaseDto | null;
  onDatabaseChange?: (db: DatabaseDto) => void;
  onOpenRecord?: (row: DatabaseRowDto) => void;
}) {
  const { activeTenant } = useTenant();
  const { toast } = useToast();
  const [database, setDatabase] = useState<DatabaseDto | null>(externalDatabase ?? null);
  const [rows, setRows] = useState<DatabaseRowDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DatabaseFilter[]>([]);
  const [sorts, setSorts] = useState<DatabaseSort[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSorts, setShowSorts] = useState(false);
  const [showAddProp, setShowAddProp] = useState(false);
  const [members, setMembers] = useState<TenantMemberOption[]>([]);
  const [editing, setEditing] = useState<{ rowId: string; propertyId: string } | null>(null);
  const [draft, setDraft] = useState<unknown>(null);
  const [focusTitleRowId, setFocusTitleRowId] = useState<string | null>(null);
  const [headerMenu, setHeaderMenu] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const resizeRef = useRef<{ propertyId: string; startX: number; startW: number } | null>(null);
  const titlePropId = useMemo(
    () => database?.properties?.find((p) => p.type === 'TITLE')?.id ?? null,
    [database],
  );

  const activeView =
    database?.views?.find((v) => v.id === viewId) ?? database?.views?.[0] ?? null;

  useEffect(() => {
    if (externalDatabase) setDatabase(externalDatabase);
  }, [externalDatabase]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const db = externalDatabase ?? (await getDatabase(databaseId));
      setDatabase(db);
      const view =
        db.views?.find((v) => v.id === viewId) ?? db.views?.[0] ?? null;
      const viewConfig = (view?.config ?? { filters: [], sorts: [] }) as DatabaseViewConfig;
      const nextFilters = filters.length ? filters : viewConfig.filters ?? [];
      const nextSorts = sorts.length ? sorts : viewConfig.sorts ?? [];
      if (!filters.length && viewConfig.filters?.length) setFilters(viewConfig.filters);
      if (!sorts.length && viewConfig.sorts?.length) setSorts(viewConfig.sorts);
      if (viewConfig.columnWidths) setWidths(viewConfig.columnWidths);

      const result = await listRows(databaseId, {
        page: 1,
        limit: 50,
        search: search.trim() || undefined,
        filters: nextFilters,
        sorts: nextSorts,
        viewId: view?.id,
      });
      setRows(result.items);
      setTotal(result.total);
      if (result.properties.length) {
        setDatabase((prev) => (prev ? { ...prev, properties: result.properties } : prev));
      }
    } catch (err) {
      toast((err as Error).message || 'Tablo yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [databaseId, externalDatabase, filters, search, sorts, toast, viewId]);

  const reloadRows = useCallback(async () => {
    try {
      const result = await listRows(databaseId, {
        page: 1,
        limit: 50,
        search: search.trim() || undefined,
        filters,
        sorts,
        viewId: activeView?.id,
      });
      setRows(result.items);
      setTotal(result.total);
    } catch (err) {
      toast((err as Error).message || 'Kayıtlar yüklenemedi', 'error');
    }
  }, [activeView?.id, databaseId, filters, search, sorts, toast]);

  useEffect(() => {
    void load();
  }, [databaseId, viewId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeTenant) return;
    void listTenantMembers(activeTenant.id)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [activeTenant]);

  const debouncedSearchReload = useDebouncedCallback(() => {
    void reloadRows();
  }, 350);

  useEffect(() => {
    debouncedSearchReload();
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void reloadRows();
  }, [filters, sorts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focusTitleRowId || !titlePropId) return;
    setEditing({ rowId: focusTitleRowId, propertyId: titlePropId });
    setDraft('');
    setFocusTitleRowId(null);
  }, [focusTitleRowId, titlePropId]);

  const properties = database?.properties ?? [];

  async function persistViewConfig(next: Partial<DatabaseViewConfig>) {
    if (!activeView) return;
    const config: DatabaseViewConfig = {
      filters,
      sorts,
      columnWidths: widths,
      ...next,
    };
    try {
      await updateView(databaseId, activeView.id, { config });
    } catch {
      // silent
    }
  }

  async function saveCell(rowId: string, propertyId: string, value: unknown) {
    const snapshot = rows;
    setRows((prev) =>
      prev.map((row) => {
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
      }),
    );
    setEditing(null);
    try {
      const cell = await updateCell(databaseId, rowId, propertyId, value);
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const cells = row.cells.filter((c) => c.propertyId !== propertyId);
          cells.push(cell);
          return { ...row, cells };
        }),
      );
    } catch (err) {
      setRows(snapshot);
      toast((err as Error).message || 'Hücre kaydedilemedi', 'error');
    }
  }

  const debouncedSave = useDebouncedCallback(
    (rowId: string, propertyId: string, value: unknown) => {
      void saveCell(rowId, propertyId, value);
    },
    500,
  );

  async function onAddRow() {
    try {
      const row = await createRow(databaseId);
      setRows((prev) => [...prev, row]);
      setTotal((t) => t + 1);
      setFocusTitleRowId(row.id);
    } catch (err) {
      toast((err as Error).message || 'Kayıt eklenemedi', 'error');
    }
  }

  async function onAddProperty(type: Exclude<DatabasePropertyType, 'TITLE'>) {
    try {
      const created = await createProperty(databaseId, {
        name: propertyTypeLabel(type),
        type,
        config:
          type === 'STATUS'
            ? { options: defaultStatusOptions() }
            : type === 'SELECT' || type === 'MULTI_SELECT'
              ? { options: [] }
              : null,
      });
      setDatabase((prev) => {
        const next = prev
          ? { ...prev, properties: [...(prev.properties ?? []), created] }
          : prev;
        if (next) onDatabaseChange?.(next);
        return next;
      });
      setShowAddProp(false);
    } catch (err) {
      toast((err as Error).message || 'Alan eklenemedi', 'error');
    }
  }

  async function moveProperty(propertyId: string, dir: -1 | 1) {
    const ordered = properties.map((p) => p.id);
    const idx = ordered.indexOf(propertyId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= ordered.length) return;
    const next = [...ordered];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    try {
      const props = await reorderProperties(databaseId, next);
      setDatabase((prev) => {
        const resolved = prev ? { ...prev, properties: props } : prev;
        if (resolved) onDatabaseChange?.(resolved);
        return resolved;
      });
    } catch (err) {
      toast((err as Error).message || 'Sıra güncellenemedi', 'error');
    }
  }

  function onResizeStart(propertyId: string, event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      propertyId,
      startX: event.clientX,
      startW: widths[propertyId] ?? 180,
    };
    function onMove(e: MouseEvent) {
      if (!resizeRef.current) return;
      const w = Math.max(120, resizeRef.current.startW + (e.clientX - resizeRef.current.startX));
      setWidths((prev) => ({ ...prev, [resizeRef.current!.propertyId]: w }));
    }
    function onUp() {
      if (resizeRef.current) {
        void persistViewConfig({
          columnWidths: {
            ...widths,
            [resizeRef.current.propertyId]:
              widths[resizeRef.current.propertyId] ?? resizeRef.current.startW,
          },
        });
      }
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  if (loading && !database) {
    return <div className="animate-pulse space-y-2 py-4"><div className="h-8 rounded bg-navy-100" /><div className="h-24 rounded bg-navy-50" /></div>;
  }

  if (!database) {
    return <p className="text-sm text-navy-500">Akıllı tablo bulunamadı</p>;
  }

  return (
    <div
      className={`space-y-3 ${compact ? '' : ''}`}
      onPointerDown={(e) => e.stopPropagation()}
      data-database-table
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs font-medium text-white">
          <Table2 size={14} />
          Tablo
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
              showFilters ? 'bg-navy-900 text-white' : 'text-navy-600 hover:bg-navy-50'
            }`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter size={14} />
            Filtre
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
              showSorts ? 'bg-navy-900 text-white' : 'text-navy-600 hover:bg-navy-50'
            }`}
            onClick={() => setShowSorts((v) => !v)}
          >
            <ArrowDownWideNarrow size={14} />
            Sırala
          </button>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ara"
              className="w-40 rounded-lg border border-navy-200 bg-white py-1.5 pl-8 pr-2 text-xs outline-none focus:border-navy-400"
            />
          </div>
        </div>
      </div>

      {showFilters ? (
        <div className="space-y-2 rounded-xl border border-navy-100 bg-white p-3">
          {filters.map((filter, index) => {
            const prop = properties.find((p) => p.id === filter.propertyId);
            const ops = prop ? operatorsFor(prop.type) : TEXT_OPS;
            return (
              <div key={`${filter.propertyId}-${index}`} className="flex flex-wrap items-center gap-2">
                <select
                  value={filter.propertyId}
                  className="rounded-md border border-navy-200 px-2 py-1 text-xs"
                  onChange={(e) => {
                    const next = [...filters];
                    next[index] = {
                      propertyId: e.target.value,
                      operator: 'is_not_empty',
                      value: null,
                    };
                    setFilters(next);
                    void persistViewConfig({ filters: next });
                  }}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filter.operator}
                  className="rounded-md border border-navy-200 px-2 py-1 text-xs"
                  onChange={(e) => {
                    const next = [...filters];
                    next[index] = {
                      ...filter,
                      operator: e.target.value as DatabaseFilter['operator'],
                    };
                    setFilters(next);
                    void persistViewConfig({ filters: next });
                  }}
                >
                  {ops.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                {!['is_empty', 'is_not_empty', 'is_checked', 'is_unchecked'].includes(
                  filter.operator,
                ) ? (
                  <input
                    value={
                      typeof filter.value === 'string' || typeof filter.value === 'number'
                        ? String(filter.value)
                        : ''
                    }
                    className="rounded-md border border-navy-200 px-2 py-1 text-xs"
                    onChange={(e) => {
                      const next = [...filters];
                      const raw = e.target.value;
                      next[index] = {
                        ...filter,
                        value: prop?.type === 'NUMBER' ? Number(raw) : raw,
                      };
                      setFilters(next);
                    }}
                    onBlur={() => void persistViewConfig({ filters })}
                  />
                ) : null}
                <button
                  type="button"
                  className="text-xs text-navy-400 hover:text-rose-600"
                  onClick={() => {
                    const next = filters.filter((_, i) => i !== index);
                    setFilters(next);
                    void persistViewConfig({ filters: next });
                  }}
                >
                  Kaldır
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="text-xs font-medium text-navy-700 hover:underline"
            onClick={() => {
              if (!properties[0]) return;
              const next = [
                ...filters,
                { propertyId: properties[0].id, operator: 'is_not_empty' as const, value: null },
              ];
              setFilters(next);
              void persistViewConfig({ filters: next });
            }}
          >
            + Filtre ekle
          </button>
        </div>
      ) : null}

      {showSorts ? (
        <div className="space-y-2 rounded-xl border border-navy-100 bg-white p-3">
          {sorts.map((sort, index) => (
            <div key={`${sort.propertyId}-${index}`} className="flex flex-wrap items-center gap-2">
              <select
                value={sort.propertyId}
                className="rounded-md border border-navy-200 px-2 py-1 text-xs"
                onChange={(e) => {
                  const next = [...sorts];
                  next[index] = { ...sort, propertyId: e.target.value };
                  setSorts(next);
                  void persistViewConfig({ sorts: next });
                }}
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={sort.direction}
                className="rounded-md border border-navy-200 px-2 py-1 text-xs"
                onChange={(e) => {
                  const next = [...sorts];
                  next[index] = {
                    ...sort,
                    direction: e.target.value as 'asc' | 'desc',
                  };
                  setSorts(next);
                  void persistViewConfig({ sorts: next });
                }}
              >
                <option value="asc">Artan</option>
                <option value="desc">Azalan</option>
              </select>
              <button
                type="button"
                className="text-xs text-navy-400 hover:text-rose-600"
                onClick={() => {
                  const next = sorts.filter((_, i) => i !== index);
                  setSorts(next);
                  void persistViewConfig({ sorts: next });
                }}
              >
                Kaldır
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs font-medium text-navy-700 hover:underline"
            onClick={() => {
              if (!properties[0]) return;
              const next = [...sorts, { propertyId: properties[0].id, direction: 'asc' as const }];
              setSorts(next);
              void persistViewConfig({ sorts: next });
            }}
          >
            + Sıralama ekle
          </button>
        </div>
      ) : null}

      <div className="overflow-auto border border-[var(--ww-border)] bg-white">
        <table className="ww-table min-w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-10">
                #
              </th>
              {properties.map((property) => (
                <th
                  key={property.id}
                  className="relative"
                  style={{ width: widths[property.id] ?? 180, minWidth: widths[property.id] ?? 180 }}
                >
                  <button
                    type="button"
                    className="inline-flex max-w-full items-center gap-1 truncate font-medium text-[var(--ww-text-muted)] hover:text-[var(--ww-text)]"
                    onClick={() => setHeaderMenu((v) => (v === property.id ? null : property.id))}
                  >
                    {property.name}
                    <ChevronDown size={12} />
                  </button>
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-navy-300"
                    onMouseDown={(e) => onResizeStart(property.id, e)}
                  />
                  {headerMenu === property.id ? (
                    <div className="absolute left-0 top-8 z-20 w-44 rounded-lg border border-navy-100 bg-white p-1 shadow-lg">
                      <button
                        type="button"
                        className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-navy-50"
                        onClick={async () => {
                          const name = window.prompt('Alan adı', property.name);
                          setHeaderMenu(null);
                          if (!name?.trim()) return;
                          try {
                            const updated = await updateProperty(databaseId, property.id, {
                              name: name.trim(),
                            });
                            setDatabase((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    properties: (prev.properties ?? []).map((p) =>
                                      p.id === property.id ? updated : p,
                                    ),
                                  }
                                : prev,
                            );
                          } catch (err) {
                            toast((err as Error).message || 'Alan güncellenemedi', 'error');
                          }
                        }}
                      >
                        Alanı Yeniden Adlandır
                      </button>
                      {property.type !== 'TITLE' ? (
                        <div className="border-t border-navy-50 px-2 py-1">
                          <p className="mb-1 text-[10px] uppercase text-navy-400">Alan Tipi</p>
                          <select
                            className="w-full rounded border border-navy-200 px-1 py-1 text-xs"
                            value={property.type}
                            onChange={async (e) => {
                              setHeaderMenu(null);
                              try {
                                const updated = await updateProperty(databaseId, property.id, {
                                  type: e.target.value as DatabasePropertyType,
                                });
                                setDatabase((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        properties: (prev.properties ?? []).map((p) =>
                                          p.id === property.id ? updated : p,
                                        ),
                                      }
                                    : prev,
                                );
                              } catch (err) {
                                toast((err as Error).message || 'Tip değiştirilemedi', 'error');
                              }
                            }}
                          >
                            {ADDABLE_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {propertyTypeLabel(t)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-navy-50"
                        onClick={() => {
                          setHeaderMenu(null);
                          void moveProperty(property.id, -1);
                        }}
                      >
                        Sola Taşı
                      </button>
                      <button
                        type="button"
                        className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-navy-50"
                        onClick={() => {
                          setHeaderMenu(null);
                          void moveProperty(property.id, 1);
                        }}
                      >
                        Sağa Taşı
                      </button>
                      {property.type !== 'TITLE' ? (
                        <button
                          type="button"
                          className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50"
                          onClick={async () => {
                            setHeaderMenu(null);
                            try {
                              await deleteProperty(databaseId, property.id);
                              setDatabase((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      properties: (prev.properties ?? []).filter(
                                        (p) => p.id !== property.id,
                                      ),
                                    }
                                  : prev,
                              );
                            } catch (err) {
                              toast((err as Error).message || 'Alan silinemedi', 'error');
                            }
                          }}
                        >
                          Alanı Sil
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </th>
              ))}
              <th>
                <div className="relative">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-navy-500 hover:bg-navy-100"
                    onClick={() => setShowAddProp((v) => !v)}
                  >
                    <Plus size={12} />
                    Alan Ekle
                  </button>
                  {showAddProp ? (
                    <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-navy-100 bg-white p-1 shadow-lg">
                      {ADDABLE_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-navy-50"
                          onClick={() => void onAddProperty(type)}
                        >
                          {propertyTypeLabel(type)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="group">
                <td>
                  <div className="relative flex items-center gap-1">
                    <span className="text-[11px] text-navy-400">{index + 1}</span>
                    <button
                      type="button"
                      className="rounded p-0.5 text-navy-300 opacity-0 hover:bg-navy-100 hover:text-navy-700 group-hover:opacity-100"
                      onClick={() => setRowMenu((v) => (v === row.id ? null : row.id))}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {rowMenu === row.id ? (
                      <div className="absolute left-0 top-6 z-20 w-36 rounded-lg border border-navy-100 bg-white p-1 shadow-lg">
                        {onOpenRecord ? (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-navy-50"
                            onClick={() => {
                              setRowMenu(null);
                              onOpenRecord(row);
                            }}
                          >
                            Aç
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-navy-50"
                          onClick={async () => {
                            setRowMenu(null);
                            try {
                              const dup = await duplicateRow(databaseId, row.id);
                              setRows((prev) => {
                                const idx = prev.findIndex((r) => r.id === row.id);
                                const next = [...prev];
                                next.splice(idx + 1, 0, dup);
                                return next;
                              });
                              setTotal((t) => t + 1);
                            } catch (err) {
                              toast((err as Error).message || 'Çoğaltılamadı', 'error');
                            }
                          }}
                        >
                          <Copy size={12} /> Çoğalt
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50"
                          onClick={async () => {
                            setRowMenu(null);
                            try {
                              await deleteRow(databaseId, row.id);
                              setRows((prev) => prev.filter((r) => r.id !== row.id));
                              setTotal((t) => Math.max(0, t - 1));
                            } catch (err) {
                              toast((err as Error).message || 'Silinemedi', 'error');
                            }
                          }}
                        >
                          <Trash2 size={12} /> Sil
                        </button>
                      </div>
                    ) : null}
                  </div>
                </td>
                {properties.map((property) => {
                  const isEditing =
                    editing?.rowId === row.id && editing.propertyId === property.id;
                  const value = cellValue(row, property.id);
                  return (
                    <td
                      key={property.id}
                      style={{ width: widths[property.id] ?? 180, minWidth: widths[property.id] ?? 180 }}
                      onClick={() => {
                        if (property.type === 'CHECKBOX') {
                          void saveCell(row.id, property.id, !Boolean(value));
                          return;
                        }
                        if (isEditing) return;
                        setEditing({ rowId: row.id, propertyId: property.id });
                        setDraft(value);
                      }}
                    >
                      {isEditing ? (
                        <CellEditor
                          property={property}
                          value={draft}
                          members={members}
                          autoFocus
                          onChange={(next) => {
                            setDraft(next);
                            if (
                              property.type === 'TITLE' ||
                              property.type === 'TEXT' ||
                              property.type === 'URL' ||
                              property.type === 'EMAIL' ||
                              property.type === 'PHONE' ||
                              property.type === 'NUMBER'
                            ) {
                              debouncedSave(row.id, property.id, next);
                            }
                          }}
                          onCommit={(next) => {
                            debouncedSave.cancel();
                            void saveCell(row.id, property.id, next);
                          }}
                          onCancel={() => setEditing(null)}
                          onCreateOption={
                            property.type === 'SELECT' ||
                            property.type === 'MULTI_SELECT' ||
                            property.type === 'STATUS'
                              ? async (name) => {
                                  const current = (property.config?.options ?? []) as SelectOption[];
                                  const opt: SelectOption = {
                                    id: `opt-${Date.now()}`,
                                    name,
                                    color: colorForNewOption(name, current, property.type),
                                  };
                                  try {
                                    const updated = await updateProperty(databaseId, property.id, {
                                      config: { options: [...current, opt] },
                                    });
                                    setDatabase((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            properties: (prev.properties ?? []).map((p) =>
                                              p.id === property.id ? updated : p,
                                            ),
                                          }
                                        : prev,
                                    );
                                    return opt;
                                  } catch (err) {
                                    toast((err as Error).message || 'Seçenek eklenemedi', 'error');
                                    return null;
                                  }
                                }
                              : undefined
                          }
                        />
                      ) : (
                        <div className="flex min-h-[28px] items-center">
                          <CellDisplay
                            property={property}
                            value={value}
                            members={members}
                            onToggleCheckbox={(next) => void saveCell(row.id, property.id, next)}
                          />
                        </div>
                      )}
                    </td>
                  );
                })}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={() => void onAddRow()}
          className="flex w-full items-center gap-2 border-t border-[var(--ww-border)] px-3 py-2 text-left text-[13px] text-[var(--ww-text-muted)] hover:bg-ink-50/60"
        >
          <Plus size={14} />
          Yeni Kayıt
        </button>
      </div>
      <p className="text-[11px] text-navy-400">{total} kayıt</p>
    </div>
  );
}
