-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'PINTEREST', 'YOUTUBE');
CREATE TYPE "SocialContentType" AS ENUM ('POST', 'CAROUSEL', 'REEL', 'STORY', 'VIDEO', 'SHORT', 'ARTICLE', 'PIN');
CREATE TYPE "SocialContentStatus" AS ENUM ('IDEA', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SocialBrand" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceAreaId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialBrand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialContent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceAreaId" TEXT,
    "socialBrandId" TEXT,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "contentText" TEXT,
    "internalNotes" TEXT,
    "contentType" "SocialContentType" NOT NULL DEFAULT 'POST',
    "status" "SocialContentStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "readyToPublish" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "platformCopy" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialContentPlatform" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "socialContentId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "socialAccountId" TEXT,
    "publicationStatus" TEXT,
    "externalPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialContentPlatform_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialContentMedia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "socialContentId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialContentMedia_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "SocialBrand_tenantId_idx" ON "SocialBrand"("tenantId");
CREATE INDEX "SocialBrand_tenantId_isActive_idx" ON "SocialBrand"("tenantId", "isActive");
CREATE INDEX "SocialBrand_workspaceAreaId_idx" ON "SocialBrand"("workspaceAreaId");

CREATE INDEX "SocialContent_tenantId_idx" ON "SocialContent"("tenantId");
CREATE INDEX "SocialContent_tenantId_status_idx" ON "SocialContent"("tenantId", "status");
CREATE INDEX "SocialContent_tenantId_scheduledAt_idx" ON "SocialContent"("tenantId", "scheduledAt");
CREATE INDEX "SocialContent_tenantId_socialBrandId_idx" ON "SocialContent"("tenantId", "socialBrandId");
CREATE INDEX "SocialContent_workspaceAreaId_idx" ON "SocialContent"("workspaceAreaId");
CREATE INDEX "SocialContent_createdById_idx" ON "SocialContent"("createdById");

CREATE UNIQUE INDEX "SocialContentPlatform_socialContentId_platform_key" ON "SocialContentPlatform"("socialContentId", "platform");
CREATE INDEX "SocialContentPlatform_tenantId_idx" ON "SocialContentPlatform"("tenantId");
CREATE INDEX "SocialContentPlatform_tenantId_platform_idx" ON "SocialContentPlatform"("tenantId", "platform");

CREATE UNIQUE INDEX "SocialContentMedia_socialContentId_mediaAssetId_key" ON "SocialContentMedia"("socialContentId", "mediaAssetId");
CREATE INDEX "SocialContentMedia_tenantId_idx" ON "SocialContentMedia"("tenantId");
CREATE INDEX "SocialContentMedia_socialContentId_position_idx" ON "SocialContentMedia"("socialContentId", "position");
CREATE INDEX "SocialContentMedia_mediaAssetId_idx" ON "SocialContentMedia"("mediaAssetId");

-- FKs
ALTER TABLE "SocialBrand" ADD CONSTRAINT "SocialBrand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialBrand" ADD CONSTRAINT "SocialBrand_workspaceAreaId_fkey" FOREIGN KEY ("workspaceAreaId") REFERENCES "WorkspaceArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialBrand" ADD CONSTRAINT "SocialBrand_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocialContent" ADD CONSTRAINT "SocialContent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialContent" ADD CONSTRAINT "SocialContent_workspaceAreaId_fkey" FOREIGN KEY ("workspaceAreaId") REFERENCES "WorkspaceArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialContent" ADD CONSTRAINT "SocialContent_socialBrandId_fkey" FOREIGN KEY ("socialBrandId") REFERENCES "SocialBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialContent" ADD CONSTRAINT "SocialContent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocialContentPlatform" ADD CONSTRAINT "SocialContentPlatform_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialContentPlatform" ADD CONSTRAINT "SocialContentPlatform_socialContentId_fkey" FOREIGN KEY ("socialContentId") REFERENCES "SocialContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialContentMedia" ADD CONSTRAINT "SocialContentMedia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialContentMedia" ADD CONSTRAINT "SocialContentMedia_socialContentId_fkey" FOREIGN KEY ("socialContentId") REFERENCES "SocialContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialContentMedia" ADD CONSTRAINT "SocialContentMedia_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
