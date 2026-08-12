-- BlockType DATABASE
ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'DATABASE';

-- Enums
DO $$ BEGIN
  CREATE TYPE "DatabasePropertyType" AS ENUM (
    'TITLE','TEXT','NUMBER','SELECT','MULTI_SELECT','STATUS','DATE','CHECKBOX','URL','EMAIL','PHONE','PERSON'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DatabaseViewType" AS ENUM ('TABLE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Database
CREATE TABLE IF NOT EXISTS "Database" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "pageId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Database_tenantId_idx" ON "Database"("tenantId");
CREATE INDEX IF NOT EXISTS "Database_tenantId_updatedAt_idx" ON "Database"("tenantId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Database_pageId_idx" ON "Database"("pageId");

DO $$ BEGIN
  ALTER TABLE "Database" ADD CONSTRAINT "Database_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Database" ADD CONSTRAINT "Database_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Database" ADD CONSTRAINT "Database_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "DatabaseProperty" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "databaseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "DatabasePropertyType" NOT NULL,
  "position" DOUBLE PRECISION NOT NULL,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "DatabaseProperty_tenantId_idx" ON "DatabaseProperty"("tenantId");
CREATE INDEX IF NOT EXISTS "DatabaseProperty_databaseId_position_idx" ON "DatabaseProperty"("databaseId", "position");
CREATE INDEX IF NOT EXISTS "DatabaseProperty_tenantId_databaseId_idx" ON "DatabaseProperty"("tenantId", "databaseId");

DO $$ BEGIN
  ALTER TABLE "DatabaseProperty" ADD CONSTRAINT "DatabaseProperty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "DatabaseProperty" ADD CONSTRAINT "DatabaseProperty_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "Database"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "DatabaseRow" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "databaseId" TEXT NOT NULL,
  "position" DOUBLE PRECISION NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "DatabaseRow_tenantId_idx" ON "DatabaseRow"("tenantId");
CREATE INDEX IF NOT EXISTS "DatabaseRow_databaseId_position_idx" ON "DatabaseRow"("databaseId", "position");
CREATE INDEX IF NOT EXISTS "DatabaseRow_tenantId_databaseId_idx" ON "DatabaseRow"("tenantId", "databaseId");

DO $$ BEGIN
  ALTER TABLE "DatabaseRow" ADD CONSTRAINT "DatabaseRow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "DatabaseRow" ADD CONSTRAINT "DatabaseRow_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "Database"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "DatabaseRow" ADD CONSTRAINT "DatabaseRow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "DatabaseCell" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "rowId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "DatabaseCell_rowId_propertyId_key" ON "DatabaseCell"("rowId", "propertyId");
CREATE INDEX IF NOT EXISTS "DatabaseCell_tenantId_idx" ON "DatabaseCell"("tenantId");
CREATE INDEX IF NOT EXISTS "DatabaseCell_propertyId_idx" ON "DatabaseCell"("propertyId");
CREATE INDEX IF NOT EXISTS "DatabaseCell_tenantId_rowId_idx" ON "DatabaseCell"("tenantId", "rowId");

DO $$ BEGIN
  ALTER TABLE "DatabaseCell" ADD CONSTRAINT "DatabaseCell_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "DatabaseCell" ADD CONSTRAINT "DatabaseCell_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "DatabaseRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "DatabaseCell" ADD CONSTRAINT "DatabaseCell_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "DatabaseProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "DatabaseView" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "databaseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "DatabaseViewType" NOT NULL DEFAULT 'TABLE',
  "config" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "DatabaseView_tenantId_idx" ON "DatabaseView"("tenantId");
CREATE INDEX IF NOT EXISTS "DatabaseView_databaseId_idx" ON "DatabaseView"("databaseId");
CREATE INDEX IF NOT EXISTS "DatabaseView_tenantId_databaseId_idx" ON "DatabaseView"("tenantId", "databaseId");

DO $$ BEGIN
  ALTER TABLE "DatabaseView" ADD CONSTRAINT "DatabaseView_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "DatabaseView" ADD CONSTRAINT "DatabaseView_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "Database"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Block" ADD COLUMN IF NOT EXISTS "databaseId" TEXT;
CREATE INDEX IF NOT EXISTS "Block_databaseId_idx" ON "Block"("databaseId");
DO $$ BEGIN
  ALTER TABLE "Block" ADD CONSTRAINT "Block_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "Database"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
