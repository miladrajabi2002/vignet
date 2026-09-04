-- Marketing showcase: customer stories on the public homepage, managed
-- from the admin panel (no deploy needed to add/remove a customer).
CREATE TABLE "ShowcaseEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "url" TEXT,
    "imageUrl" TEXT,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quote" TEXT,
    "metricValue" TEXT,
    "metricLabel" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowcaseEntry_pkey" PRIMARY KEY ("id")
);

-- Homepage reads active entries ordered by sortOrder.
CREATE INDEX "ShowcaseEntry_active_sortOrder_idx" ON "ShowcaseEntry"("active", "sortOrder");
