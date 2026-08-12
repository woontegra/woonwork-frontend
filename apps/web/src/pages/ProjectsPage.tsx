import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { ProjectDto } from '../types';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../components/ui/Toast';
import { EmptyState, PageCanvas, PageHeader, PageToolbar, Skeleton } from '../components/ui/PageLoader';
import { Button, Input, SearchInput, Select, StatusChip, TextArea } from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';
import { formatDate, projectStatusLabels } from '../lib/labels';
import { ContentAccessActions } from '../components/library/ContentAccessActions';

const statuses = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];

export function ProjectsPage() {
  const { activeTenant } = useTenant();
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectDto | null>(null);
  const [form, setForm] = useState({ name: '', description: '', status: 'ACTIVE' });
  const [saving, setSaving] = useState(false);
  const [accessProject, setAccessProject] = useState<ProjectDto | null>(null);

  async function load() {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (qDebounced) params.set('q', qDebounced);
      if (status) params.set('status', status);
      const data = await apiRequest<ProjectDto[]>(`/projects?${params.toString()}`);
      setProjects(data);
    } catch (err) {
      toast((err as Error).message || 'Projeler yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setQDebounced(q), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenant, status, qDebounced]);

  const filteredHint = useMemo(() => `${projects.length} proje`, [projects.length]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '', status: 'ACTIVE' });
    setModalOpen(true);
  }

  function openEdit(project: ProjectDto) {
    setEditing(project);
    setForm({
      name: project.name,
      description: project.description ?? '',
      status: project.status,
    });
    setModalOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await apiRequest(`/projects/${editing.id}`, {
          method: 'PATCH',
          body: {
            name: form.name,
            description: form.description || null,
            status: form.status,
          },
        });
        toast('Proje güncellendi', 'success');
      } else {
        await apiRequest('/projects', {
          method: 'POST',
          body: {
            name: form.name,
            description: form.description || null,
            status: form.status,
          },
        });
        toast('Proje oluşturuldu', 'success');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast((err as Error).message || 'Kayıt başarısız', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(project: ProjectDto) {
    if (!window.confirm(`“${project.name}” projesini silmek istiyor musunuz?`)) return;
    try {
      await apiRequest(`/projects/${project.id}`, { method: 'DELETE' });
      toast('Proje silindi', 'success');
      await load();
    } catch (err) {
      toast((err as Error).message || 'Silinemedi', 'error');
    }
  }

  return (
    <PageCanvas mode="DATA_WIDE">
      <PageHeader hideTitle description={`${filteredHint} · çalışma alanınız`} />

      <PageToolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Proje ara..." size="sm" />
        <Select
          size="sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full sm:w-[168px]"
        >
          <option value="">Durum: Tümü</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {projectStatusLabels[s]}
            </option>
          ))}
        </Select>
        <Button className="ml-auto" onClick={openCreate}>
          <Plus size={14} strokeWidth={1.75} />
          Yeni Proje
        </Button>
      </PageToolbar>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : !projects.length ? (
        <EmptyState
          title="Proje bulunamadı"
          description="Yeni bir proje oluşturarak ekibinizle çalışmaya başlayın."
          action={
            <Button onClick={openCreate}>
              <Plus size={14} strokeWidth={1.75} />
              Yeni Proje
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          <AnimatePresence>
            {projects.map((project, i) => (
              <motion.article
                key={project.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ y: -2 }}
                className="group border border-[var(--ww-border)] bg-white p-4 transition hover:border-accent/25 hover:shadow-[var(--ww-shadow-sm)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold tracking-tight text-[var(--ww-text)]">
                      <Link to={`/projeler/${project.id}`} className="hover:underline">
                        {project.name}
                      </Link>
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--ww-text-muted)]">
                      {project.description || 'Açıklama yok'}
                    </p>
                  </div>
                  <StatusChip
                    label={projectStatusLabels[project.status]}
                    tone={project.status === 'ACTIVE' ? 'blue' : 'neutral'}
                  />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--ww-border)] pt-3">
                  <p className="text-xs text-[var(--ww-text-secondary)]">
                    <span className="font-semibold text-[var(--ww-text)]">
                      {project._count?.tasks ?? 0}
                    </span>{' '}
                    görev · {formatDate(project.updatedAt)}
                  </p>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setAccessProject(project)}
                      className="rounded px-1.5 py-1 text-[11px] font-medium text-[var(--ww-text-muted)] hover:bg-ink-50 hover:text-[var(--ww-text)]"
                    >
                      Paylaş
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(project)}
                      className="rounded p-1.5 text-[var(--ww-text-muted)] hover:bg-ink-50 hover:text-[var(--ww-text)]"
                      aria-label="Düzenle"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(project)}
                      className="rounded p-1.5 text-[var(--ww-text-muted)] hover:bg-danger-soft hover:text-danger"
                      aria-label="Sil"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}

      {accessProject ? (
        <div className="fixed bottom-4 right-4 z-40 max-w-md border border-[var(--ww-border)] bg-white p-3 shadow-[var(--ww-shadow-md)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-[var(--ww-text)]">
              {accessProject.name}
            </p>
            <button
              type="button"
              className="text-xs text-[var(--ww-text-muted)] hover:text-[var(--ww-text)]"
              onClick={() => setAccessProject(null)}
            >
              Kapat
            </button>
          </div>
          <ContentAccessActions
            resourceType="PROJECT"
            resourceId={accessProject.id}
            areaId={accessProject.workspaceAreaId}
            areaName={accessProject.workspaceArea?.name}
            onMoved={() => {
              setAccessProject(null);
              void load();
            }}
          />
        </div>
      ) : null}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Projeyi Düzenle' : 'Yeni Proje'}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Proje adı"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextArea
            label="Açıklama"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Select
            label="Durum"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {projectStatusLabels[s]}
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageCanvas>
  );
}
