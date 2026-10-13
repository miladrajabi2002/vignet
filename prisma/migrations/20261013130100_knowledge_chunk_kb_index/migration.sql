-- KnowledgeChunk lookups by knowledge base (2026-10-13)
--
-- Re-ingesting a knowledge base deletes its chunks by kbId, and deleting the
-- base cascades the same way. Neither had an index to use, so each one read
-- every chunk of every workspace.
--
-- A single statement, so CONCURRENTLY is accepted by `prisma migrate deploy`
-- (it is not wrapped in a multi-statement transaction block) and the table is
-- never write-locked. Re-running is safe.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "KnowledgeChunk_kbId_idx" ON "KnowledgeChunk" ("kbId");
