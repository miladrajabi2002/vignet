-- A paid order waits for the owner (deliver the goods, start the service) until they mark it handled.
ALTER TABLE "CardPayment" ADD COLUMN "handledAt" TIMESTAMP(3);

-- Payments confirmed before this existed are not news any more; the last
-- two days' chat orders stay open so their owners still see them.
UPDATE "CardPayment" SET "handledAt" = "paidAt"
WHERE "status" = 'PAID' AND ("source" <> 'CHAT' OR "paidAt" < NOW() - INTERVAL '2 days' OR "reference" LIKE 'TEST-%');

CREATE INDEX "CardPayment_workspaceId_status_handledAt_idx" ON "CardPayment"("workspaceId", "status", "handledAt");
