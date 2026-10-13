-- Chat link visits per day and per tracking source (2026-10-13)
--
-- `/c/<slug>?src=<key>` lets an owner share one link per place (bio, QR,
-- SMS) and see where visitors come from. '' is the plain link. Additive only;
-- re-running is safe.
CREATE TABLE IF NOT EXISTS "ChatLinkDailyStat" (
  "chatLinkId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "source" TEXT NOT NULL DEFAULT '',
  "views" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "ChatLinkDailyStat_pkey" PRIMARY KEY ("chatLinkId", "day", "source"),
  CONSTRAINT "ChatLinkDailyStat_chatLinkId_fkey" FOREIGN KEY ("chatLinkId") REFERENCES "ChatLink"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
