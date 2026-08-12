-- CreateEnum
CREATE TYPE "WorkspaceAreaVisibility" AS ENUM ('PRIVATE', 'MEMBERS', 'TENANT');
CREATE TYPE "WorkspaceAreaRole" AS ENUM ('OWNER', 'EDITOR', 'MEMBER', 'VIEWER');
CREATE TYPE "ContentResourceType" AS ENUM ('PAGE', 'DATABASE', 'PROJECT');
CREATE TYPE "SharePermission" AS ENUM ('VIEW', 'EDIT');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "workspaceAreaId" TEXT;
ALTER TABLE "Page" ADD COLUMN "workspaceAreaId" TEXT;
ALTER TABLE "Database" ADD COLUMN "workspaceAreaId" TEXT;

-- CreateTable
CREATE TABLE "WorkspaceArea" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "visibility" "WorkspaceAreaVisibility" NOT NULL DEFAULT 'MEMBERS',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceArea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceAreaMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceAreaRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceAreaMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentShare" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "resourceType" "ContentResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "sharedWithUserId" TEXT NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'VIEW',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentShare_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "ContentResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecentItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "ContentResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "lastOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecentItem_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "WorkspaceArea_tenantId_idx" ON "WorkspaceArea"("tenantId");
CREATE INDEX "WorkspaceArea_tenantId_name_idx" ON "WorkspaceArea"("tenantId", "name");
CREATE INDEX "WorkspaceAreaMember_tenantId_idx" ON "WorkspaceAreaMember"("tenantId");
CREATE INDEX "WorkspaceAreaMember_userId_idx" ON "WorkspaceAreaMember"("userId");
CREATE INDEX "WorkspaceAreaMember_areaId_idx" ON "WorkspaceAreaMember"("areaId");
CREATE UNIQUE INDEX "WorkspaceAreaMember_areaId_userId_key" ON "WorkspaceAreaMember"("areaId", "userId");
CREATE INDEX "ContentShare_tenantId_sharedWithUserId_idx" ON "ContentShare"("tenantId", "sharedWithUserId");
CREATE INDEX "ContentShare_tenantId_resourceType_resourceId_idx" ON "ContentShare"("tenantId", "resourceType", "resourceId");
CREATE UNIQUE INDEX "ContentShare_tenantId_resourceType_resourceId_sharedWithUserId_key" ON "ContentShare"("tenantId", "resourceType", "resourceId", "sharedWithUserId");
CREATE INDEX "Favorite_tenantId_userId_idx" ON "Favorite"("tenantId", "userId");
CREATE UNIQUE INDEX "Favorite_tenantId_userId_resourceType_resourceId_key" ON "Favorite"("tenantId", "userId", "resourceType", "resourceId");
CREATE INDEX "RecentItem_tenantId_userId_lastOpenedAt_idx" ON "RecentItem"("tenantId", "userId", "lastOpenedAt");
CREATE UNIQUE INDEX "RecentItem_tenantId_userId_resourceType_resourceId_key" ON "RecentItem"("tenantId", "userId", "resourceType", "resourceId");
CREATE INDEX "Project_tenantId_workspaceAreaId_idx" ON "Project"("tenantId", "workspaceAreaId");
CREATE INDEX "Project_workspaceAreaId_idx" ON "Project"("workspaceAreaId");
CREATE INDEX "Page_tenantId_workspaceAreaId_idx" ON "Page"("tenantId", "workspaceAreaId");
CREATE INDEX "Page_workspaceAreaId_idx" ON "Page"("workspaceAreaId");
CREATE INDEX "Database_tenantId_workspaceAreaId_idx" ON "Database"("tenantId", "workspaceAreaId");
CREATE INDEX "Database_workspaceAreaId_idx" ON "Database"("workspaceAreaId");

-- FKs
ALTER TABLE "WorkspaceArea" ADD CONSTRAINT "WorkspaceArea_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceArea" ADD CONSTRAINT "WorkspaceArea_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceAreaMember" ADD CONSTRAINT "WorkspaceAreaMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceAreaMember" ADD CONSTRAINT "WorkspaceAreaMember_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "WorkspaceArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceAreaMember" ADD CONSTRAINT "WorkspaceAreaMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentShare" ADD CONSTRAINT "ContentShare_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentShare" ADD CONSTRAINT "ContentShare_sharedWithUserId_fkey" FOREIGN KEY ("sharedWithUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentShare" ADD CONSTRAINT "ContentShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecentItem" ADD CONSTRAINT "RecentItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecentItem" ADD CONSTRAINT "RecentItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceAreaId_fkey" FOREIGN KEY ("workspaceAreaId") REFERENCES "WorkspaceArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Page" ADD CONSTRAINT "Page_workspaceAreaId_fkey" FOREIGN KEY ("workspaceAreaId") REFERENCES "WorkspaceArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Database" ADD CONSTRAINT "Database_workspaceAreaId_fkey" FOREIGN KEY ("workspaceAreaId") REFERENCES "WorkspaceArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
