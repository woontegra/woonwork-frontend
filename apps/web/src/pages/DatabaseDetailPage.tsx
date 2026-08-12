import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Table2 } from 'lucide-react';
import { notifyWorkspaceChanged } from '../lib/workspace';
import { getDatabase, updateDatabase, type DatabaseDto } from '../lib/database';
import { useToast } from '../components/ui/Toast';
import { DatabaseWorkspace } from '../components/database/DatabaseWorkspace';
import { PageCanvas, Skeleton } from '../components/ui/PageLoader';
import { ContentAccessActions } from '../components/library/ContentAccessActions';

export function DatabaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [database, setDatabase] = useState<DatabaseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const db = await getDatabase(id);
      setDatabase(db);
      setName(db.name);
    } catch (err) {
      toast((err as Error).message || 'Tablo yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveName() {
    if (!id || !database || name.trim() === database.name) return;
    try {
      const updated = await updateDatabase(id, { name: name.trim() });
      setDatabase(updated);
    } catch (err) {
      setName(database.name);
      toast((err as Error).message || 'Ad güncellenemedi', 'error');
    }
  }

  if (loading) {
    return (
      <PageCanvas mode="DATA_WIDE">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </PageCanvas>
    );
  }

  if (!database || !id) {
    return (
      <PageCanvas mode="DATA_WIDE">
        <p className="text-sm text-[var(--ww-text-muted)]">Akıllı tablo bulunamadı</p>
      </PageCanvas>
    );
  }

  return (
    <PageCanvas mode="DATA_WIDE">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <nav className="flex flex-wrap items-center gap-1 text-xs font-medium text-[var(--ww-text-muted)]">
              <Link
                to="/kutuphane"
                className="inline-flex items-center gap-1 hover:text-[var(--ww-text)]"
              >
                <ChevronLeft size={14} />
                Kütüphane
              </Link>
              <span>/</span>
              {database.workspaceArea ? (
                <Link
                  to={`/alanlar/${database.workspaceArea.id}`}
                  className="hover:text-[var(--ww-text)]"
                >
                  {database.workspaceArea.name}
                </Link>
              ) : (
                <Link to="/kutuphane?view=private" className="hover:text-[var(--ww-text)]">
                  Özel
                </Link>
              )}
            </nav>
            <div className="flex items-center gap-2">
              <Table2 size={22} className="text-[var(--ww-text-muted)]" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => void saveName()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="w-full border-0 bg-transparent text-3xl font-semibold tracking-tight text-[var(--ww-text)] outline-none"
              />
            </div>
            {database.description ? (
              <p className="text-sm text-[var(--ww-text-muted)]">{database.description}</p>
            ) : null}
          </div>
          <ContentAccessActions
            resourceType="DATABASE"
            resourceId={database.id}
            areaId={database.workspaceAreaId}
            areaName={database.workspaceArea?.name}
            onMoved={() => {
              notifyWorkspaceChanged();
              void load();
            }}
          />
        </div>
      </div>
      <DatabaseWorkspace databaseId={id} />
    </PageCanvas>
  );
}
