-- AlterEnum BlockType
ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'IMAGE';
ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'VIDEO';
ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'FILE';

-- CreateEnum MediaCategory
DO $$ BEGIN
  CREATE TYPE "MediaCategory" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable MediaAsset
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "originalFileName" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "width" INTEGER;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "height" INTEGER;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "duration" DOUBLE PRECISION;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "category" "MediaCategory";
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "MediaAsset" SET "originalFileName" = "fileName" WHERE "originalFileName" IS NULL;
UPDATE "MediaAsset" SET "category" = 'OTHER' WHERE "category" IS NULL;

ALTER TABLE "MediaAsset" ALTER COLUMN "originalFileName" SET NOT NULL;
ALTER TABLE "MediaAsset" ALTER COLUMN "category" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "MediaAsset_tenantId_category_idx" ON "MediaAsset"("tenantId", "category");

-- AlterTable Block
ALTER TABLE "Block" ADD COLUMN IF NOT EXISTS "mediaAssetId" TEXT;
CREATE INDEX IF NOT EXISTS "Block_mediaAssetId_idx" ON "Block"("mediaAssetId");

DO $$ BEGIN
  ALTER TABLE "Block" ADD CONSTRAINT "Block_mediaAssetId_fkey"
    FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
