-- WooCommerce delta-sync foundation:
-- stable source identities, category mapping, agent access switches and
-- durable/idempotent webhook delivery tracking.

ALTER TABLE "Agent"
  ADD COLUMN "productAccessEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "orderTrackingEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Product"
  ADD COLUMN "sourceIntegrationId" TEXT,
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "sourceHash" TEXT;

ALTER TABLE "ProductCategory"
  ADD COLUMN "sourceIntegrationId" TEXT,
  ADD COLUMN "externalId" TEXT;

ALTER TABLE "StoreIntegration"
  ADD COLUMN "connectedAt" TIMESTAMP(3),
  ADD COLUMN "lastWebhookAt" TIMESTAMP(3),
  ADD COLUMN "pluginVersion" TEXT;

-- A SKU is not globally unique when a workspace connects multiple stores.
-- Source integration + external id is the authoritative identity.
DROP INDEX IF EXISTS "Product_workspaceId_sku_key";
CREATE INDEX "Product_workspaceId_sku_idx"
  ON "Product"("workspaceId", "sku");
-- Manual products keep DB-level duplicate-SKU protection, while independent
-- external stores may legitimately reuse an SKU. Orphaned source products
-- retain externalId and are not mistaken for manually-created rows.
CREATE UNIQUE INDEX "Product_manual_workspaceId_sku_key"
  ON "Product"("workspaceId", "sku")
  WHERE "sourceIntegrationId" IS NULL
    AND "externalId" IS NULL
    AND "sku" IS NOT NULL;
CREATE UNIQUE INDEX "Product_sourceIntegrationId_externalId_key"
  ON "Product"("sourceIntegrationId", "externalId");
CREATE INDEX "Product_sourceIntegrationId_idx"
  ON "Product"("sourceIntegrationId");

CREATE UNIQUE INDEX "ProductCategory_sourceIntegrationId_externalId_key"
  ON "ProductCategory"("sourceIntegrationId", "externalId");
CREATE INDEX "ProductCategory_sourceIntegrationId_idx"
  ON "ProductCategory"("sourceIntegrationId");

CREATE INDEX "StoreIntegration_webhookSecret_idx"
  ON "StoreIntegration"("webhookSecret");

CREATE TABLE "StoreWebhookDelivery" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "eventCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "error" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "StoreWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreWebhookDelivery_integrationId_deliveryId_key"
  ON "StoreWebhookDelivery"("integrationId", "deliveryId");
CREATE INDEX "StoreWebhookDelivery_integrationId_status_idx"
  ON "StoreWebhookDelivery"("integrationId", "status");
CREATE INDEX "StoreWebhookDelivery_receivedAt_idx"
  ON "StoreWebhookDelivery"("receivedAt");

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_sourceIntegrationId_fkey"
  FOREIGN KEY ("sourceIntegrationId") REFERENCES "StoreIntegration"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProductCategory"
  ADD CONSTRAINT "ProductCategory_sourceIntegrationId_fkey"
  FOREIGN KEY ("sourceIntegrationId") REFERENCES "StoreIntegration"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoreWebhookDelivery"
  ADD CONSTRAINT "StoreWebhookDelivery_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "StoreIntegration"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
