-- Migracao opcional para producao com PostgreSQL + pgvector.
-- Execute apos 'alembic upgrade head' quando VECTOR_BACKEND=pgvector.
-- Ajuste a dimensao (384) para a do provedor de embeddings em uso.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE knowledge_documents
    ADD COLUMN IF NOT EXISTS embedding_vec vector(384);

-- Popula a coluna vetorial a partir do JSON ja armazenado
UPDATE knowledge_documents
SET embedding_vec = embedding::text::vector
WHERE embedding IS NOT NULL AND embedding::text <> '[]' AND embedding_vec IS NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_vec
    ON knowledge_documents USING hnsw (embedding_vec vector_cosine_ops);
