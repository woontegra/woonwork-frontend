import { useEffect, useState } from 'react';
import { Button } from '../../components/social/SocialControls';
import { AlertCircle, Calendar, Check, Clock, FileText, Plus, Send } from 'lucide-react';
import { PageToolbar } from '../../components/ui/PageLoader';
import { useToast } from '../../components/ui/Toast';
import { formatCompactDate } from '../../lib/labels';
import {
  fetchOverview,
  statusLabels,
  platformShort,
  type SocialContentDto,
  type SocialOverview,
} from '../../lib/social';
import { useSocialWorkspace } from './SocialLayout';

/* ─── Dashboard card ─── */
function DashCard({
  icon,
  title,
  count,
  accent,
  items,
  onOpen,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  accent: string;
  items: SocialContentDto[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="rounded-[var(--ww-control-radius)] border border-[var(--ww-border)] bg-white">
      <div className="flex items-center gap-2 border-b border-[var(--ww-border)] px-3 py-2">
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-[4px] ${accent}`}>
          {icon}
        </span>
        <h3 className="text-[12px] font-semibold text-[var(--ww-text)]">{title}</h3>
        <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink-100 px-1 text-[10px] font-bold text-ink-500">
          {count}
        </span>
      </div>
      {items.length ? (
        <div className="divide-y divide-[var(--ww-border)]">
          {items.map((item) => {
            const sched = formatCompactDate(item.scheduledAt);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(item.id)}
                className="flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-ink-50/60"
              >
                <span className="w-[70px] shrink-0 whitespace-nowrap">
                  {sched ? (
                    <>
                      <span className="block text-[11px] text-[var(--ww-text)]">{sched.date}</span>
                      <span className="block text-[10px] text-ink-400">{sched.time}</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-ink-300">Plansız</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-[var(--ww-text)]">
                    {item.title || 'Adsız'}
                  </span>
                  <span className="block truncate text-[10px] text-ink-400">
                    {item.brand?.name ?? 'Markasız'} · {statusLabels[item.status]}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-0.5">
                  {item.destinations?.map((d) => (
                    <span
                      key={d.id}
                      className="inline-flex h-[16px] items-center rounded-[3px] bg-ink-50 px-1 text-[8px] font-semibold text-ink-500"
                    >
                      {platformShort[d.platform]}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="px-3 py-4 text-center text-[11px] text-ink-300">Kayıt yok</div>
      )}
    </section>
  );
}

export function SocialHubPage() {
  const { toast } = useToast();
  const { openComposer, bump } = useSocialWorkspace();
  const [data, setData] = useState<SocialOverview | null>(null);

  useEffect(() => {
    void fetchOverview()
      .then(setData)
      .catch((err) => toast((err as Error).message || 'Özet alınamadı', 'error'));
  }, [bump, toast]);

  const onOpen = (id: string) => openComposer({ contentId: id });

  return (
    <>
      <PageToolbar>
        <Button className="ml-auto" onClick={() => openComposer()}>
          <Plus size={13} strokeWidth={1.75} />
          Yeni İçerik
        </Button>
      </PageToolbar>

      {!data ? (
        <p className="text-[12px] text-ink-400">Yükleniyor…</p>
      ) : (
        <>
          {data.blockedHashtagWarningCount ? (
            <div className="mb-4 flex items-center gap-2 rounded-[var(--ww-control-radius)] border border-red-200/70 bg-red-50/50 px-3 py-2 text-[12px] text-red-800/80">
              <AlertCircle size={14} strokeWidth={1.75} />
              Blocklist uyarılı içerikler: {data.blockedHashtagWarningCount}
            </div>
          ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashCard
            icon={<Calendar size={12} />}
            title="Bugün Yayınlanacaklar"
            count={data.today.length}
            accent="bg-blue-50 text-blue-600"
            items={data.today}
            onOpen={onOpen}
          />
          <DashCard
            icon={<Clock size={12} />}
            title="Onay Bekleyenler"
            count={data.approval.length}
            accent="bg-amber-50 text-amber-600"
            items={data.approval}
            onOpen={onOpen}
          />
          <DashCard
            icon={<Send size={12} />}
            title="Yayına Hazır"
            count={data.readyToPublish.length}
            accent="bg-emerald-50 text-emerald-600"
            items={data.readyToPublish}
            onOpen={onOpen}
          />
          <DashCard
            icon={<AlertCircle size={12} />}
            title="Başarısız Yayınlar"
            count={data.failed.length}
            accent="bg-red-50 text-red-600"
            items={data.failed}
            onOpen={onOpen}
          />
          <DashCard
            icon={<FileText size={12} />}
            title="Taslaklar"
            count={data.drafts.length}
            accent="bg-ink-100 text-ink-500"
            items={data.drafts}
            onOpen={onOpen}
          />
          <DashCard
            icon={<Check size={12} />}
            title="Yaklaşan İçerikler"
            count={data.upcoming.filter(
              (item) =>
                !data.today.some((x) => x.id === item.id) &&
                !data.tomorrow?.some((x) => x.id === item.id),
            ).length}
            accent="bg-violet-50 text-violet-600"
            items={data.upcoming.filter(
              (item) =>
                !data.today.some((x) => x.id === item.id) &&
                !data.tomorrow?.some((x) => x.id === item.id),
            )}
            onOpen={onOpen}
          />
        </div>
        </>
      )}
    </>
  );
}
