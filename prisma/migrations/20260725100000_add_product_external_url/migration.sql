-- AlterTable: add externalUrl column to Product.
-- Stores the canonical product URL on the source store (WooCommerce permalink,
-- Shopify URL, etc.). Used by the Instagram automation engine to render the
-- "View product" button on product cards. Nullable so existing rows stay valid
-- until the next WooCommerce sync backfills the value.

ALTER TABLE "Product" ADD COLUMN "externalUrl" TEXT;
