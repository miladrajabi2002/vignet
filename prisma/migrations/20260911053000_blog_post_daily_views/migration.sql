-- Blog daily view counters: per-post, per-day aggregate written by the
-- public view beacon (POST /api/blog/[slug]/view) alongside BlogPost.views.
-- `day` is a pure Tehran calendar-date key stored as UTC midnight.
CREATE TABLE "BlogPostDailyView" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BlogPostDailyView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlogPostDailyView_day_idx" ON "BlogPostDailyView"("day");

-- CreateIndex
CREATE INDEX "BlogPostDailyView_postId_day_idx" ON "BlogPostDailyView"("postId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostDailyView_postId_day_key" ON "BlogPostDailyView"("postId", "day");

-- AddForeignKey
ALTER TABLE "BlogPostDailyView" ADD CONSTRAINT "BlogPostDailyView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
