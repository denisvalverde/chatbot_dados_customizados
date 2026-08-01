"""Base de conhecimento: ingestao, busca semantica e gestao."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, audit, get_db_session, require
from app.infrastructure.repositories import KnowledgeRepository
from app.schemas.api import (
    KnowledgeDocumentIn,
    KnowledgeDocumentOut,
    KnowledgeIngestRequest,
)
from app.services.rag import ingest_document, search_knowledge

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.post("/documents", response_model=dict, status_code=201)
def create_document(
    payload: KnowledgeDocumentIn,
    db: Session = Depends(get_db_session),
    user: CurrentUser = Depends(require("knowledge:write")),
) -> dict:
    """Ingesta um unico documento (com redaction + embedding)."""
    result = ingest_document(
        db,
        title=payload.title,
        content=payload.content,
        document_type=payload.document_type.value,
        category=payload.category,
        technology=payload.technology,
        product=payload.product,
        source=payload.source,
        approved=payload.approved,
        success_score=payload.success_score,
        metadata=payload.metadata,
    )
    audit(db, user, "knowledge.create", resource=str(result["id"]))
    return result


@router.post("/ingest", response_model=dict)
def ingest_batch(
    payload: KnowledgeIngestRequest,
    db: Session = Depends(get_db_session),
    user: CurrentUser = Depends(require("knowledge:write")),
) -> dict:
    """Ingestao em lote."""
    ids = [
        ingest_document(
            db,
            title=doc.title,
            content=doc.content,
            document_type=doc.document_type.value,
            category=doc.category,
            technology=doc.technology,
            product=doc.product,
            source=doc.source,
            approved=doc.approved,
            success_score=doc.success_score,
            metadata=doc.metadata,
        )["id"]
        for doc in payload.documents
    ]
    audit(db, user, "knowledge.ingest", detail={"count": len(ids)})
    return {"ingested": len(ids), "ids": ids}


@router.get("/search", response_model=dict)
def search(
    q: str = Query(min_length=3, max_length=2000),
    limit: int = Query(5, ge=1, le=20),
    category: str | None = None,
    document_type: str | None = None,
    only_approved: bool = False,
    db: Session = Depends(get_db_session),
    _: CurrentUser = Depends(require("knowledge:read")),
) -> dict:
    """Busca semantica com reranking."""
    results = search_knowledge(
        db, q, limit=limit, category=category,
        document_type=document_type, only_approved=only_approved,
    )
    for item in results:
        item["content"] = item["content"][:800]
    return {"query": q, "results": results}


@router.get("/documents", response_model=dict)
def list_documents(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db_session),
    _: CurrentUser = Depends(require("knowledge:read")),
) -> dict:
    """Lista documentos da base."""
    rows, total = KnowledgeRepository(db).list(offset=offset, limit=limit)
    return {
        "items": [KnowledgeDocumentOut.model_validate(d).model_dump(mode="json") for d in rows],
        "total": total,
    }


@router.delete("/documents/{doc_id}", status_code=204)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db_session),
    user: CurrentUser = Depends(require("knowledge:write")),
) -> None:
    """Remove um documento."""
    KnowledgeRepository(db).delete(doc_id)
    audit(db, user, "knowledge.delete", resource=str(doc_id))
