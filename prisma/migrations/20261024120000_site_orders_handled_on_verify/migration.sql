-- A connected site's paid order is handled once the site verifies it: the
-- site delivers it itself, so it no longer waits in the owner's «خرید موفق» list.
UPDATE "CardPayment"
SET "handledAt" = "verifiedAt"
WHERE "source" = 'API'
  AND "purpose" = 'ORDER'
  AND "status" = 'PAID'
  AND "verifiedAt" IS NOT NULL
  AND "handledAt" IS NULL;
