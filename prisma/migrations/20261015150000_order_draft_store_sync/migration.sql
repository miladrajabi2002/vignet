-- A chat order paid by card-to-card is placed on the connected WooCommerce store.
ALTER TABLE "OrderDraft" ADD COLUMN "storeSyncAt" TIMESTAMP(3);
ALTER TABLE "OrderDraft" ADD COLUMN "storeSyncTries" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderDraft" ADD COLUMN "storeSyncError" TEXT;

CREATE INDEX "OrderDraft_storeSyncAt_idx" ON "OrderDraft"("storeSyncAt");
