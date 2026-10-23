-- A business's own SMS panel (IPPanel/FarazSMS, Kavenegar) for texting its
-- customers, the sends made with it and each recipient's delivery state.
-- Separate from the platform's IPPanel account used for login codes.

-- CreateEnum
CREATE TYPE "SmsProviderType" AS ENUM ('IPPANEL', 'KAVENEGAR');

-- CreateEnum
CREATE TYPE "SmsCampaignKind" AS ENUM ('MARKETING', 'TRANSACTIONAL');

-- CreateEnum
CREATE TYPE "SmsCampaignStatus" AS ENUM ('QUEUED', 'SENDING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "SmsRecipientStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'UNDELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "WorkspaceSmsProvider" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "SmsProviderType" NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "apiKeyHint" TEXT NOT NULL,
    "senderNumber" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "credit" DOUBLE PRECISION,
    "creditAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "WorkspaceSmsProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsCampaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "SmsCampaignKind" NOT NULL,
    "template" TEXT NOT NULL,
    "provider" "SmsProviderType" NOT NULL,
    "senderNumber" TEXT NOT NULL,
    "status" "SmsCampaignStatus" NOT NULL DEFAULT 'QUEUED',
    "recipientCount" INTEGER NOT NULL,
    "excludedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "segmentCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

CONSTRAINT "SmsCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "segments" INTEGER NOT NULL,
    "status" "SmsRecipientStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "error" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "statusCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "SmsRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSmsProvider_workspaceId_key" ON "WorkspaceSmsProvider"("workspaceId");

-- CreateIndex
CREATE INDEX "SmsCampaign_workspaceId_createdAt_idx" ON "SmsCampaign"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsCampaign_status_createdAt_idx" ON "SmsCampaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SmsRecipient_campaignId_status_idx" ON "SmsRecipient"("campaignId", "status");

-- CreateIndex
CREATE INDEX "SmsRecipient_workspaceId_contactId_createdAt_idx" ON "SmsRecipient"("workspaceId", "contactId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsRecipient_status_sentAt_idx" ON "SmsRecipient"("status", "sentAt");

-- AddForeignKey
ALTER TABLE "WorkspaceSmsProvider" ADD CONSTRAINT "WorkspaceSmsProvider_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCampaign" ADD CONSTRAINT "SmsCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsRecipient" ADD CONSTRAINT "SmsRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SmsCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsRecipient" ADD CONSTRAINT "SmsRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
