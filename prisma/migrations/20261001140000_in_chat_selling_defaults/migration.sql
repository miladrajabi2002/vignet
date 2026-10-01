-- In-chat selling (order capture + payment link) is on by default once a
-- checkout-capable WooCommerce plugin (5.0+) is connected. The *Configured
-- flags record that the owner chose themselves, which the default never undoes.
ALTER TABLE "Agent" ADD COLUMN "orderCaptureConfigured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Agent" ADD COLUMN "payLinkConfigured" BOOLEAN NOT NULL DEFAULT false;

-- Stores already running plugin 5.0+ get the default now.
UPDATE "Agent" SET "orderCaptureEnabled" = true, "payLinkEnabled" = true
WHERE "workspaceId" IN (
  SELECT "workspaceId" FROM "StoreIntegration"
  WHERE "type" = 'WOOCOMMERCE' AND "active" = true AND "webhookSecret" IS NOT NULL
    AND "pluginVersion" ~ '^0*([5-9]|[1-9][0-9]+)\.'
);
