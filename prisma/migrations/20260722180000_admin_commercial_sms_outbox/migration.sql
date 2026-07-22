-- A durable, payment-unique outbox keeps commercial SMS alerts retryable after
-- the payment transaction commits or the provider is temporarily unavailable.
CREATE TABLE "AdminCommercialSmsOutbox" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminCommercialSmsOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminCommercialSmsOutbox_paymentId_key"
ON "AdminCommercialSmsOutbox"("paymentId");

CREATE INDEX "AdminCommercialSmsOutbox_sentAt_nextAttemptAt_idx"
ON "AdminCommercialSmsOutbox"("sentAt", "nextAttemptAt");

CREATE INDEX "AdminCommercialSmsOutbox_workspaceId_createdAt_idx"
ON "AdminCommercialSmsOutbox"("workspaceId", "createdAt");

ALTER TABLE "AdminCommercialSmsOutbox"
ADD CONSTRAINT "AdminCommercialSmsOutbox_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminCommercialSmsOutbox"
ADD CONSTRAINT "AdminCommercialSmsOutbox_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
