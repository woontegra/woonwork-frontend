import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { TaskDto } from '../types';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../components/ui/Toast';
import { EmptyState, PageCanvas, PageHeader, Skeleton } from '../components/ui/PageLoader';
import { Button, PriorityMark } from '../components/ui/Form';
import { taskPriorityLabels } from '../lib/labels';

const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarPage() {
  const { activeTenant } = useTenant();
  const { toast } = useToast();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTenant) return;
    let cancelled = false;
    setLoading(true);
    apiRequest<TaskDto[]>('/tasks')
      .then((data) => {
        if (!cancelled) setTasks(data.filter((t) => t.dueDate));
      })
      .catch((err) => toast(err.message || 'Takvim yüklenemedi', 'error'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenant, toast]);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    });
  }, [cursor]);

  const monthLabel = new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
  }).format(cursor);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = new Date(task.dueDate).toDateString();
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  if (loading) {
    return (
      <PageCanvas mode="DATA_WIDE">
        <Skeleton className="h-[560px] w-full" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas mode="DATA_WIDE">
      <PageHeader
        hideTitle
        description="Son tarihli işler · aylık görünüm"
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Önceki ay"
              onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const now = new Date();
                setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
            >
              Bugün
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Sonraki ay"
              onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        }
      />

      <p className="text-sm font-semibold capitalize tracking-tight text-[var(--ww-text)]">
        {monthLabel}
      </p>

      {!tasks.length ? (
        <EmptyState
          title="Takvimde gösterilecek görev yok"
          description="Son tarihi olan görevler aylık görünümde burada yer alır."
        />
      ) : null}

      <div className="overflow-hidden border border-[var(--ww-border)] bg-white">
        <div className="grid grid-cols-7 border-b border-[var(--ww-border)] bg-[#f8f9fb]">
          {weekDays.map((d) => (
            <div
              key={d}
              className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ww-text-muted)]"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = day.getMonth() === cursor.getMonth();
            const isToday = sameDay(day, new Date());
            const dayTasks = tasksByDay.get(day.toDateString()) ?? [];
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[118px] border-b border-r border-[var(--ww-border)] p-2 ${
                  inMonth ? 'bg-white' : 'bg-canvas/70'
                }`}
              >
                <div
                  className={`mb-2 inline-flex h-7 min-w-7 items-center justify-center px-1.5 text-xs font-semibold ${
                    isToday
                      ? 'bg-accent text-white'
                      : inMonth
                        ? 'text-[var(--ww-text)]'
                        : 'text-[var(--ww-text-muted)]'
                  }`}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="border-l-2 border-accent bg-accent-soft/70 px-1.5 py-1"
                      title={task.title}
                    >
                      <p className="truncate text-[10px] font-semibold text-[var(--ww-text)]">
                        {task.title}
                      </p>
                      <p className="truncate text-[9px] text-[var(--ww-text-muted)]">
                        {taskPriorityLabels[task.priority]}
                        {task.status ? ` · ${task.status}` : ''}
                      </p>
                    </div>
                  ))}
                  {dayTasks.length > 3 ? (
                    <p className="text-[10px] text-[var(--ww-text-muted)]">
                      +{dayTasks.length - 3} daha
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {tasks.length ? (
        <div className="border border-[var(--ww-border)] bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--ww-text)]">Bu ayın görevleri</h3>
          <ul className="space-y-2">
            {tasks
              .filter((t) => {
                if (!t.dueDate) return false;
                const d = new Date(t.dueDate);
                return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
              })
              .map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-[var(--ww-text)]">{task.title}</span>
                  <PriorityMark
                    label={taskPriorityLabels[task.priority]}
                    level={task.priority}
                  />
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </PageCanvas>
  );
}
