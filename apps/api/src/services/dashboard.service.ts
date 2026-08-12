import { prisma } from '../lib/prisma';
import { accessibleWhere, type AccessContext } from './contentAccess.service';
import { listRecents } from './recent.service';

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function getDashboard(ctx: AccessContext) {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);

  const projectWhere = await accessibleWhere(ctx, 'PROJECT');
  const pageWhere = await accessibleWhere(ctx, 'PAGE');

  const accessibleProjects = await prisma.project.findMany({
    where: projectWhere as object,
    select: { id: true },
  });
  const projectIds = accessibleProjects.map((p) => p.id);

  const [
    activeProjectsCount,
    pendingTasksCount,
    dueTodayCount,
    recentPagesCount,
    recentProjects,
    upcomingTasks,
  ] = await Promise.all([
    prisma.project.count({
      where: { ...(projectWhere as object), status: 'ACTIVE' },
    }),
    prisma.task.count({
      where: {
        tenantId: ctx.tenantId,
        status: { in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
        OR: [
          { projectId: { in: projectIds } },
          { projectId: null, createdById: ctx.userId },
        ],
      },
    }),
    prisma.task.count({
      where: {
        tenantId: ctx.tenantId,
        dueDate: { gte: todayStart, lte: todayEnd },
        status: { notIn: ['DONE', 'CANCELLED'] },
        OR: [
          { projectId: { in: projectIds } },
          { projectId: null, createdById: ctx.userId },
        ],
      },
    }),
    prisma.page.count({ where: pageWhere as object }),
    prisma.project.findMany({
      where: projectWhere as object,
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        _count: { select: { tasks: true } },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
    prisma.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        dueDate: { gte: todayStart, lte: soon },
        status: { notIn: ['DONE', 'CANCELLED'] },
        OR: [
          { projectId: { in: projectIds } },
          { projectId: null, createdById: ctx.userId },
        ],
      },
      orderBy: { dueDate: 'asc' },
      take: 8,
      include: {
        project: { select: { id: true, name: true } },
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
  ]);

  const recents = await listRecents(ctx, 5);
  const recentPages = recents
    .filter((r) => r.resourceType === 'PAGE')
    .map((r) => ({
      id: r.resourceId,
      title: r.name,
      icon: r.icon,
      updatedAt: r.lastOpenedAt,
      parentId: null as string | null,
    }));

  // Fallback: accessible pages by updatedAt if no recents yet
  const pagesFallback =
    recentPages.length > 0
      ? recentPages
      : await prisma.page.findMany({
          where: pageWhere as object,
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            title: true,
            icon: true,
            updatedAt: true,
            parentId: true,
          },
        });

  return {
    stats: {
      activeProjects: activeProjectsCount,
      pendingTasks: pendingTasksCount,
      dueToday: dueTodayCount,
      recentPages: recentPagesCount,
    },
    recentProjects,
    upcomingTasks,
    recentPages: pagesFallback,
    recents,
  };
}
