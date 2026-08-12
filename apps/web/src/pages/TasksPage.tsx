import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { MemberDto, ProjectDto, TaskDto } from '../types';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../components/ui/Toast';
import { EmptyState, PageCanvas, PageHeader, PageToolbar, Skeleton } from '../components/ui/PageLoader';
import {
  Button,
  Input,
  PriorityMark,
  Select,
  StatusChip,
  TextArea,
} from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';
import {
  formatDate,
  fullName,
  taskPriorityLabels,
  taskStatusLabels,
} from '../lib/labels';

const statuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function statusTone(status: string) {
  if (status === 'DONE') return 'green' as const;
  if (status === 'IN_PROGRESS') return 'blue' as const;
  if (status === 'IN_REVIEW') return 'amber' as const;
  if (status === 'CANCELLED') return 'rose' as const;
  return 'neutral' as const;
}

export function TasksPage() {
  const { activeTenant } = useTenant();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', priority: '', projectId: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    projectId: '',
    assigneeId: '',
    dueDate: '',
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.projectId) params.set('projectId', filters.projectId);

      const [taskData, projectData, memberData] = await Promise.all([
        apiRequest<TaskDto[]>(`/tasks?${params.toString()}`),
        apiRequest<ProjectDto[]>('/projects'),
        apiRequest<MemberDto[]>(`/tenants/${activeTenant.id}/members`),
      ]);
      setTasks(taskData);
      setProjects(projectData);
      setMembers(memberData);
    } catch (err) {
      toast((err as Error).message || 'Görevler yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenant, filters.status, filters.priority, filters.projectId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/tasks', {
        method: 'POST',
        body: {
          title: form.title,
          description: form.description || null,
          status: form.status,
          priority: form.priority,
          projectId: form.projectId || null,
          assigneeId: form.assigneeId || null,
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        },
      });
      setModalOpen(false);
      setForm({
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        projectId: '',
        assigneeId: '',
        dueDate: '',
      });
      await load();
    } catch (err) {
      toast((err as Error).message || 'Görev oluşturulamadı', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(task: TaskDto) {
    if (!window.confirm(`“${task.title}” görevini silmek istiyor musunuz?`)) return;
    try {
      await apiRequest(`/tasks/${task.id}`, { method: 'DELETE' });
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      toast((err as Error).message || 'Silinemedi', 'error');
    }
  }

  async function toggleDone(task: TaskDto) {
    const next = task.status === 'DONE' ? 'TODO' : 'DONE';
    setCompletingId(task.id);
    const snapshot = tasks;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    try {
      await apiRequest(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: { status: next },
      });
    } catch (err) {
      setTasks(snapshot);
      toast((err as Error).message || 'Durum güncellenemedi', 'error');
    } finally {
      window.setTimeout(() => setCompletingId(null), 280);
    }
  }

  return (
    <PageCanvas mode="DATA_WIDE">
      <PageHeader hideTitle description="Günün işleri — filtrele, tamamla, ilerle" />

      <PageToolbar>
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ww-text-muted)]">
          Filtre
        </span>
        <Select
          size="sm"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="w-full sm:w-[148px]"
        >
          <option value="">Durum: Tümü</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {taskStatusLabels[s]}
            </option>
          ))}
        </Select>
        <Select
          size="sm"
          value={filters.priority}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
          className="w-full sm:w-[148px]"
        >
          <option value="">Öncelik: Tümü</option>
          {priorities.map((p) => (
            <option key={p} value={p}>
              {taskPriorityLabels[p]}
            </option>
          ))}
        </Select>
        <Select
          size="sm"
          value={filters.projectId}
          onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value }))}
          className="w-full sm:w-[168px]"
        >
          <option value="">Proje: Tümü</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Button className="ml-auto" onClick={() => setModalOpen(true)}>
          <Plus size={14} strokeWidth={1.75} />
          Yeni Görev
        </Button>
      </PageToolbar>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !tasks.length ? (
        <EmptyState
          title="Görev bulunamadı"
          description="Yeni bir görev ekleyerek takip etmeye başlayın."
          action={
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={14} strokeWidth={1.75} />
              Yeni Görev
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto border border-[var(--ww-border)] bg-white">
          <table className="ww-table min-w-[980px]">
            <thead className="sticky top-0 z-[1]">
              <tr>
                <th className="w-10" />
                <th>Görev</th>
                <th>Durum</th>
                <th>Öncelik</th>
                <th>Proje</th>
                <th>Sorumlu</th>
                <th>Son Tarih</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {tasks.map((task) => (
                  <motion.tr
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{
                      opacity: completingId === task.id ? 0.55 : 1,
                      y: 0,
                      scale: completingId === task.id ? 0.995 : 1,
                    }}
                    exit={{ opacity: 0, height: 0 }}
                    className="group last:border-0 hover:bg-ink-50/40"
                  >
                    <td>
                      <button
                        type="button"
                        aria-label="Tamamlandı olarak işaretle"
                        onClick={() => void toggleDone(task)}
                        className={`flex h-4 w-4 items-center justify-center rounded-[3px] border transition ${
                          task.status === 'DONE'
                            ? 'border-success bg-success text-white'
                            : 'border-ink-300 hover:border-accent'
                        }`}
                      >
                        {task.status === 'DONE' ? (
                          <motion.svg
                            viewBox="0 0 12 12"
                            className="h-2.5 w-2.5"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                          >
                            <motion.path
                              d="M2.5 6.2 L4.8 8.5 L9.5 3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.22 }}
                            />
                          </motion.svg>
                        ) : null}
                      </button>
                    </td>
                    <td>
                      <span
                        className={`font-medium tracking-tight ${
                          task.status === 'DONE'
                            ? 'text-[var(--ww-text-muted)] line-through'
                            : 'text-[var(--ww-text)]'
                        }`}
                      >
                        {task.title}
                      </span>
                    </td>
                    <td>
                      <StatusChip
                        label={taskStatusLabels[task.status]}
                        tone={statusTone(task.status)}
                      />
                    </td>
                    <td>
                      <PriorityMark
                        label={taskPriorityLabels[task.priority]}
                        level={task.priority}
                      />
                    </td>
                    <td className="text-[var(--ww-text-secondary)]">
                      {task.project?.name ?? '—'}
                    </td>
                    <td className="text-[var(--ww-text-secondary)]">
                      {fullName(task.assignee)}
                    </td>
                    <td className="text-[var(--ww-text-muted)]">
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="relative text-right">
                      <button
                        type="button"
                        className="rounded p-1 text-[var(--ww-text-muted)] opacity-0 transition hover:bg-ink-50 group-hover:opacity-100"
                        aria-label="İşlemler"
                        onClick={() => setRowMenu((v) => (v === task.id ? null : task.id))}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                      {rowMenu === task.id ? (
                        <div className="absolute right-2 top-9 z-10 w-32 overflow-hidden rounded-[var(--ww-radius-md)] border border-[var(--ww-border)] bg-white p-1 shadow-[var(--ww-shadow-float)]">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-danger hover:bg-danger-soft"
                            onClick={() => {
                              setRowMenu(null);
                              void onDelete(task);
                            }}
                          >
                            <Trash2 size={12} />
                            Sil
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Yeni Görev" wide>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Başlık"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <TextArea
            label="Açıklama"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Durum"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {taskStatusLabels[s]}
                </option>
              ))}
            </Select>
            <Select
              label="Öncelik"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {taskPriorityLabels[p]}
                </option>
              ))}
            </Select>
            <Select
              label="Proje"
              value={form.projectId}
              onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
            >
              <option value="">Projesiz</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select
              label="Sorumlu"
              value={form.assigneeId}
              onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))}
            >
              <option value="">Atanmamış</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {fullName(m.user)}
                </option>
              ))}
            </Select>
            <Input
              label="Son tarih"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Oluştur'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageCanvas>
  );
}
