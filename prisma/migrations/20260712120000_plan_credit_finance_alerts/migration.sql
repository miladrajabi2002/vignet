-- Distinguish subscription-included credit from cash top-ups and keep grants
-- idempotent even if a payment callback is delivered more than once.
ALTER TYPE "WalletEntryType" ADD VALUE IF NOT EXISTS 'PLAN_CREDIT_GRANT';

ALTER TABLE "WalletLedger" ADD COLUMN "grantKey" TEXT;
CREATE UNIQUE INDEX "WalletLedger_grantKey_key" ON "WalletLedger"("grantKey");

-- One low-credit latch per workspace/model. It is re-armed only after a
-- successful reply observes a balance back above that model's threshold.
CREATE TABLE "CreditAlertState" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "modelAlias" TEXT NOT NULL,
    "armed" BOOLEAN NOT NULL DEFAULT true,
    "lastAlertedAt" TIMESTAMP(3),
    "thresholdIRR" INTEGER NOT NULL,
    "lastBalanceIRR" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAlertState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditAlertState_workspaceId_modelAlias_key"
    ON "CreditAlertState"("workspaceId", "modelAlias");
CREATE INDEX "CreditAlertState_workspaceId_updatedAt_idx"
    ON "CreditAlertState"("workspaceId", "updatedAt");

ALTER TABLE "CreditAlertState"
    ADD CONSTRAINT "CreditAlertState_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
