-- Brand logos for the homepage trust bar (managed from /admin/showcase)
CREATE TABLE "TrustedLogo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrustedLogo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrustedLogo_active_sortOrder_idx" ON "TrustedLogo"("active", "sortOrder");
