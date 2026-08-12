export const projectStatusLabels: Record<string, string> = {
  ACTIVE: 'Aktif',
  ON_HOLD: 'Beklemede',
  COMPLETED: 'Tamamlandı',
  ARCHIVED: 'Arşiv',
};

export const taskStatusLabels: Record<string, string> = {
  TODO: 'Yapılacak',
  IN_PROGRESS: 'Devam ediyor',
  IN_REVIEW: 'İncelemede',
  DONE: 'Bitti',
  CANCELLED: 'İptal',
};

export const taskPriorityLabels: Record<string, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  URGENT: 'Acil',
};

export const roleLabels: Record<string, string> = {
  OWNER: 'Sahip',
  ADMIN: 'Yönetici',
  EDITOR: 'Editör',
  MEMBER: 'Üye',
  VIEWER: 'Görüntüleyici',
};

export function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/** Single-line schedule: "12 Ağu · 17:00" with full datetime for tooltip */
export function formatScheduleInline(value?: string | null): { inline: string; full: string } | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(d);
  const time = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(d);
  const full = new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return { inline: `${dayMonth} · ${time}`, full };
}

/** Two-line compact date for table cells: "12 Ağu 2026\n17:00" */
export function formatCompactDate(value?: string | null): { date: string; time: string } | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const date = new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return { date, time };
}

/** Relative label like "2 sa önce", "Dün" */
export function formatRelative(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const now = Date.now();
  const diff = now - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'Az önce';
  if (min < 60) return `${min} dk önce`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Dün';
  if (days < 7) return `${days} gün önce`;
  return formatDate(value);
}

export function fullName(user?: { firstName?: string; lastName?: string } | null) {
  if (!user) return '—';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—';
}
