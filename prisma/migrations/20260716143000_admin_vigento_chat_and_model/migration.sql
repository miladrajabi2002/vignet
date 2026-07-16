ALTER TABLE "PlatformAiSettings"
ADD COLUMN "vigentoModel" TEXT NOT NULL DEFAULT 'balanced';

CREATE TABLE "AdminVigentoMessage" (
    "id" TEXT NOT NULL,
    "adminPhone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminVigentoMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminVigentoMessage_adminPhone_createdAt_idx"
ON "AdminVigentoMessage"("adminPhone", "createdAt");
