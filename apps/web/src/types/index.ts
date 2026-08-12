export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  role: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectDto {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: string;
  createdById: string;
  workspaceAreaId?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; firstName: string; lastName: string; email?: string };
  workspaceArea?: { id: string; name: string; icon: string | null } | null;
  _count?: { tasks: number };
}

export interface TaskDto {
  id: string;
  tenantId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string } | null;
  assignee?: { id: string; firstName: string; lastName: string; email?: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string; email?: string };
}

export interface PageDto {
  id: string;
  tenantId: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  createdById: string;
  workspaceAreaId?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; firstName: string; lastName: string; email?: string };
  workspaceArea?: { id: string; name: string; icon: string | null } | null;
  children?: Array<{
    id: string;
    title: string;
    icon: string | null;
    parentId: string | null;
    updatedAt: string;
  }>;
  parent?: { id: string; title: string; icon: string | null } | null;
  ancestors?: Array<{
    id: string;
    title: string;
    icon: string | null;
    workspaceAreaId: string | null;
  }>;
  _count?: { children: number };
}

export interface MemberDto {
  id: string;
  role: string;
  createdAt: string;
  user: UserDto;
}

export interface DashboardDto {
  stats: {
    activeProjects: number;
    pendingTasks: number;
    dueToday: number;
    recentPages: number;
  };
  recentProjects: ProjectDto[];
  upcomingTasks: TaskDto[];
  recentPages: PageDto[];
}
