import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import type { ProjectDto, TaskDto } from '../types';
import { PageCanvas, Skeleton } from '../components/ui/PageLoader';
import { ContentAccessActions } from '../components/library/ContentAccessActions';
import { useToast } from '../components/ui/Toast';
import { formatDate, projectStatusLabels, taskPriorityLabels, taskStatusLabels } from '../lib/labels';
import { notifyWorkspaceChanged } from '../lib/workspace';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [p, t] = await Promise.all([
        apiRequest<ProjectDto>(`/projects/${id}`),
        apiRequest<TaskDto[]>(`/tasks?projectId=${id}`),
      ]);
      setProject(p);
      setName(p.name);
      setTasks(t);
    } catch (err) {
      toast((err as Error).message || 'Proje yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveName() {
    if (!id || !project || name.trim() === project.name) return;
    try {
      const updated = await apiRequest<ProjectDto>(`/projects/${id}`, {
        method: 'PATCH',
        body: { name: name.trim() },
      });
      setProject(updated);
      notifyWorkspaceChanged();
    } catch (err) {
      setName(project.name);
      toast((err as Error).message || 'Ad güncellenemedi', 'error');
    }
  }

  if (loading) {
    return (
      <PageCanvas mode="WORKSPACE_WIDE">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </PageCanvas>
    );
  }

  if (!project) {
    return (
      <PageCanvas mode="WORKSPACE_WIDE">
        <p className="text-sm text-[var(--ww-text-muted)]">Proje bulunamadı</p>
      </PageCanvas>
    );
  }

  return (
    <PageCanvas mode="WORKSPACE_WIDE">
      <nav className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--ww-text-muted)]">
        {project.workspaceArea ? (
          <Link to={`/alanlar/${project.workspaceArea.id}`} className="hover:text-[var(--ww-text)]">
            {project.workspaceArea.name}
          </Link>
        ) : (
          <Link to="/kutuphane?view=private" className="hover:text-[var(--ww-text)]">
            Özel
          </Link>
        )}
        <span>/</span>
        <span className="text-[var(--ww-text)]">{project.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void saveName()}
            className="w-full bg-transparent text-[1.75rem] font-semibold tracking-tight outline-none"
          />
          {project.description ? (
            <p className="mt-1 text-sm text-[var(--ww-text-secondary)]">{project.description}</p>
          ) : null}
          <p className="mt-2 text-[12px] text-[var(--ww-text-muted)]">
            {projectStatusLabels[project.status] ?? project.status} · {project._count?.tasks ?? tasks.length}{' '}
            görev
          </p>
        </div>
        <ContentAccessActions
          resourceType="PROJECT"
          resourceId={project.id}
          areaId={project.workspaceAreaId}
          areaName={project.workspaceArea?.name}
          onMoved={() => {
            notifyWorkspaceChanged();
            void load();
          }}
        />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ww-text-muted)]">
            Görevler
          </h2>
          <Link to="/gorevler" className="text-[12px] text-accent-strong hover:underline">
            Görevler
          </Link>
        </div>
        {!tasks.length ? (
          <p className="border border-dashed border-[var(--ww-border)] px-3 py-6 text-sm text-[var(--ww-text-muted)]">
            Bu projede henüz görev yok.
          </p>
        ) : (
          <div className="divide-y divide-[var(--ww-border)] border border-[var(--ww-border)] bg-white">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{task.title}</p>
                  <p className="text-[11px] text-[var(--ww-text-muted)]">
                    {taskStatusLabels[task.status] ?? task.status}
                    {task.dueDate ? ` · ${formatDate(task.dueDate)}` : ''}
                  </p>
                </div>
                <span className="text-[11px] text-[var(--ww-text-muted)]">
                  {taskPriorityLabels[task.priority] ?? task.priority}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageCanvas>
  );
}
