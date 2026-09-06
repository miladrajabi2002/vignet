-- Login report + SMS delivery log (admin user profile v3.6)

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SmsDelivery" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "workspaceId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "isNewUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsDelivery_phone_createdAt_idx" ON "SmsDelivery"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "SmsDelivery_workspaceId_createdAt_idx" ON "SmsDelivery"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginEvent_workspaceId_createdAt_idx" ON "LoginEvent"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
