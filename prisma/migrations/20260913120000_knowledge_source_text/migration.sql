-- Preserve the author's original text independently from derived vector chunks
-- so existing knowledge can be opened, edited and re-ingested in place.
ALTER TABLE "KnowledgeBase" ADD COLUMN "sourceText" TEXT;
