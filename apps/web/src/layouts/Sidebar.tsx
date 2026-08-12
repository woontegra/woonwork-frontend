import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  FolderKanban,
  Home,
  Images,
  Library,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Share2,
  Table2,
  Users,
  X,
  Menu,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useTenant } from '../contexts/TenantContext';
import { useToast } from '../components/ui/Toast';
import { createDatabase } from '../lib/database';
import { apiRequest } from '../lib/api';
import {
  addFavorite,
  movePage,
  removeFavorite,
  resourceHref,
} from '../lib/library';
import type { ProjectDto } from '../types';
import {
  createPage,
  createSubpage,
  deletePage,
  duplicatePage,
  fetchWorkspaceTree,
  notifyWorkspaceChanged,
  openCommandPalette,
  treeNodeHref,
  updatePage,
  WORKSPACE_CHANGED,
  type WorkspaceTree,
  type WorkspaceTreeNode,
} from '../lib/workspace';

function storageKey(tenantId: string) {
  return `woonwork:sidebar-tree:${tenantId}`;
}

function loadExpanded(tenantId: string): { areas: string[]; pages: string[]; privateOpen: boolean } {
  try {
    const raw = localStorage.getItem(storageKey(tenantId));
    if (!raw) return { areas: [], pages: [], privateOpen: true };
    const parsed = JSON.parse(raw) as { areas?: string[]; pages?: string[]; privateOpen?: boolean };
    return {
      areas: parsed.areas ?? [],
      pages: parsed.pages ?? [],
      privateOpen: parsed.privateOpen ?? true,
    };
  } catch {
    return { areas: [], pages: [], privateOpen: true };
  }
}

function TypeIcon({ type, icon }: { type: WorkspaceTreeNode['type']; icon?: string | null }) {
  if (icon) return <span className="w-4 shrink-0 text-center text-[12px]">{icon}</span>;
  if (type === 'DATABASE') return <Table2 size={13} className="shrink-0 opacity-80" />;
  if (type === 'PROJECT') return <FolderKanban size={13} className="shrink-0 opacity-80" />;
  return <FileText size={13} className="shrink-0 opacity-80" />;
}

function TreeRow({
  node,
  depth,
  expandedPages,
  togglePage,
  activeId,
  onCloseMobile,
  onContext,
  onQuickChild,
}: {
  node: WorkspaceTreeNode;
  depth: number;
  expandedPages: Set<string>;
  togglePage: (id: string) => void;
  activeId?: string;
  onCloseMobile: () => void;
  onContext: (node: WorkspaceTreeNode, x: number, y: number) => void;
  onQuickChild: (parentId: string) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const open = expandedPages.has(node.id);
  const href = treeNodeHref(node);
  const active = activeId === node.id;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `drag:PAGE:${node.id}`,
    disabled: node.type !== 'PAGE',
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:page:${node.id}`,
    disabled: node.type !== 'PAGE',
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div ref={setDropRef} className={isOver ? 'rounded-md bg-white/[0.06]' : ''}>
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative flex h-8 items-center gap-1 rounded-md pr-1 text-[13px] ${
          active ? 'bg-white/[0.07] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'
        } ${isDragging ? 'opacity-50' : ''}`}
      >
        {active ? (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-accent" />
        ) : null}
        <button
          type="button"
          className={`ml-0.5 flex h-5 w-5 items-center justify-center rounded text-ink-500 hover:text-ink-200 ${
            hasChildren ? '' : 'opacity-0 group-hover:opacity-40'
          }`}
          style={{ marginLeft: depth * 12 }}
          onClick={(e) => {
            e.preventDefault();
            if (hasChildren) togglePage(node.id);
          }}
          aria-label={open ? 'Daralt' : 'Genişlet'}
        >
          {hasChildren ? (
            open ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : (
            <span className="h-1 w-1 rounded-full bg-ink-600" />
          )}
        </button>
        <NavLink
          to={href}
          onClick={onCloseMobile}
          className="flex min-w-0 flex-1 items-center gap-1.5 truncate py-1"
          {...(node.type === 'PAGE' ? { ...listeners, ...attributes } : {})}
        >
          <TypeIcon type={node.type} icon={node.icon} />
          <span className="truncate">{node.name || 'Adsız'}</span>
        </NavLink>
        <div className="hidden shrink-0 items-center group-hover:flex">
          {node.type === 'PAGE' ? (
            <button
              type="button"
              className="rounded p-0.5 text-ink-500 hover:text-white"
              title="Alt sayfa"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void onQuickChild(node.id);
              }}
            >
              <Plus size={12} />
            </button>
          ) : null}
          <button
            type="button"
            className="rounded p-0.5 text-ink-500 hover:text-white"
            title="Menü"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onContext(node, e.clientX, e.clientY);
            }}
          >
            <MoreHorizontal size={12} />
          </button>
        </div>
      </div>
      {open && hasChildren
        ? node.children!.map((child) => (
            <TreeRow
              key={`${child.type}:${child.id}`}
              node={child}
              depth={depth + 1}
              expandedPages={expandedPages}
              togglePage={togglePage}
              activeId={activeId}
              onCloseMobile={onCloseMobile}
              onContext={onContext}
              onQuickChild={onQuickChild}
            />
          ))
        : null}
    </div>
  );
}

function DropSection({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={isOver ? 'rounded-md bg-white/[0.04]' : ''}>
      {children}
    </div>
  );
}

function QuickAddMenu({
  onCreate,
  onClose,
}: {
  onCreate: (kind: 'page' | 'database' | 'project') => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-md border border-white/10 bg-ink-900 py-1 shadow-[var(--ww-shadow-overlay)]">
      {[
        { kind: 'page' as const, label: 'Yeni Sayfa' },
        { kind: 'database' as const, label: 'Yeni Akıllı Tablo' },
        { kind: 'project' as const, label: 'Yeni Proje' },
      ].map((item) => (
        <button
          key={item.kind}
          type="button"
          className="block w-full px-3 py-1.5 text-left text-[12px] text-ink-200 hover:bg-white/8 hover:text-white"
          onClick={() => {
            onCreate(item.kind);
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}) {
  const { tenants, activeTenant, setActiveTenantId } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [tenantOpen, setTenantOpen] = useState(false);
  const [tree, setTree] = useState<WorkspaceTree | null>(null);
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [privateOpen, setPrivateOpen] = useState(true);
  const [quickFor, setQuickFor] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ node: WorkspaceTreeNode; x: number; y: number } | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadTree = useCallback(() => {
    void fetchWorkspaceTree()
      .then(setTree)
      .catch(() => setTree(null));
  }, []);

  useEffect(() => {
    if (!activeTenant) return;
    const saved = loadExpanded(activeTenant.id);
    setExpandedAreas(new Set(saved.areas.length ? saved.areas : []));
    setExpandedPages(new Set(saved.pages));
    setPrivateOpen(saved.privateOpen);
    loadTree();
  }, [activeTenant, loadTree]);

  useEffect(() => {
    function onChange() {
      loadTree();
    }
    window.addEventListener(WORKSPACE_CHANGED, onChange);
    return () => window.removeEventListener(WORKSPACE_CHANGED, onChange);
  }, [loadTree]);

  useEffect(() => {
    if (!activeTenant) return;
    localStorage.setItem(
      storageKey(activeTenant.id),
      JSON.stringify({
        areas: [...expandedAreas],
        pages: [...expandedPages],
        privateOpen,
      }),
    );
  }, [activeTenant, expandedAreas, expandedPages, privateOpen]);

  useEffect(() => {
    if (!tree || !activeTenant) return;
    if (expandedAreas.size === 0 && tree.areas.length) {
      setExpandedAreas(new Set(tree.areas.map((a) => a.id)));
    }
  }, [tree, activeTenant, expandedAreas.size]);

  const activeId = useMemo(() => {
    const m =
      location.pathname.match(/^\/notlar\/([^/]+)/) ||
      location.pathname.match(/^\/tablolar\/([^/]+)/) ||
      location.pathname.match(/^\/projeler\/([^/]+)/);
    return m?.[1];
  }, [location.pathname]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function createIn(
    kind: 'page' | 'database' | 'project',
    areaId: string | null,
    parentId?: string | null,
  ) {
    try {
      if (kind === 'page') {
        const page = await createPage({
          title: 'Adsız sayfa',
          workspaceAreaId: areaId,
          parentId: parentId ?? null,
        });
        notifyWorkspaceChanged();
        navigate(`/notlar/${page.id}`);
        onCloseMobile();
        return;
      }
      if (kind === 'database') {
        const db = await createDatabase({ name: 'Yeni Tablo', workspaceAreaId: areaId });
        notifyWorkspaceChanged();
        navigate(`/tablolar/${db.id}`);
        onCloseMobile();
        return;
      }
      const project = await apiRequest<ProjectDto>('/projects', {
        method: 'POST',
        body: { name: 'Yeni Proje', workspaceAreaId: areaId },
      });
      notifyWorkspaceChanged();
      navigate(`/projeler/${project.id}`);
      onCloseMobile();
    } catch (err) {
      toast((err as Error).message || 'Oluşturulamadı', 'error');
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const dragId = String(active.id);
    if (!dragId.startsWith('drag:PAGE:')) return;
    const pageId = dragId.slice('drag:PAGE:'.length);
    const overId = String(over.id);

    try {
      if (overId === 'drop:private') {
        await movePage(pageId, { workspaceAreaId: null, parentId: null });
      } else if (overId.startsWith('drop:area:')) {
        await movePage(pageId, { workspaceAreaId: overId.slice('drop:area:'.length), parentId: null });
      } else if (overId.startsWith('drop:page:')) {
        const parentId = overId.slice('drop:page:'.length);
        if (parentId === pageId) return;
        await movePage(pageId, { parentId });
      } else {
        return;
      }
      notifyWorkspaceChanged();
    } catch (err) {
      toast((err as Error).message || 'Taşıma başarısız', 'error');
    }
  }

  async function onQuickChild(parentId: string) {
    try {
      const result = await createSubpage(parentId, { title: 'Adsız sayfa' });
      notifyWorkspaceChanged();
      setExpandedPages((prev) => new Set([...prev, parentId]));
      navigate(`/notlar/${result.page.id}`);
      onCloseMobile();
    } catch (err) {
      toast((err as Error).message || 'Alt sayfa oluşturulamadı', 'error');
    }
  }

  async function runMenu(action: string, node: WorkspaceTreeNode) {
    setMenu(null);
    try {
      if (action === 'open') {
        navigate(treeNodeHref(node));
        onCloseMobile();
      } else if (action === 'subpage' && node.type === 'PAGE') {
        await onQuickChild(node.id);
      } else if (action === 'favorite') {
        await addFavorite(node.type, node.id);
        notifyWorkspaceChanged();
      } else if (action === 'unfavorite') {
        await removeFavorite(node.type, node.id);
        notifyWorkspaceChanged();
      } else if (action === 'rename' && node.type === 'PAGE') {
        setRenameId(node.id);
        setRenameValue(node.name);
      } else if (action === 'duplicate' && node.type === 'PAGE') {
        const copy = await duplicatePage(node.id);
        notifyWorkspaceChanged();
        navigate(`/notlar/${copy.id}`);
      } else if (action === 'delete' && node.type === 'PAGE') {
        if (!window.confirm(`“${node.name}” silinsin mi?`)) return;
        await deletePage(node.id);
        notifyWorkspaceChanged();
      }
    } catch (err) {
      toast((err as Error).message || 'İşlem başarısız', 'error');
    }
  }

  async function saveRename() {
    if (!renameId) return;
    try {
      await updatePage(renameId, { title: renameValue.trim() || 'Adsız sayfa' });
      notifyWorkspaceChanged();
    } catch (err) {
      toast((err as Error).message || 'Yeniden adlandırılamadı', 'error');
    } finally {
      setRenameId(null);
    }
  }

  const systemNav = [
    { to: '/', label: 'Ana Sayfa', icon: Home, end: true },
    { to: '/kutuphane', label: 'Kütüphane', icon: Library },
  ];
  const toolsNav = [
    { to: '/medya', label: 'Medya', icon: Images },
    { to: '/sosyal-medya', label: 'Sosyal Medya', icon: Share2 },
  ];
  const bottomNav = [
    { to: '/ekip', label: 'Ekip', icon: Users },
    { to: '/ayarlar', label: 'Ayarlar', icon: Settings },
  ];

  function renderNav(items: typeof systemNav) {
    return items.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onCloseMobile}
          title={item.label}
          className={({ isActive }) =>
            `group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition ${
              isActive ? 'bg-white/[0.07] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'
            } ${collapsed ? 'justify-center px-0' : ''}`
          }
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <motion.span
                  layoutId="ww-nav-rail"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-accent shadow-[0_0_10px_rgb(67_97_238/0.5)]"
                />
              ) : null}
              <Icon size={16} className={isActive ? 'text-accent' : 'opacity-85'} />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </>
          )}
        </NavLink>
      );
    });
  }

  const sectionLabel = (label: string) =>
    collapsed ? null : (
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
        {label}
      </p>
    );

  const content = (
    <div className="flex h-full flex-col text-ink-200">
      <div className={`border-b border-white/8 px-3 py-4 ${collapsed ? 'px-2' : ''}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-accent/30 to-white/5 text-sm font-bold tracking-tight text-white ring-1 ring-white/10">
            W
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-tight text-white">WoonWork</p>
              <p className="truncate text-[10px] uppercase tracking-[0.16em] text-ink-400">Çalışma alanı</p>
            </div>
          ) : null}
        </div>
        <div className={`relative mt-3 ${collapsed ? 'flex justify-center' : ''}`}>
          <button
            type="button"
            onClick={() => setTenantOpen((v) => !v)}
            title={activeTenant?.name}
            className={`flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.03] text-left hover:bg-white/[0.06] ${
              collapsed ? 'h-9 w-9 justify-center' : 'w-full px-2.5 py-2'
            }`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/20 text-[10px] font-bold text-accent">
              {(activeTenant?.name?.[0] || 'W').toUpperCase()}
            </span>
            {!collapsed ? (
              <>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">
                  {activeTenant?.name ?? 'Çalışma alanı'}
                </span>
                <ChevronsUpDown size={14} className="text-ink-400" />
              </>
            ) : null}
          </button>
          <AnimatePresence>
            {tenantOpen ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 2 }}
                className={`absolute z-50 mt-1 overflow-hidden rounded-md border border-white/10 bg-ink-900 ${
                  collapsed ? 'left-0 w-52' : 'left-0 right-0'
                }`}
              >
                {tenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => {
                      setActiveTenantId(tenant.id);
                      setTenantOpen(false);
                      window.location.reload();
                    }}
                    className={`block w-full px-3 py-2 text-left text-xs hover:bg-white/5 ${
                      tenant.id === activeTenant?.id ? 'bg-white/8 font-semibold text-white' : 'text-ink-300'
                    }`}
                  >
                    {tenant.name}
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <nav className="flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          {renderNav(systemNav)}
          <button
            type="button"
            onClick={() => openCommandPalette()}
            className={`flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] font-medium text-ink-300 hover:bg-white/[0.04] hover:text-white ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <Search size={16} />
            {!collapsed ? <span>Ara</span> : null}
          </button>
        </div>

        {!collapsed && tree?.favorites.length ? (
          <div>
            {sectionLabel('Favoriler')}
            <div className="space-y-0.5">
              {tree.favorites.map((fav) => (
                <NavLink
                  key={`${fav.type}:${fav.id}`}
                  to={fav.href || resourceHref(fav.type, fav.id)}
                  onClick={onCloseMobile}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-ink-300 hover:bg-white/[0.04] hover:text-white"
                >
                  <TypeIcon type={fav.type} icon={fav.icon} />
                  <span className="truncate">{fav.name}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ) : null}

        {!collapsed && tree?.recents?.length ? (
          <div>
            {sectionLabel('Son')}
            <div className="space-y-0.5">
              {tree.recents.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.href}
                  onClick={onCloseMobile}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-ink-300 hover:bg-white/[0.04] hover:text-white"
                >
                  <TypeIcon type={item.resourceType} icon={item.icon} />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ) : null}

        {!collapsed && tree ? (
          <DndContext sensors={sensors} onDragEnd={(e) => void onDragEnd(e)}>
            <DropSection id="drop:private">
              <div className="relative">
                <div className="group mb-1 flex h-7 items-center px-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500"
                    onClick={() => setPrivateOpen((v) => !v)}
                  >
                    {privateOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Özel
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 text-ink-500 opacity-0 hover:text-white group-hover:opacity-100"
                    onClick={() => setQuickFor(quickFor === 'private' ? null : 'private')}
                  >
                    <Plus size={13} />
                  </button>
                  {quickFor === 'private' ? (
                    <QuickAddMenu
                      onCreate={(kind) => void createIn(kind, null)}
                      onClose={() => setQuickFor(null)}
                    />
                  ) : null}
                </div>
                {privateOpen ? (
                  <div className="space-y-0.5">
                    {!tree.private.pages.length &&
                    !tree.private.databases.length &&
                    !tree.private.projects.length ? (
                      <button
                        type="button"
                        className="w-full px-2 py-1 text-left text-[12px] text-ink-500 hover:text-ink-200"
                        onClick={() => void createIn('page', null)}
                      >
                        + İlk sayfanızı oluşturun
                      </button>
                    ) : (
                      <>
                        {tree.private.pages.map((node) => (
                          <TreeRow
                            key={`p:${node.id}`}
                            node={node}
                            depth={0}
                            expandedPages={expandedPages}
                            togglePage={(id) =>
                              setExpandedPages((prev) => {
                                const next = new Set(prev);
                                if (next.has(id)) next.delete(id);
                                else next.add(id);
                                return next;
                              })
                            }
                            activeId={activeId}
                            onCloseMobile={onCloseMobile}
                            onContext={(n, x, y) => setMenu({ node: n, x, y })}
                            onQuickChild={onQuickChild}
                          />
                        ))}
                        {[...tree.private.databases, ...tree.private.projects].map((node) => (
                          <TreeRow
                            key={`${node.type}:${node.id}`}
                            node={node}
                            depth={0}
                            expandedPages={expandedPages}
                            togglePage={() => undefined}
                            activeId={activeId}
                            onCloseMobile={onCloseMobile}
                            onContext={(n, x, y) => setMenu({ node: n, x, y })}
                            onQuickChild={onQuickChild}
                          />
                        ))}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </DropSection>

            <div>
              {sectionLabel('Alanlar')}
              {tree.areas.map((area) => {
                const open = expandedAreas.has(area.id);
                const empty = !area.pages.length && !area.databases.length && !area.projects.length;
                return (
                  <DropSection key={area.id} id={`drop:area:${area.id}`}>
                    <div className="relative mb-0.5">
                      <div className="group flex h-8 items-center gap-1 rounded-md px-1.5 hover:bg-white/[0.04]">
                        <button
                          type="button"
                          className="flex h-5 w-5 items-center justify-center text-ink-500"
                          onClick={() =>
                            setExpandedAreas((prev) => {
                              const next = new Set(prev);
                              if (next.has(area.id)) next.delete(area.id);
                              else next.add(area.id);
                              return next;
                            })
                          }
                        >
                          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                        <NavLink
                          to={`/alanlar/${area.id}`}
                          onClick={onCloseMobile}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-ink-200 hover:text-white"
                        >
                          <span className="w-4 text-center text-[12px]">{area.icon || '·'}</span>
                          <span className="truncate font-medium">{area.name}</span>
                        </NavLink>
                        <button
                          type="button"
                          className="rounded p-0.5 text-ink-500 opacity-0 hover:text-white group-hover:opacity-100"
                          onClick={() => setQuickFor(quickFor === area.id ? null : area.id)}
                        >
                          <Plus size={13} />
                        </button>
                        {quickFor === area.id ? (
                          <QuickAddMenu
                            onCreate={(kind) => void createIn(kind, area.id)}
                            onClose={() => setQuickFor(null)}
                          />
                        ) : null}
                      </div>
                      {open ? (
                        <div className="mb-1 space-y-0.5">
                          {empty ? (
                            <button
                              type="button"
                              className="w-full px-2 py-1 text-left text-[12px] text-ink-500 hover:text-ink-200"
                              onClick={() => void createIn('page', area.id)}
                            >
                              + İlk sayfanızı oluşturun
                            </button>
                          ) : (
                            <>
                              {area.pages.map((node) => (
                                <TreeRow
                                  key={`a:${node.id}`}
                                  node={node}
                                  depth={1}
                                  expandedPages={expandedPages}
                                  togglePage={(id) =>
                                    setExpandedPages((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(id)) next.delete(id);
                                      else next.add(id);
                                      return next;
                                    })
                                  }
                                  activeId={activeId}
                                  onCloseMobile={onCloseMobile}
                                  onContext={(n, x, y) => setMenu({ node: n, x, y })}
                                  onQuickChild={onQuickChild}
                                />
                              ))}
                              {[...area.databases, ...area.projects].map((node) => (
                                <TreeRow
                                  key={`${node.type}:${node.id}`}
                                  node={node}
                                  depth={1}
                                  expandedPages={expandedPages}
                                  togglePage={() => undefined}
                                  activeId={activeId}
                                  onCloseMobile={onCloseMobile}
                                  onContext={(n, x, y) => setMenu({ node: n, x, y })}
                                  onQuickChild={onQuickChild}
                                />
                              ))}
                              {area.hasSocial ? (
                                <NavLink
                                  to="/sosyal-medya"
                                  onClick={onCloseMobile}
                                  className="ml-6 flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-400 hover:bg-white/[0.04] hover:text-white"
                                >
                                  <Share2 size={13} />
                                  Sosyal Medya
                                </NavLink>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </DropSection>
                );
              })}
            </div>
          </DndContext>
        ) : null}

        <div>
          {!collapsed ? sectionLabel('Araçlar') : <div className="mx-auto my-2 h-px w-6 bg-white/8" />}
          <div className="space-y-0.5">{renderNav(toolsNav)}</div>
        </div>
      </nav>

      <div className="border-t border-white/8 p-2">
        <div className="mb-1 space-y-0.5">{renderNav(bottomNav)}</div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-ink-300 hover:bg-white/[0.05] hover:text-white lg:flex"
          aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed ? <span>Daralt</span> : null}
        </button>
      </div>

      {menu ? (
        <>
          <button type="button" className="fixed inset-0 z-[60]" onClick={() => setMenu(null)} />
          <div
            className="fixed z-[61] w-44 overflow-hidden rounded-md border border-white/10 bg-ink-900 py-1 text-[12px] shadow-[var(--ww-shadow-overlay)]"
            style={{ left: Math.min(menu.x, window.innerWidth - 190), top: menu.y }}
          >
            {[
              { id: 'open', label: 'Aç' },
              ...(menu.node.type === 'PAGE' ? [{ id: 'subpage', label: 'Yeni Alt Sayfa' }] : []),
              { id: 'favorite', label: 'Favoriye Ekle' },
              ...(menu.node.type === 'PAGE' ? [{ id: 'rename', label: 'Yeniden Adlandır' }] : []),
              ...(menu.node.type === 'PAGE' ? [{ id: 'duplicate', label: 'Çoğalt' }] : []),
              ...(menu.node.type === 'PAGE' ? [{ id: 'delete', label: 'Sil' }] : []),
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className="block w-full px-3 py-1.5 text-left text-ink-200 hover:bg-white/8 hover:text-white"
                onClick={() => void runMenu(item.id, menu.node)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {renameId ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-ink-950/40 pt-[20vh]">
          <form
            className="w-72 rounded-md border border-[var(--ww-border)] bg-white p-3 shadow-[var(--ww-shadow-md)]"
            onSubmit={(e) => {
              e.preventDefault();
              void saveRename();
            }}
          >
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ww-text-muted)]">
              Yeniden adlandır
            </p>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="h-8 w-full rounded-md border border-[var(--ww-border)] px-2 text-[13px] outline-none focus:border-accent/55"
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <button type="button" className="h-8 px-2 text-[12px]" onClick={() => setRenameId(null)}>
                Vazgeç
              </button>
              <button type="submit" className="h-8 px-2 text-[12px] font-medium text-accent-strong">
                Kaydet
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 bg-ink-950 text-white transition-[width] duration-300 ease-[var(--ww-ease)] lg:block ${
          collapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        {content}
      </aside>
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Menüyü kapat"
              className="fixed inset-0 z-40 bg-ink-950/55 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] overflow-hidden bg-ink-950 text-white lg:hidden"
            >
              <button
                type="button"
                onClick={onCloseMobile}
                className="absolute right-3 top-4 rounded-lg p-2 text-ink-300 hover:bg-white/10 hover:text-white"
                aria-label="Kapat"
              >
                <X size={18} />
              </button>
              {content}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[var(--ww-control-radius)] p-2 text-[var(--ww-text-secondary)] hover:bg-black/[0.04] lg:hidden"
      aria-label="Menüyü aç"
    >
      <Menu size={20} />
    </button>
  );
}

export function useQuickCreateTargets() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [areas, setAreas] = useState<WorkspaceTree['areas']>([]);

  useEffect(() => {
    void fetchWorkspaceTree()
      .then((t) => setAreas(t.areas))
      .catch(() => setAreas([]));
  }, []);

  return [
    {
      label: 'Yeni Sayfa',
      onSelect: async () => {
        try {
          const page = await createPage({ title: 'Adsız sayfa', workspaceAreaId: null });
          notifyWorkspaceChanged();
          navigate(`/notlar/${page.id}`);
        } catch (err) {
          toast((err as Error).message || 'Sayfa oluşturulamadı', 'error');
        }
      },
    },
    {
      label: 'Yeni Akıllı Tablo',
      onSelect: async () => {
        try {
          const db = await createDatabase({ name: 'Yeni Tablo' });
          notifyWorkspaceChanged();
          navigate(`/tablolar/${db.id}`);
        } catch (err) {
          toast((err as Error).message || 'Tablo oluşturulamadı', 'error');
        }
      },
    },
    {
      label: 'Yeni Proje',
      onSelect: async () => {
        try {
          const project = await apiRequest<ProjectDto>('/projects', {
            method: 'POST',
            body: { name: 'Yeni Proje' },
          });
          notifyWorkspaceChanged();
          navigate(`/projeler/${project.id}`);
        } catch (err) {
          toast((err as Error).message || 'Proje oluşturulamadı', 'error');
        }
      },
    },
    { label: 'Yeni Görev', onSelect: () => navigate('/gorevler') },
    { label: 'Yeni Sosyal İçerik', onSelect: () => navigate('/sosyal-medya/icerikler') },
    ...areas.slice(0, 3).map((area) => ({
      label: `Sayfa · ${area.name}`,
      onSelect: async () => {
        const page = await createPage({ title: 'Adsız sayfa', workspaceAreaId: area.id });
        notifyWorkspaceChanged();
        navigate(`/notlar/${page.id}`);
      },
    })),
  ];
}
