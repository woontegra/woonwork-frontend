import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import type { DashboardDto } from '../types';
import { PageCanvas, PageHeader, Skeleton } from '../components/ui/PageLoader';
import { formatDate, taskPriorityLabels } from '../lib/labels';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { listFavorites, listRecents, listAreas, type FavoriteDto, type RecentDto, type WorkspaceAreaDto } from '../lib/library';
import { resourceHref } from '../lib/library';

export function DashboardPage() {
  const { activeTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<DashboardDto | null>(null);
  const [favorites, setFavorites] = useState<FavoriteDto[]>([]);
  const [recents, setRecents] = useState<RecentDto[]>([]);
  const [areas, setAreas] = useState<WorkspaceAreaDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTenant) return;
    setLoading(true);
    void Promise.all([
      apiRequest<DashboardDto>('/dashboard'),
      listFavorites(8),
      listRecents(8),
      listAreas(),
    ])
      .then(([dash, favs, rec, ar]) => {
        setData(dash);
        setFavorites(favs);
        setRecents(rec);
        setAreas(ar);
      })
      .catch((err) => toast((err as Error).message || 'Yüklenemedi', 'error'))
      .finally(() => setLoading(false));
  }, [activeTenant, toast]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
  }, []);

  if (loading) {
    return (
      <PageCanvas mode="WORKSPACE_WIDE">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas mode="WORKSPACE_WIDE">
      <PageHeader
        title={`${greeting}, ${user?.firstName || 'ekip'}`}
        description="Çalışma alanınıza devam edin."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div className="space-y-4">
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ww-text-muted)]">
              Son çalışmalar
            </h2>
            {!recents.length && !data?.recentPages.length ? (
              <p className="text-sm text-[var(--ww-text-muted)]">Henüz son çalışma yok.</p>
            ) : (
              <div className="divide-y divide-[var(--ww-border)] border border-[var(--ww-border)] bg-white">
                {(recents.length
                  ? recents.map((item) => ({
                      id: item.resourceId,
                      href: item.href,
                      name: item.name,
                      icon: item.icon,
                    }))
                  : (data?.recentPages ?? []).map((p) => ({
                      id: p.id,
                      href: `/notlar/${p.id}`,
                      name: p.title,
                      icon: p.icon,
                    }))
                ).map((item) => (
                  <Link
                    key={item.id}
                    to={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-ink-50/60"
                  >
                    <span className="w-5 text-center text-[13px]">{item.icon || '·'}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ww-text-muted)]">
              Bugünkü işler
            </h2>
            {!data?.upcomingTasks.length ? (
              <p className="text-sm text-[var(--ww-text-muted)]">Yaklaşan görev yok.</p>
            ) : (
              <div className="divide-y divide-[var(--ww-border)] border border-[var(--ww-border)] bg-white">
                {data.upcomingTasks.map((task) => (
                  <Link
                    key={task.id}
                    to="/gorevler"
                    className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-ink-50/60"
                  >
                    <span>
                      <span className="block text-[13px] font-medium">{task.title}</span>
                      <span className="text-[11px] text-[var(--ww-text-muted)]">
                        {task.project?.name ?? 'Projesiz'} · {formatDate(task.dueDate)}
                      </span>
                    </span>
                    <span className="text-[11px] text-[var(--ww-text-muted)]">
                      {taskPriorityLabels[task.priority] ?? task.priority}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ww-text-muted)]">
              Favoriler
            </h2>
            {!favorites.length ? (
              <p className="text-sm text-[var(--ww-text-muted)]">Favori yok.</p>
            ) : (
              <div className="divide-y divide-[var(--ww-border)] border border-[var(--ww-border)] bg-white">
                {favorites.map((fav) => (
                  <Link
                    key={fav.id}
                    to={fav.href || resourceHref(fav.resourceType, fav.resourceId)}
                    className="flex items-center gap-2 px-3 py-2.5 text-[13px] hover:bg-ink-50/60"
                  >
                    <span>{fav.icon || '·'}</span>
                    <span className="truncate font-medium">{fav.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ww-text-muted)]">
              Alanlar
            </h2>
            {!areas.length ? (
              <p className="text-sm text-[var(--ww-text-muted)]">Henüz alan yok.</p>
            ) : (
              <div className="divide-y divide-[var(--ww-border)] border border-[var(--ww-border)] bg-white">
                {areas.map((area) => (
                  <Link
                    key={area.id}
                    to={`/alanlar/${area.id}`}
                    className="flex items-center gap-2 px-3 py-2.5 text-[13px] hover:bg-ink-50/60"
                  >
                    <span>{area.icon || '·'}</span>
                    <span className="truncate font-medium">{area.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </PageCanvas>
  );
}
