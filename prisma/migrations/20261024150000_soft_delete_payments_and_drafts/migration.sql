-- Gateway payments and chat pre-orders are soft-deleted like contacts and
-- orders: the owner gets «بازگردانی» (undo) and the worker purges after 7 days.
ALTER TABLE "CardPayment" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "CardPayment_deletedAt_idx" ON "CardPayment"("deletedAt");

ALTER TABLE "OrderDraft" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "OrderDraft_deletedAt_idx" ON "OrderDraft"("deletedAt");
