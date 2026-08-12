import { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import type { DatabaseFilter, DatabaseSort, DatabaseViewType } from '@woonwork/shared';
import { useTenant } from '../../contexts/TenantContext';
import { useToast } from '../ui/Toast';
import { useDebouncedCallback } from '../editor/useDebouncedCallback';
import { Button, SearchInput } from '../ui/Form';
import { DatabaseViewSwitcher } from './DatabaseViewSwitcher';
import { DatabaseTable } from './DatabaseTable';
import { DatabaseKanban } from './DatabaseKanban';
import { DatabaseCalendar } from './DatabaseCalendar';
import { DatabaseRecordPanel } from './DatabaseRecordPanel';
import {
  createProperty,
  createView,
  deleteView,
  duplicateView,
  getDatabase,
  listRows,
  listTenantMembers,
  readLastViewId,
  updateView,
  writeLastViewId,
  type DatabaseDto,
  type DatabaseRowDto,
  type DatabaseViewDto,
  type TenantMemberOption,
} from '../../lib/database';

function monthBounds(cursor: Date) {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

export function DatabaseWorkspace({
  databaseId,
  compact,
  initialViewId,
  onViewIdChange,
}: {
  databaseId: string;
  compact?: boolean;
  /** Embedded block preferred view */
  initialViewId?: string | null;
  onViewIdChange?: (viewId: string) => void;
}) {
  const { activeTenant } = useTenant();
  const { toast } = useToast();
  const [database, setDatabase] = useState<DatabaseDto | null>(null);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [rows, setRows] = useState<DatabaseRowDto[]>([]);
  const [undatedRows, setUndatedRows] = useState<DatabaseRowDto[]>([]);
  const [undatedTotal, setUndatedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DatabaseFilter[]>([]);
  const [sorts, setSorts] = useState<DatabaseSort[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [members, setMembers] = useState<TenantMemberOption[]>([]);
  const [panelRow, setPanelRow] = useState<DatabaseRowDto | null>(null);
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const views = database?.views ?? [];
  const activeView = useMemo(
    () => views.find((v) => v.id === activeViewId) ?? views[0] ?? null,
    [activeViewId, views],
  );

  const selectView = useCallback(
    (viewId: string) => {
      setActiveViewId(viewId);
      if (activeTenant) writeLastViewId(activeTenant.id, databaseId, viewId);
      onViewIdChange?.(viewId);
      const view = views.find((v) => v.id === viewId);
      if (view) {
        setFilters(view.config.filters ?? []);
        setSorts(view.config.sorts ?? []);
      }
    },
    [activeTenant, databaseId, onViewIdChange, views],
  );

  const loadDatabase = useCallback(async () => {
    const db = await getDatabase(databaseId);
    setDatabase(db);
    const preferred =
      initialViewId && db.views?.some((v) => v.id === initialViewId)
        ? initialViewId
        : activeTenant
          ? readLastViewId(activeTenant.id, databaseId)
          : null;
    const valid =
      preferred && db.views?.some((v) => v.id === preferred)
        ? preferred
        : db.views?.[0]?.id ?? null;
    setActiveViewId(valid);
    const view = db.views?.find((v) => v.id === valid) ?? db.views?.[0];
    if (view) {
      setFilters(view.config.filters ?? []);
      setSorts(view.config.sorts ?? []);
    }
    return { db, viewId: valid };
  }, [activeTenant, databaseId, initialViewId]);

  const loadRows = useCallback(
    async (view: DatabaseViewDto | null, nextFilters = filters, nextSorts = sorts, q = search) => {
      if (!view) return;
      const params: Parameters<typeof listRows>[1] = {
        page: 1,
        limit: view.type === 'TABLE' ? 50 : 500,
        search: q.trim() || undefined,
        viewId: view.id,
        filters: nextFilters,
        sorts: nextSorts,
      };
      if (view.type === 'CALENDAR' && view.config.datePropertyId) {
        const bounds = monthBounds(calendarCursor);
        params.startDate = bounds.startDate;
        params.endDate = bounds.endDate;
        params.datePropertyId = view.config.datePropertyId;
      }
      const result = await listRows(databaseId, params);
      setRows(result.items);
      if (typeof result.undatedTotal === 'number') setUndatedTotal(result.undatedTotal);
      if (result.properties.length) {
        setDatabase((prev) => (prev ? { ...prev, properties: result.properties } : prev));
      }
    },
    [calendarCursor, databaseId, filters, search, sorts],
  );

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const { viewId, db } = await loadDatabase();
      const view = db.views?.find((v) => v.id === viewId) ?? null;
      await loadRows(view, view?.config.filters ?? [], view?.config.sorts ?? [], '');
    } catch (err) {
      toast((err as Error).message || 'Tablo yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, [loadDatabase, loadRows, toast]);

  useEffect(() => {
    void bootstrap();
  }, [databaseId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeTenant) return;
    void listTenantMembers(activeTenant.id)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [activeTenant]);

  const debouncedSearch = useDebouncedCallback(() => {
    if (activeView) void loadRows(activeView).catch((err) => toast(err.message, 'error'));
  }, 350);

  useEffect(() => {
    debouncedSearch();
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeView) return;
    void loadRows(activeView).catch((err) => toast(err.message, 'error'));
  }, [activeViewId, calendarCursor, filters, sorts]); // eslint-disable-line react-hooks/exhaustive-deps

  async function persistFilters(next: DatabaseFilter[], nextSorts: DatabaseSort[]) {
    setFilters(next);
    setSorts(nextSorts);
    if (!activeView) return;
    try {
      const updated = await updateView(databaseId, activeView.id, {
        config: {
          ...activeView.config,
          filters: next,
          sorts: nextSorts,
        },
      });
      setDatabase((prev) =>
        prev
          ? {
              ...prev,
              views: (prev.views ?? []).map((v) => (v.id === updated.id ? updated : v)),
            }
          : prev,
      );
    } catch {
      // silent
    }
  }

  async function handleCreateView(input: {
    name: string;
    type: DatabaseViewType;
    groupByPropertyId?: string;
    datePropertyId?: string;
  }) {
    try {
      let datePropertyId = input.datePropertyId;
      if (input.type === 'CALENDAR' && !datePropertyId) {
        const created = await createProperty(databaseId, { name: 'Tarih', type: 'DATE' });
        datePropertyId = created.id;
        setDatabase((prev) =>
          prev
            ? { ...prev, properties: [...(prev.properties ?? []), created] }
            : prev,
        );
      }
      if (input.type === 'KANBAN' && !input.groupByPropertyId) {
        const created = await createProperty(databaseId, { name: 'Durum', type: 'STATUS' });
        input.groupByPropertyId = created.id;
        setDatabase((prev) =>
          prev
            ? { ...prev, properties: [...(prev.properties ?? []), created] }
            : prev,
        );
      }

      const created = await createView(databaseId, {
        name: input.name,
        type: input.type,
        config: {
          filters: [],
          sorts: [],
          groupByPropertyId: input.groupByPropertyId,
          datePropertyId,
        },
      });
      setDatabase((prev) =>
        prev ? { ...prev, views: [...(prev.views ?? []), created] } : prev,
      );
      selectView(created.id);
      toast('Görünüm oluşturuldu', 'success');
    } catch (err) {
      toast((err as Error).message || 'Görünüm oluşturulamadı', 'error');
      throw err;
    }
  }

  async function reloadUndated() {
    if (!activeView?.config.datePropertyId) return;
    try {
      const result = await listRows(databaseId, {
        page: 1,
        limit: 100,
        viewId: activeView.id,
        datePropertyId: activeView.config.datePropertyId,
        undatedOnly: true,
        search: search.trim() || undefined,
        filters,
      });
      setUndatedRows(result.items);
      setUndatedTotal(result.total);
    } catch (err) {
      toast((err as Error).message || 'Tarihsiz kayıtlar alınamadı', 'error');
    }
  }

  if (loading || !database) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 w-64 rounded bg-ink-100" />
        <div className="h-64 rounded bg-ink-100" />
      </div>
    );
  }

  return (
    <div className={`w-full min-w-0 space-y-${compact ? '3' : '4'}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <DatabaseViewSwitcher
          views={views}
          activeViewId={activeView?.id ?? null}
          properties={database.properties ?? []}
          compact={compact}
          onSelect={selectView}
          onCreate={handleCreateView}
          onRename={async (viewId, name) => {
            const updated = await updateView(databaseId, viewId, { name });
            setDatabase((prev) =>
              prev
                ? {
                    ...prev,
                    views: (prev.views ?? []).map((v) => (v.id === updated.id ? updated : v)),
                  }
                : prev,
            );
          }}
          onDuplicate={async (viewId) => {
            const created = await duplicateView(databaseId, viewId);
            setDatabase((prev) =>
              prev ? { ...prev, views: [...(prev.views ?? []), created] } : prev,
            );
            selectView(created.id);
          }}
          onDelete={async (viewId) => {
            if (!window.confirm('Bu görünümü silmek istiyor musunuz?')) return;
            await deleteView(databaseId, viewId);
            const nextViews = views.filter((v) => v.id !== viewId);
            setDatabase((prev) =>
              prev ? { ...prev, views: nextViews } : prev,
            );
            if (activeViewId === viewId && nextViews[0]) selectView(nextViews[0].id);
          }}
        />

        {activeView?.type !== 'TABLE' ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 lg:max-w-md">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Ara..."
              size="sm"
              className="min-w-[180px] flex-1 lg:max-w-xs"
            />
            <Button
              type="button"
              size="sm"
              variant={showFilters || filters.length ? 'secondary' : 'ghost'}
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter size={14} strokeWidth={1.75} />
              {filters.length ? `Filtre · ${filters.length}` : 'Filtre'}
            </Button>
          </div>
        ) : null}
      </div>

      {showFilters && activeView?.type !== 'TABLE' ? (
        <FilterBar
          properties={database.properties ?? []}
          filters={filters}
          sorts={sorts}
          onChange={(f, s) => void persistFilters(f, s)}
        />
      ) : null}

      {activeView?.type === 'TABLE' ? (
        <DatabaseTable
          databaseId={databaseId}
          compact={compact}
          viewId={activeView.id}
          externalDatabase={database}
          onDatabaseChange={setDatabase}
          onOpenRecord={setPanelRow}
        />
      ) : null}

      {activeView?.type === 'KANBAN' ? (
        <DatabaseKanban
          database={database}
          view={activeView}
          rows={rows}
          members={members}
          onRowsChange={setRows}
          onDatabaseChange={setDatabase}
          onOpenRecord={setPanelRow}
        />
      ) : null}

      {activeView?.type === 'CALENDAR' ? (
        <DatabaseCalendar
          database={database}
          view={activeView}
          rows={rows}
          undatedRows={undatedRows}
          undatedTotal={undatedTotal}
          cursor={calendarCursor}
          onCursorChange={setCalendarCursor}
          onRowsChange={setRows}
          onOpenRecord={setPanelRow}
          onReloadUndated={() => void reloadUndated()}
        />
      ) : null}

      <DatabaseRecordPanel
        open={Boolean(panelRow)}
        database={database}
        row={panelRow}
        members={members}
        onClose={() => setPanelRow(null)}
        onChanged={(row) => {
          setPanelRow(row);
          setRows((prev) => {
            const exists = prev.some((r) => r.id === row.id);
            return exists ? prev.map((r) => (r.id === row.id ? row : r)) : [...prev, row];
          });
        }}
        onDeleted={(rowId) => {
          setRows((prev) => prev.filter((r) => r.id !== rowId));
          setPanelRow(null);
        }}
      />
    </div>
  );
}

function FilterBar({
  properties,
  filters,
  sorts,
  onChange,
}: {
  properties: NonNullable<DatabaseDto['properties']>;
  filters: DatabaseFilter[];
  sorts: DatabaseSort[];
  onChange: (filters: DatabaseFilter[], sorts: DatabaseSort[]) => void;
}) {
  return (
    <div className="space-y-2 border border-[var(--ww-border)] bg-white/80 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ww-text-muted)]">
          Filtreler
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const prop = properties[0];
            if (!prop) return;
            onChange(
              [...filters, { propertyId: prop.id, operator: 'contains', value: '' }],
              sorts,
            );
          }}
        >
          + Filtre
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange([], sorts)}>
          Temizle
        </Button>
      </div>
      {filters.map((filter, index) => (
        <div key={`${filter.propertyId}-${index}`} className="flex flex-wrap gap-2">
          <select
            className="rounded border border-[var(--ww-border)] bg-white px-2 py-1 text-xs"
            value={filter.propertyId}
            onChange={(e) => {
              const next = [...filters];
              next[index] = { ...filter, propertyId: e.target.value };
              onChange(next, sorts);
            }}
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-[var(--ww-border)] bg-white px-2 py-1 text-xs"
            value={filter.operator}
            onChange={(e) => {
              const next = [...filters];
              next[index] = {
                ...filter,
                operator: e.target.value as DatabaseFilter['operator'],
              };
              onChange(next, sorts);
            }}
          >
            <option value="contains">içerir</option>
            <option value="equals">eşittir</option>
            <option value="is_empty">boş</option>
            <option value="is_not_empty">boş değil</option>
          </select>
          <input
            className="rounded border border-[var(--ww-border)] bg-white px-2 py-1 text-xs"
            value={typeof filter.value === 'string' ? filter.value : ''}
            onChange={(e) => {
              const next = [...filters];
              next[index] = { ...filter, value: e.target.value };
              onChange(next, sorts);
            }}
          />
          <button
            type="button"
            className="text-xs text-danger"
            onClick={() => onChange(filters.filter((_, i) => i !== index), sorts)}
          >
            Sil
          </button>
        </div>
      ))}
    </div>
  );
}
