-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "payGatewayEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payGatewaySettings" JSONB;

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "cardPayConfigured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cardPayEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PayCard" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "panEncrypted" TEXT NOT NULL,
    "panHash" TEXT NOT NULL,
    "bin" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "bankKey" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dailyCap" INTEGER,
    "verifiedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayDevice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'ANDROID',
    "method" TEXT NOT NULL DEFAULT 'SMS',
    "phone" TEXT,
    "tokenHash" TEXT NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "lastSmsAt" TIMESTAMP(3),
    "silentClaims" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaySite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "keyHash" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaySite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPayment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "siteId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'CHAT',
    "orderDraftId" TEXT,
    "conversationId" TEXT,
    "authority" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "baseAmount" INTEGER NOT NULL,
    "payAmount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedBy" TEXT,
    "callbackUrl" TEXT,
    "returnUrl" TEXT,
    "callbackTries" INTEGER NOT NULL DEFAULT 0,
    "callbackNextAt" TIMESTAMP(3),
    "callbackDoneAt" TIMESTAMP(3),
    "callbackError" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notifiedStatus" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "holdUntil" TIMESTAMP(3) NOT NULL,
    "remindedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankSms" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "via" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER,
    "status" TEXT NOT NULL,
    "dedupeHash" TEXT NOT NULL,
    "paymentId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankSms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentGatewaySettings" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "planMonthlyCaps" JSONB NOT NULL DEFAULT '{}',
    "inboundLines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inboundSecret" TEXT,
    "maxAmount" INTEGER NOT NULL DEFAULT 10000000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGatewaySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayCard_workspaceId_active_idx" ON "PayCard"("workspaceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PayCard_workspaceId_panHash_key" ON "PayCard"("workspaceId", "panHash");

-- CreateIndex
CREATE UNIQUE INDEX "PayDevice_phone_key" ON "PayDevice"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "PayDevice_tokenHash_key" ON "PayDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "PayDevice_workspaceId_idx" ON "PayDevice"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaySite_keyHash_key" ON "PaySite"("keyHash");

-- CreateIndex
CREATE INDEX "PaySite_workspaceId_idx" ON "PaySite"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CardPayment_authority_key" ON "CardPayment"("authority");

-- CreateIndex
CREATE INDEX "CardPayment_workspaceId_status_payAmount_idx" ON "CardPayment"("workspaceId", "status", "payAmount");

-- CreateIndex
CREATE INDEX "CardPayment_workspaceId_createdAt_idx" ON "CardPayment"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "CardPayment_status_expiresAt_idx" ON "CardPayment"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "CardPayment_orderDraftId_idx" ON "CardPayment"("orderDraftId");

-- CreateIndex
CREATE INDEX "CardPayment_conversationId_idx" ON "CardPayment"("conversationId");

-- CreateIndex
CREATE INDEX "CardPayment_callbackNextAt_idx" ON "CardPayment"("callbackNextAt");

-- CreateIndex
CREATE UNIQUE INDEX "CardPayment_siteId_reference_key" ON "CardPayment"("siteId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "BankSms_dedupeHash_key" ON "BankSms"("dedupeHash");

-- CreateIndex
CREATE INDEX "BankSms_workspaceId_status_receivedAt_idx" ON "BankSms"("workspaceId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "BankSms_deviceId_receivedAt_idx" ON "BankSms"("deviceId", "receivedAt");

-- CreateIndex
CREATE INDEX "BankSms_status_receivedAt_idx" ON "BankSms"("status", "receivedAt");

-- AddForeignKey
ALTER TABLE "PayCard" ADD CONSTRAINT "PayCard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayDevice" ADD CONSTRAINT "PayDevice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaySite" ADD CONSTRAINT "PaySite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "PayCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "PaySite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSms" ADD CONSTRAINT "BankSms_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSms" ADD CONSTRAINT "BankSms_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "PayDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSms" ADD CONSTRAINT "BankSms_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CardPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

