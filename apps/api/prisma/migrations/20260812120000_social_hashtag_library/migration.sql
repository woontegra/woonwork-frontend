-- CreateEnum
CREATE TYPE "SocialHashtagStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'DISABLED');

-- CreateTable
CREATE TABLE "SocialHashtag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "socialBrandId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "tagKey" TEXT NOT NULL,
    "status" "SocialHashtagStatus" NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT,
    "notes" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialHashtag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialHashtag_tenantId_socialBrandId_tagKey_key" ON "SocialHashtag"("tenantId", "socialBrandId", "tagKey");

-- CreateIndex
CREATE INDEX "SocialHashtag_tenantId_socialBrandId_status_idx" ON "SocialHashtag"("tenantId", "socialBrandId", "status");

-- CreateIndex
CREATE INDEX "SocialHashtag_tenantId_status_idx" ON "SocialHashtag"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "SocialHashtag" ADD CONSTRAINT "SocialHashtag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialHashtag" ADD CONSTRAINT "SocialHashtag_socialBrandId_fkey" FOREIGN KEY ("socialBrandId") REFERENCES "SocialBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
