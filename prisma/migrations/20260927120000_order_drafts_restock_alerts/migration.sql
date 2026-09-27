-- In-chat pre-orders (OrderDraft), back-in-stock alerts (RestockAlert) and
-- the two agent switches. Purely additive: new tables/columns with defaults.
-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "orderCaptureEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "restockAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "OrderDraft" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "contactId" TEXT,
    "channel" "ChannelType" NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COLLECTING',
    "items" JSONB NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "city" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "note" TEXT,
    "total" DOUBLE PRECISION,
    "expecting" TEXT,
    "handoffAlertId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestockAlert" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "contactId" TEXT,
    "channel" "ChannelType" NOT NULL,
    "productId" TEXT NOT NULL,
    "variationId" INTEGER,
    "productName" TEXT NOT NULL,
    "variantLabel" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastError" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderDraft_code_key" ON "OrderDraft"("code");

-- CreateIndex
CREATE INDEX "OrderDraft_workspaceId_status_createdAt_idx" ON "OrderDraft"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderDraft_conversationId_status_idx" ON "OrderDraft"("conversationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RestockAlert_dedupeKey_key" ON "RestockAlert"("dedupeKey");

-- CreateIndex
CREATE INDEX "RestockAlert_status_createdAt_idx" ON "RestockAlert"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RestockAlert_workspaceId_status_idx" ON "RestockAlert"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "RestockAlert_productId_status_idx" ON "RestockAlert"("productId", "status");

-- AddForeignKey
ALTER TABLE "OrderDraft" ADD CONSTRAINT "OrderDraft_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDraft" ADD CONSTRAINT "OrderDraft_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDraft" ADD CONSTRAINT "OrderDraft_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestockAlert" ADD CONSTRAINT "RestockAlert_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestockAlert" ADD CONSTRAINT "RestockAlert_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestockAlert" ADD CONSTRAINT "RestockAlert_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestockAlert" ADD CONSTRAINT "RestockAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
