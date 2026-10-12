ALTER TABLE "StoreIntegration"
ADD COLUMN "productResyncNeededAt" TIMESTAMP(3);

-- Stores that are stopped at the product limit right now.
UPDATE "StoreIntegration"
SET "productResyncNeededAt" = CURRENT_TIMESTAMP
WHERE "lastSyncError" LIKE 'PRODUCT_LIMIT%';

-- Stores that upgraded before this column existed and are still holding
-- exactly the 50 products the trial let in.
UPDATE "StoreIntegration" AS si
SET "productResyncNeededAt" = CURRENT_TIMESTAMP
FROM "Workspace" AS w
WHERE w."id" = si."workspaceId"
  AND si."type" = 'WOOCOMMERCE'
  AND si."active" = true
  AND w."plan" <> 'TRIAL'
  AND (SELECT COUNT(*) FROM "Product" AS p WHERE p."workspaceId" = w."id") = 50;
