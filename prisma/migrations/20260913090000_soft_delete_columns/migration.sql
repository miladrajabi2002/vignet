-- Soft delete (undo) support, step 1 of 2: add the nullable `deletedAt` column
-- to the four bulk-managed entities. This step is fully backward compatible —
-- the previous code ignores the column, and every existing row stays "live"
-- (NULL). The Prisma client extension in lib/prisma.ts reads it afterwards.
--
-- Step 2 (20260913090100_soft_delete_partial_uniques) converts three unique
-- indexes into partial ones and MUST run only after the new code is deployed.

ALTER TABLE "Product" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "StoreOrder" ADD COLUMN "deletedAt" TIMESTAMP(3);
