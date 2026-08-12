-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('META');

-- CreateEnum
CREATE TYPE "SocialConnectionStatus" AS ENUM ('CONNECTED', 'EXPIRED', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "SocialPublicationStatus" AS ENUM ('PENDING', 'READY', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SocialOAuthSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL DEFAULT 'META',
    "state" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "reconnectConnectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialOAuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL DEFAULT 'META',
    "externalUserId" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "accessTokenIv" TEXT NOT NULL,
    "accessTokenTag" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "grantedScopes" JSONB NOT NULL,
    "status" "SocialConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "socialConnectionId" TEXT NOT NULL,
    "socialBrandId" TEXT,
    "platform" "SocialPlatform" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "parentExternalId" TEXT,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "profilePictureUrl" TEXT,
    "accountType" TEXT,
    "accessTokenEncrypted" TEXT,
    "accessTokenIv" TEXT,
    "accessTokenTag" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectionStatus" "SocialConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialContentDestination" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "socialContentId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "publicationStatus" "SocialPublicationStatus" NOT NULL DEFAULT 'PENDING',
    "externalPostId" TEXT,
    "externalContainerId" TEXT,
    "permalink" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "publishedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialContentDestination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialOAuthSession_state_key" ON "SocialOAuthSession"("state");

-- CreateIndex
CREATE INDEX "SocialOAuthSession_tenantId_idx" ON "SocialOAuthSession"("tenantId");

-- CreateIndex
CREATE INDEX "SocialOAuthSession_userId_idx" ON "SocialOAuthSession"("userId");

-- CreateIndex
CREATE INDEX "SocialOAuthSession_expiresAt_idx" ON "SocialOAuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "SocialConnection_tenantId_idx" ON "SocialConnection"("tenantId");

-- CreateIndex
CREATE INDEX "SocialConnection_tenantId_provider_status_idx" ON "SocialConnection"("tenantId", "provider", "status");

-- CreateIndex
CREATE INDEX "SocialConnection_createdById_idx" ON "SocialConnection"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_tenantId_platform_externalAccountId_key" ON "SocialAccount"("tenantId", "platform", "externalAccountId");

-- CreateIndex
CREATE INDEX "SocialAccount_tenantId_idx" ON "SocialAccount"("tenantId");

-- CreateIndex
CREATE INDEX "SocialAccount_tenantId_platform_isActive_idx" ON "SocialAccount"("tenantId", "platform", "isActive");

-- CreateIndex
CREATE INDEX "SocialAccount_socialConnectionId_idx" ON "SocialAccount"("socialConnectionId");

-- CreateIndex
CREATE INDEX "SocialAccount_socialBrandId_idx" ON "SocialAccount"("socialBrandId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialContentDestination_socialContentId_socialAccountId_key" ON "SocialContentDestination"("socialContentId", "socialAccountId");

-- CreateIndex
CREATE INDEX "SocialContentDestination_tenantId_idx" ON "SocialContentDestination"("tenantId");

-- CreateIndex
CREATE INDEX "SocialContentDestination_tenantId_publicationStatus_idx" ON "SocialContentDestination"("tenantId", "publicationStatus");

-- CreateIndex
CREATE INDEX "SocialContentDestination_socialAccountId_idx" ON "SocialContentDestination"("socialAccountId");

-- AddForeignKey
ALTER TABLE "SocialOAuthSession" ADD CONSTRAINT "SocialOAuthSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialOAuthSession" ADD CONSTRAINT "SocialOAuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_socialConnectionId_fkey" FOREIGN KEY ("socialConnectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_socialBrandId_fkey" FOREIGN KEY ("socialBrandId") REFERENCES "SocialBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialContentDestination" ADD CONSTRAINT "SocialContentDestination_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialContentDestination" ADD CONSTRAINT "SocialContentDestination_socialContentId_fkey" FOREIGN KEY ("socialContentId") REFERENCES "SocialContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialContentDestination" ADD CONSTRAINT "SocialContentDestination_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
