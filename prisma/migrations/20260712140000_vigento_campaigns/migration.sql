-- Vigento operational telemetry (privacy-safe: no raw prompt or draft).
ALTER TYPE "LogType" ADD VALUE 'VIGENTO_DRAFT';

CREATE TYPE "VigentoRunStatus" AS ENUM ('SUCCEEDED', 'FAILED');

CREATE TABLE "VigentoRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "VigentoRunStatus" NOT NULL,
    "modelAlias" TEXT,
    "durationMs" INTEGER NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "helpful" BOOLEAN,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VigentoRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VigentoRun_workspaceId_createdAt_idx" ON "VigentoRun"("workspaceId", "createdAt");
CREATE INDEX "VigentoRun_status_createdAt_idx" ON "VigentoRun"("status", "createdAt");
ALTER TABLE "VigentoRun" ADD CONSTRAINT "VigentoRun_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Explicit marketing consent. Existing contacts remain opted out.
ALTER TABLE "Contact"
    ADD COLUMN "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "marketingOptInAt" TIMESTAMP(3),
    ADD COLUMN "marketingOptOutAt" TIMESTAMP(3);

CREATE TYPE "CampaignStatus" AS ENUM (
    'DRAFT', 'QUEUED', 'SENDING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'
);
CREATE TYPE "CampaignRecipientStatus" AS ENUM (
    'PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED'
);

CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceSnapshot" JSONB NOT NULL,
    "expectedRecipientCount" INTEGER NOT NULL,
    "eligibleCount" INTEGER NOT NULL DEFAULT 0,
    "excludedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "CampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "ChannelType",
    "conversationId" TEXT,
    "errorCode" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Campaign_workspaceId_createdAt_idx" ON "Campaign"("workspaceId", "createdAt");
CREATE INDEX "Campaign_status_createdAt_idx" ON "Campaign"("status", "createdAt");
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_contactId_key" ON "CampaignRecipient"("campaignId", "contactId");
CREATE INDEX "CampaignRecipient_campaignId_status_idx" ON "CampaignRecipient"("campaignId", "status");
CREATE INDEX "CampaignRecipient_contactId_idx" ON "CampaignRecipient"("contactId");

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
