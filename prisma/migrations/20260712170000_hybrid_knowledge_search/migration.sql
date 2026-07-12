-- Exact-term side of hybrid RAG. The vector HNSW index already exists; this
-- expression GIN index keeps tenant-filtered lexical recall fast for names,
-- SKUs, policy phrases, and Persian terms.
CREATE INDEX "KnowledgeChunk_content_fts_idx"
    ON "KnowledgeChunk"
    USING GIN (to_tsvector('simple', "content"));
