-- How a product reaches its buyer. Only SHIPPED goods make the chat ask for
-- a postal address; digital goods, services and pickup orders skip it.
CREATE TYPE "ProductFulfillment" AS ENUM ('SHIPPED', 'DIGITAL', 'SERVICE', 'PICKUP');

ALTER TABLE "Product" ADD COLUMN "fulfillment" "ProductFulfillment" NOT NULL DEFAULT 'SHIPPED';
