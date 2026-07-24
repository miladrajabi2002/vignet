-- Migration: add_product_unique_constraints
--
-- Adds:
--   • unique (workspaceId, sku) on Product   — DB-level guarantee that the
--     WooCommerce sync can never create duplicate rows even if the app-layer
--     dedup has a bug. NULL skus are allowed (Postgres treats NULL ≠ NULL on
--     unique indexes), so products without a SKU don't conflict.
--   • index  (workspaceId, name) on Product  — speeds up the name-based
--     fallback lookup in findExistingProduct.
--
-- Before creating the unique constraint we deduplicate any existing rows that
-- would violate it: for each (workspaceId, sku) pair with more than one row,
-- keep the most recently updated row and delete the rest. CatalogItems rows
-- cascade on delete, and the embedded chunks for the deleted products are
-- cleaned up lazily by the next embed run.
--
-- This migration is idempotent — safe to re-run.

-- ─── 1. Dedupe existing rows by (workspaceId, sku) ───────────────────────────
-- Keep the row with the latest `updatedAt`; drop the rest. We only consider
-- non-null skus (NULLs are exempt from the unique constraint anyway).
DELETE FROM "Product"
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "workspaceId", sku
        ORDER BY "updatedAt" DESC NULLS LAST, "createdAt" DESC
      ) AS rn
    FROM "Product"
    WHERE sku IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- ─── 2. Create the unique index ──────────────────────────────────────────────
-- Use CREATE UNIQUE INDEX IF NOT EXISTS so re-runs are safe.
CREATE UNIQUE INDEX IF NOT EXISTS "Product_workspaceId_sku_key"
  ON "Product" ("workspaceId", sku);

-- ─── 3. Create the (workspaceId, name) index ─────────────────────────────────
CREATE INDEX IF NOT EXISTS "Product_workspaceId_name_idx"
  ON "Product" ("workspaceId", name);
