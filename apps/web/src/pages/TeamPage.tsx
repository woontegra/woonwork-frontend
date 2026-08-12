import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiRequest } from '../lib/api';
import type { MemberDto } from '../types';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../components/ui/Toast';
import { EmptyState, PageCanvas, PageHeader, Skeleton } from '../components/ui/PageLoader';
import { StatusChip } from '../components/ui/Form';
import { formatDate, fullName, roleLabels } from '../lib/labels';

export function TeamPage() {
  const { activeTenant } = useTenant();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTenant) return;
    let cancelled = false;
    setLoading(true);
    apiRequest<MemberDto[]>(`/tenants/${activeTenant.id}/members`)
      .then((data) => {
        if (!cancelled) setMembers(data);
      })
      .catch((err) => toast(err.message || 'Ekip yüklenemedi', 'error'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenant, toast]);

  if (loading) {
    return (
      <PageCanvas mode="DATA_WIDE">
        <Skeleton className="h-10 w-48" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </PageCanvas>
    );
  }

  return (
    <PageCanvas mode="DATA_WIDE">
      <PageHeader
        hideTitle
        description={`${members.length} üye · ${activeTenant?.name ?? 'çalışma alanı'}`}
      />

      {!members.length ? (
        <EmptyState title="Üye bulunamadı" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {members.map((member, i) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 border border-[var(--ww-border)] bg-white px-3 py-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-ink-900 text-xs font-semibold text-white">
                {(member.user.firstName?.[0] || '?').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--ww-text)]">
                  {fullName(member.user)}
                </p>
                <p className="truncate text-xs text-[var(--ww-text-muted)]">{member.user.email}</p>
                <p className="mt-1 text-[10px] text-[var(--ww-text-muted)]">
                  Katılım {formatDate(member.createdAt)}
                </p>
              </div>
              <StatusChip
                label={roleLabels[member.role] ?? member.role}
                tone={member.role === 'OWNER' || member.role === 'ADMIN' ? 'blue' : 'neutral'}
              />
            </motion.div>
          ))}
        </div>
      )}
    </PageCanvas>
  );
}
