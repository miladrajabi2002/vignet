-- A short deposit attached by the owner keeps the payment open for the rest; a larger one records the extra.
ALTER TABLE "CardPayment" ADD COLUMN "partialAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CardPayment" ADD COLUMN "overpaidAmount" INTEGER;

-- The owner can stop card-to-card for one customer.
ALTER TABLE "Contact" ADD COLUMN "cardPayBlockedAt" TIMESTAMP(3);
