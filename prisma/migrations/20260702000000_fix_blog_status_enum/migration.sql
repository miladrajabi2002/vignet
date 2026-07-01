-- Fix: BlogPost.status was created as TEXT by migration 20260701000000_add_blog,
-- but the Prisma schema declares it as the BlogStatus enum. This type mismatch
-- caused PostgreSQL error 42883:
--   "operator does not exist: text = BlogStatus"
-- whenever Prisma tried to filter on status (e.g. findMany({ where: { status: 'PUBLISHED' } })).
--
-- This migration casts the column to the existing BlogStatus enum. All current
-- values ('DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED') are valid members,
-- so the cast is lossless.

ALTER TABLE "BlogPost" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BlogPost" ALTER COLUMN "status" TYPE "BlogStatus" USING "status"::"BlogStatus";
ALTER TABLE "BlogPost" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"BlogStatus";
