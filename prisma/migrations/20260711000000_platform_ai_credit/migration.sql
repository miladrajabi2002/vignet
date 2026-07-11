-- Platform-managed AI + prepaid successful-reply credit.
CREATE TYPE "UsageStatus" AS ENUM ('RESERVED', 'CAPTURED', 'RELEASED');
CREATE TYPE "PaymentKind" AS ENUM ('SUBSCRIPTION', 'AI_CREDIT');
CREATE TYPE "WalletEntryType" AS ENUM ('CREDIT_TOPUP', 'AI_CHARGE', 'AI_REFUND', 'ADMIN_ADJUSTMENT');
ALTER TYPE "LogType" ADD VALUE IF NOT EXISTS 'SUMMARY';
ALTER TYPE "LogType" ADD VALUE IF NOT EXISTS 'LEARNING';

ALTER TABLE "Workspace"
  ADD COLUMN "aiCreditBalanceIRR" INTEGER NOT NULL DEFAULT 100000,
  ADD COLUMN "aiCreditReservedIRR" INTEGER NOT NULL DEFAULT 0;

-- Migrate arbitrary historical provider slugs into controlled aliases.
UPDATE "Workspace" SET "defaultModel" = CASE
  WHEN "defaultModel" IN ('deepseek/deepseek-v4-pro', 'anthropic/claude-sonnet-5', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o') THEN 'premium'
  WHEN "defaultModel" IN ('qwen/qwen3.5-35b-a3b', 'qwen/qwen-2.5-72b-instruct', 'openai/gpt-4o-mini', 'anthropic/claude-haiku-4.5') THEN 'balanced'
  ELSE 'fast'
END;
ALTER TABLE "Workspace" ALTER COLUMN "defaultModel" SET DEFAULT 'fast';

-- OpenRouter requires the provider-qualified embedding slug. Older rows used
-- the OpenAI-only shorthand, which the embeddings router rejects.
UPDATE "Workspace"
SET "defaultEmbedModel" = 'openai/text-embedding-3-small'
WHERE "defaultEmbedModel" = 'text-embedding-3-small';
ALTER TABLE "Workspace"
  ALTER COLUMN "defaultEmbedModel" SET DEFAULT 'openai/text-embedding-3-small';

UPDATE "Agent" SET "model" = CASE
  WHEN "model" IS NULL OR "model" = '' THEN NULL
  WHEN "model" IN ('deepseek/deepseek-v4-pro', 'anthropic/claude-sonnet-5', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o') THEN 'premium'
  WHEN "model" IN ('qwen/qwen3.5-35b-a3b', 'qwen/qwen-2.5-72b-instruct', 'openai/gpt-4o-mini', 'anthropic/claude-haiku-4.5') THEN 'balanced'
  ELSE 'fast'
END;

-- Tenant OpenRouter secrets are no longer used. Operators should retain the
-- encryption key because channel/integration credentials still depend on it.
ALTER TABLE "Workspace"
  DROP COLUMN "openrouterKeyEnc",
  DROP COLUMN "openrouterKeyHint";

ALTER TABLE "UsageLog"
  ADD COLUMN "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cachedTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "providerRequestId" TEXT,
  ADD COLUMN "chargedIRR" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "status" "UsageStatus" NOT NULL DEFAULT 'CAPTURED',
  ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "UsageLog_idempotencyKey_key" ON "UsageLog"("idempotencyKey");

ALTER TABLE "Payment"
  ADD COLUMN "kind" "PaymentKind" NOT NULL DEFAULT 'SUBSCRIPTION',
  ALTER COLUMN "plan" DROP NOT NULL;

CREATE TABLE "WalletLedger" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "usageLogId" TEXT,
  "paymentId" TEXT,
  "type" "WalletEntryType" NOT NULL,
  "amountIRR" INTEGER NOT NULL,
  "balanceAfterIRR" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletLedger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WalletLedger_usageLogId_idx" ON "WalletLedger"("usageLogId");
CREATE UNIQUE INDEX "WalletLedger_paymentId_key" ON "WalletLedger"("paymentId");
CREATE INDEX "WalletLedger_workspaceId_createdAt_idx" ON "WalletLedger"("workspaceId", "createdAt");
ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_usageLogId_fkey" FOREIGN KEY ("usageLogId") REFERENCES "UsageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing workspaces receive a small transition/trial credit. Historical
-- UsageLog rows remain non-billable; billing begins with new CAPTURED events.
UPDATE "Workspace" SET "onboardingStep" = LEAST("onboardingStep", 4);

CREATE TABLE "PlatformAiSettings" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "defaultModel" TEXT NOT NULL DEFAULT 'fast',
  "enabledModels" TEXT[] NOT NULL DEFAULT ARRAY['fast', 'balanced', 'premium']::TEXT[],
  "monthlyBudgetUSD" DOUBLE PRECISION,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformAiSettings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "PlatformAiSettings" ("id", "defaultModel", "enabledModels", "updatedAt")
VALUES ('primary', 'fast', ARRAY['fast', 'balanced', 'premium']::TEXT[], CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
