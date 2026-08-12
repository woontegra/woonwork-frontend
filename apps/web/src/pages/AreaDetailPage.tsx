import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, FileText, FolderKanban, Plus, Table2, Users } from 'lucide-react';
import type { WorkspaceAreaRole } from '@woonwork/shared';
import { PageCanvas, Skeleton, EmptyState } from '../components/ui/PageLoader';
import { Button, Select } from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { useTenant } from '../contexts/TenantContext';
import { formatDate, fullName } from '../lib/labels';
import {
  areaRoleLabel,
  getArea,
  getAreaContents,
  removeAreaMember,
  upsertAreaMember,
  visibilityLabel,
  type WorkspaceAreaDto,
} from '../lib/library';
import { apiRequest } from '../lib/api';
import { notifyWorkspaceChanged } from '../lib/workspace';
import { listBrands } from '../lib/social';
import { createDatabase, listTenantMembers, type TenantMemberOption } from '../lib/database';
import type { PageDto, ProjectDto } from '../types';

type Tab = 'icerikler' | 'uyeler';

export function AreaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { activeTenant } = useTenant();
  const [area, setArea] = useState<WorkspaceAreaDto | null>(null);
  const [contents, setContents] = useState<Awaited<ReturnType<typeof getAreaContents>> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('icerikler');
  const [memberOpen, setMemberOpen] = useState(false);
  const [members, setMembers] = useState<TenantMemberOption[]>([]);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState<WorkspaceAreaRole>('MEMBER');
  const [hasSocial, setHasSocial] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [a, c, brands] = await Promise.all([getArea(id), getAreaContents(id), listBrands(true)]);
      setArea(a);
      setContents(c);
      setHasSocial(brands.some((b) => b.workspaceAreaId === id));
    } catch (err) {
      toast((err as Error).message || 'Alan yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createInArea(kind: 'page' | 'database' | 'project') {
    if (!id) return;
    try {
      if (kind === 'page') {
        const page = await apiRequest<PageDto>('/pages', {
          method: 'POST',
          body: { title: 'Adsız sayfa', workspaceAreaId: id },
        });
        notifyWorkspaceChanged();
        navigate(`/notlar/${page.id}`);
      } else if (kind === 'database') {
        const db = await createDatabase({ name: 'Yeni Tablo', workspaceAreaId: id });
        notifyWorkspaceChanged();
        navigate(`/tablolar/${db.id}`);
      } else {
        const project = await apiRequest<ProjectDto>('/projects', {
          method: 'POST',
          body: { name: 'Yeni Proje', workspaceAreaId: id },
        });
        notifyWorkspaceChanged();
        navigate(`/projeler/${project.id}`);
      }
    } catch (err) {
      toast((err as Error).message || 'Oluşturulamadı', 'error');
    }
  }

  async function openAddMember() {
    if (!activeTenant) return;
    setMemberOpen(true);
    try {
      setMembers(await listTenantMembers(activeTenant.id));
    } catch {
      setMembers([]);
    }
  }

  if (loading || !area) {
    return (
      <PageCanvas mode="WORKSPACE_WIDE">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </PageCanvas>
    );
  }

  const rows = [
    ...(contents?.pages ?? []).map((p) => ({
      id: p.id,
      type: 'PAGE' as const,
      name: p.title,
      icon: p.icon,
      href: `/notlar/${p.id}`,
      updatedAt: p.updatedAt,
      owner: p.createdBy,
    })),
    ...(contents?.databases ?? []).map((d) => ({
      id: d.id,
      type: 'DATABASE' as const,
      name: d.name,
      icon: null as string | null,
      href: `/tablolar/${d.id}`,
      updatedAt: d.updatedAt,
      owner: d.createdBy,
    })),
    ...(contents?.projects ?? []).map((p) => ({
      id: p.id,
      type: 'PROJECT' as const,
      name: p.name,
      icon: null as string | null,
      href: `/projeler/${p.id}`,
      updatedAt: p.updatedAt,
      owner: p.createdBy,
    })),
  ].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

  return (
    <PageCanvas mode="WORKSPACE_WIDE">
      <div className="space-y-1">
        <Link
          to="/kutuphane?view=areas"
          className="inline-flex items-center gap-1 text-xs text-[var(--ww-text-muted)] hover:text-[var(--ww-text)]"
        >
          <ChevronLeft size={14} />
          Alanlar
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ww-text)]">
              {area.icon ? `${area.icon} ` : ''}
              {area.name}
            </h1>
            {area.description ? (
              <p className="mt-1 text-sm text-[var(--ww-text-muted)]">{area.description}</p>
            ) : null}
            <p className="mt-2 text-xs text-[var(--ww-text-muted)]">
              {visibilityLabel(area.visibility)} · {area._count?.members ?? 0} üye
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => void createInArea('page')}>
              <Plus size={14} /> Sayfa
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void createInArea('database')}
            >
              <Plus size={14} /> Tablo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void createInArea('project')}
            >
              <Plus size={14} /> Proje
            </Button>
            {hasSocial ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => navigate('/sosyal-medya')}>
                Sosyal Medya
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex gap-1">
        {(
          [
            ['icerikler', 'İçerikler'],
            ['uyeler', 'Üyeler'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-[6px] px-2.5 py-1.5 text-xs font-medium ${
              tab === key ? 'bg-ink-950 text-white' : 'text-[var(--ww-text-secondary)] hover:bg-ink-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'icerikler' ? (
        !rows.length ? (
          <EmptyState title="Bu alanda henüz içerik yok" />
        ) : (
          <div className="overflow-hidden border border-[var(--ww-border)] bg-white">
            {rows.map((row) => (
              <Link
                key={`${row.type}-${row.id}`}
                to={row.href}
                className="flex items-center gap-3 border-b border-[var(--ww-border)] px-4 py-3 last:border-0 hover:bg-accent-soft/35"
              >
                {row.type === 'DATABASE' ? (
                  <Table2 size={14} className="text-[var(--ww-text-muted)]" />
                ) : row.type === 'PROJECT' ? (
                  <FolderKanban size={14} className="text-[var(--ww-text-muted)]" />
                ) : (
                  <FileText size={14} className="text-[var(--ww-text-muted)]" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {row.icon ? `${row.icon} ` : ''}
                  {row.name}
                </span>
                <span className="text-xs text-[var(--ww-text-muted)]">
                  {formatDate(row.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => void openAddMember()}>
              <Users size={14} /> Üye Ekle
            </Button>
          </div>
          <div className="overflow-hidden border border-[var(--ww-border)] bg-white">
            {(area.members ?? []).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--ww-border)] px-4 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{fullName(m.user)}</p>
                  <p className="truncate text-xs text-[var(--ww-text-muted)]">{m.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--ww-text-secondary)]">
                    {areaRoleLabel(m.role)}
                  </span>
                  {m.role !== 'OWNER' ? (
                    <button
                      type="button"
                      className="text-xs text-danger"
                      onClick={() =>
                        void removeAreaMember(area.id, m.userId)
                          .then(() => load())
                          .catch((err) => toast((err as Error).message, 'error'))
                      }
                    >
                      Kaldır
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={memberOpen} onClose={() => setMemberOpen(false)} title="Üye Ekle">
        <div className="space-y-4">
          <Select label="Üye" value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)}>
            <option value="">Seçin</option>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {fullName(m.user)} ({m.user.email})
              </option>
            ))}
          </Select>
          <Select
            label="Rol"
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value as WorkspaceAreaRole)}
          >
            <option value="VIEWER">Görüntüleyici</option>
            <option value="MEMBER">Üye</option>
            <option value="EDITOR">Düzenleyici</option>
            <option value="OWNER">Yönetici</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMemberOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={!memberUserId}
              onClick={() =>
                void upsertAreaMember(area.id, { userId: memberUserId, role: memberRole })
                  .then(() => {
                    setMemberOpen(false);
                    return load();
                  })
                  .catch((err) => toast((err as Error).message, 'error'))
              }
            >
              Ekle
            </Button>
          </div>
        </div>
      </Modal>
    </PageCanvas>
  );
}
