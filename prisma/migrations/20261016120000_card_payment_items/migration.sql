-- What a hand-made payment is for (products or free lines), shown on the pay page and in the dashboard.
ALTER TABLE "CardPayment" ADD COLUMN "items" JSONB;
