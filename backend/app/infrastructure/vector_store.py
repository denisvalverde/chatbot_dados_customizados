"""Vector store com interface abstrata (secao 4.4).

Padrao: LocalVectorStore — embeddings persistidos na propria tabela
knowledge_documents (JSON) e busca por cosseno em memoria (NumPy). Adequado
ate dezenas de milhares de documentos.

PgVectorStore: adapter para PostgreSQL + pgvector (producao), ativado com
VECTOR_BACKEND=pgvector e DATABASE_URL postgresql://...
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.infrastructure.models import KnowledgeDocument


@dataclass
class SearchHit:
    """Resultado de busca vetorial."""

    document: KnowledgeDocument
    similarity: float


class VectorStore(Protocol):
    """Contrato de armazenamento/busca vetorial."""

    def search(
        self,
        db: Session,
        query_vector: np.ndarray,
        limit: int = 10,
        category: str | None = None,
        document_type: str | None = None,
        only_approved: bool = False,
    ) -> list[SearchHit]:
        ...


class LocalVectorStore:
    """Busca por cosseno em memoria sobre os embeddings persistidos em JSON."""

    def search(
        self,
        db: Session,
        query_vector: np.ndarray,
        limit: int = 10,
        category: str | None = None,
        document_type: str | None = None,
        only_approved: bool = False,
    ) -> list[SearchHit]:
        from sqlalchemy import select

        query = select(KnowledgeDocument)
        if category:
            query = query.where(KnowledgeDocument.category == category)
        if document_type:
            query = query.where(KnowledgeDocument.document_type == document_type)
        if only_approved:
            query = query.where(KnowledgeDocument.approved.is_(True))
        docs: Sequence[KnowledgeDocument] = db.scalars(query).all()
        docs = [d for d in docs if d.embedding]
        if not docs:
            return []

        matrix = np.asarray([d.embedding for d in docs], dtype=np.float32)
        q = query_vector.astype(np.float32).reshape(-1)
        # vetores ja sao L2-normalizados => cosseno = produto interno
        sims = matrix @ q
        order = np.argsort(-sims)[:limit]
        return [SearchHit(document=docs[i], similarity=float(sims[i])) for i in order]


class PgVectorStore:
    """Busca via pgvector (operador <=> de distancia cosseno).

    Requer: PostgreSQL com extensao pgvector e coluna auxiliar criada pela
    migration opcional (ver migrations/pgvector.sql). Testado apenas quando
    ha Postgres disponivel; o compose de producao entrega isso pronto.
    """

    def search(
        self,
        db: Session,
        query_vector: np.ndarray,
        limit: int = 10,
        category: str | None = None,
        document_type: str | None = None,
        only_approved: bool = False,
    ) -> list[SearchHit]:
        vector_literal = "[" + ",".join(f"{v:.6f}" for v in query_vector.tolist()) + "]"
        filters = []
        params: dict = {"limit": limit}
        if category:
            filters.append("category = :category")
            params["category"] = category
        if document_type:
            filters.append("document_type = :document_type")
            params["document_type"] = document_type
        if only_approved:
            filters.append("approved = true")
        where = ("WHERE " + " AND ".join(filters)) if filters else ""
        rows = db.execute(
            text(
                f"""
                SELECT id, 1 - (embedding_vec <=> '{vector_literal}'::vector) AS sim
                FROM knowledge_documents {where}
                ORDER BY embedding_vec <=> '{vector_literal}'::vector
                LIMIT :limit
                """
            ),
            params,
        ).all()
        hits: list[SearchHit] = []
        for doc_id, sim in rows:
            doc = db.get(KnowledgeDocument, doc_id)
            if doc is not None:
                hits.append(SearchHit(document=doc, similarity=float(sim)))
        return hits


_store: VectorStore | None = None


def get_vector_store() -> VectorStore:
    """Fabrica (singleton) do backend vetorial configurado."""
    global _store
    if _store is None:
        backend = get_settings().vector_backend.lower()
        _store = PgVectorStore() if backend == "pgvector" else LocalVectorStore()
    return _store


def reset_vector_store() -> None:
    """Limpa o singleton (usado em testes)."""
    global _store
    _store = None
