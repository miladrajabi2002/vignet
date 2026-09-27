-- Fast-moving URL sources (price/availability pages) need sub-hour re-crawl
-- cadences the hourly Int column cannot express. Nullable additive column:
-- null/0 = use the legacy refreshIntervalHours cadence.
ALTER TABLE "KnowledgeBase" ADD COLUMN "refreshIntervalMinutes" INTEGER;
