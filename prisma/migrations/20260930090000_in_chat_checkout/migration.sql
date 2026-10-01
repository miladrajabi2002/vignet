-- In-chat checkout: payment links that create the order on the connected
-- WooCommerce store (plugin 5.0+). Additive only; every column has a default
-- or is nullable, so the running app keeps working before and after deploy.
ALTER TABLE "Agent" ADD COLUMN "payLinkEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agent" ADD COLUMN "payLinkTtlHours" INTEGER NOT NULL DEFAULT 24;

ALTER TABLE "OrderDraft" ADD COLUMN "checkoutMode" TEXT NOT NULL DEFAULT 'PREORDER';
ALTER TABLE "OrderDraft" ADD COLUMN "integrationId" TEXT;
ALTER TABLE "OrderDraft" ADD COLUMN "province" TEXT;
ALTER TABLE "OrderDraft" ADD COLUMN "shippingRateId" TEXT;
ALTER TABLE "OrderDraft" ADD COLUMN "shippingLabel" TEXT;
ALTER TABLE "OrderDraft" ADD COLUMN "shippingTotal" DOUBLE PRECISION;
ALTER TABLE "OrderDraft" ADD COLUMN "discountTotal" DOUBLE PRECISION;
ALTER TABLE "OrderDraft" ADD COLUMN "grandTotal" DOUBLE PRECISION;
ALTER TABLE "OrderDraft" ADD COLUMN "coupons" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "OrderDraft" ADD COLUMN "quote" JSONB;
ALTER TABLE "OrderDraft" ADD COLUMN "quotedAt" TIMESTAMP(3);
ALTER TABLE "OrderDraft" ADD COLUMN "linkSlug" TEXT;
ALTER TABLE "OrderDraft" ADD COLUMN "linkExpiresAt" TIMESTAMP(3);
ALTER TABLE "OrderDraft" ADD COLUMN "linkSentAt" TIMESTAMP(3);
ALTER TABLE "OrderDraft" ADD COLUMN "linkClickedAt" TIMESTAMP(3);
ALTER TABLE "OrderDraft" ADD COLUMN "clickCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderDraft" ADD COLUMN "externalOrderId" TEXT;
ALTER TABLE "OrderDraft" ADD COLUMN "externalOrderNumber" TEXT;
ALTER TABLE "OrderDraft" ADD COLUMN "paymentMethodTitle" TEXT;
ALTER TABLE "OrderDraft" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "OrderDraft" ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderDraft" ADD COLUMN "remindedAt" TIMESTAMP(3);
ALTER TABLE "OrderDraft" ADD COLUMN "notifiedStatus" TEXT;
CREATE UNIQUE INDEX "OrderDraft_linkSlug_key" ON "OrderDraft"("linkSlug");
CREATE INDEX "OrderDraft_status_linkExpiresAt_idx" ON "OrderDraft"("status", "linkExpiresAt");
CREATE INDEX "OrderDraft_integrationId_idx" ON "OrderDraft"("integrationId");

ALTER TABLE "StoreIntegration" ADD COLUMN "checkoutFlow" TEXT NOT NULL DEFAULT 'AUTO';
ALTER TABLE "StoreIntegration" ADD COLUMN "capabilities" JSONB;
ALTER TABLE "StoreIntegration" ADD COLUMN "capabilitiesAt" TIMESTAMP(3);
