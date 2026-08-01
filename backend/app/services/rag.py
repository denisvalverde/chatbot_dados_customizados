"""Pipeline RAG (secao 4.4): ingestao, busca, reranking, contexto e geracao.

Fluxo: normalizacao -> embedding -> busca vetorial -> filtro por metadados
-> reranking multi-criterio -> construcao de contexto -> geracao (LLM
configurado ou fallback local) -> validacao e avaliacao de confianca.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.infrastructure.embeddings import get_embedder
from app.infrastructure.llm import GenerationRequest, get_llm
from app.infrastructure.repositories import KnowledgeRepository
from app.infrastructure.vector_store import SearchHit, get_vector_store
from app.services.redaction import redact

logger = get_logger(__name__)


def normalize_text(text: str) -> str:
    """Normalizacao leve preservando conteudo tecnico."""
    return " ".join(text.split())


def ingest_document(
    db: Session,
    title: str,
    content: str,
    document_type: str,
    category: str = "",
    technology: list[str] | None = None,
    product: str = "",
    source: str = "",
    approved: bool = False,
    success_score: float = 0.5,
    metadata: dict | None = None,
) -> dict[str, Any]:
    """Ingesta um documento: redaction -> embedding -> persistencia."""
    safe = redact(f"{title}\n{content}", mask_ips=False)
    embedder = get_embedder()
    vector = embedder.embed([normalize_text(safe.text)])[0]
    repo = KnowledgeRepository(db)
    doc = repo.create(
        {
            "title": title[:500],
            "content": redact(content).text,
            "document_type": document_type,
            "category": category,
            "technology": technology or [],
            "product": product,
            "source": source,
            "approved": approved,
            "success_score": success_score,
            "embedding": [round(float(v), 6) for v in vector.tolist()],
            "meta": {
                **(metadata or {}),
                "redaction": safe.found,
                "embedder": embedder.name,
            },
        }
    )
    logger.info("Documento ingerido id=%d tipo=%s", doc.id, document_type)
    return {"id": doc.id, "redaction": safe.found, "embedder": embedder.name}


def rerank(
    hits: list[SearchHit],
    category: str | None = None,
    technologies: list[str] | None = None,
    product: str | None = None,
) -> list[dict[str, Any]]:
    """Reranking multi-criterio (secao 4.5).

    score = 0.55*similaridade + 0.15*categoria + 0.10*tecnologia
          + 0.10*sucesso_da_solucao + 0.05*recencia + 0.05*aprovado
    """
    now = datetime.now(UTC)
    ranked: list[dict[str, Any]] = []
    for hit in hits:
        doc = hit.document
        cat_score = 1.0 if (category and doc.category == category) else 0.0
        tech_score = 0.0
        if technologies and doc.technology:
            overlap = set(technologies) & set(doc.technology)
            tech_score = len(overlap) / max(len(technologies), 1)
        prod_bonus = 0.05 if (product and doc.product and product.lower() in doc.product.lower()) else 0.0
        created = doc.created_at
        if created is not None and created.tzinfo is None:
            created = created.replace(tzinfo=UTC)
        age_days = (now - created).days if created else 3650
        recency = max(0.0, 1.0 - age_days / 730.0)  # decai em ~2 anos
        score = (
            0.55 * hit.similarity
            + 0.15 * cat_score
            + 0.10 * tech_score
            + 0.10 * float(doc.success_score or 0.0)
            + 0.05 * recency
            + 0.05 * (1.0 if doc.approved else 0.0)
            + prod_bonus
        )
        ranked.append(
            {
                "id": doc.id,
                "title": doc.title,
                "document_type": doc.document_type,
                "category": doc.category,
                "similarity": round(hit.similarity, 4),
                "score": round(score, 4),
                "approved": doc.approved,
                "content": doc.content,
            }
        )
    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked


def search_knowledge(
    db: Session,
    query: str,
    limit: int = 5,
    category: str | None = None,
    document_type: str | None = None,
    technologies: list[str] | None = None,
    only_approved: bool = False,
) -> list[dict[str, Any]]:
    """Busca semantica com reranking. Retorna documentos ordenados."""
    embedder = get_embedder()
    vector = embedder.embed([normalize_text(query)])[0]
    hits = get_vector_store().search(
        db,
        vector,
        limit=max(limit * 3, 10),  # busca ampla; reranking corta
        category=category,
        document_type=document_type,
        only_approved=only_approved,
    )
    return rerank(hits, category=category, technologies=technologies)[:limit]


def _validate_generation(text: str, context_docs: list[dict]) -> dict[str, Any]:
    """Validacao anti-alucinacao da saida gerada (secao 4.6)."""
    warnings: list[str] = []
    forbidden_claims = [
        ("causa raiz confirmada", "afirmacao de causa raiz"),
        ("problema resolvido", "afirmacao de resolucao"),
        ("ambiente estavel", "afirmacao de estabilidade"),
    ]
    lower = text.lower()
    for term, label in forbidden_claims:
        if term in lower and not context_docs:
            warnings.append(f"Saida contem {label} sem documento de suporte — revisar.")
    return {"valida": not warnings, "avisos": warnings}


async def generate_with_rag(
    db: Session,
    query: str,
    instruction: str,
    category: str | None = None,
    technologies: list[str] | None = None,
    limit: int = 4,
) -> dict[str, Any]:
    """Pipeline completo: busca + contexto + geracao + validacao + confianca."""
    docs = search_knowledge(
        db, query, limit=limit, category=category, technologies=technologies
    )
    context = [f"{d['title']}\n{d['content'][:1500]}" for d in docs]
    llm = get_llm()
    response = await llm.generate(
        GenerationRequest(instruction=instruction, context_documents=context)
    )
    validation = _validate_generation(response.text, docs)

    # Confianca: media dos scores dos docs usados, penalizada sem contexto
    if docs:
        confidence = min(0.9, sum(d["score"] for d in docs) / len(docs))
    else:
        confidence = 0.2
    if not validation["valida"]:
        confidence = min(confidence, 0.4)

    return {
        "resposta": response.text,
        "provedor": response.provider,
        "modelo": response.model,
        "documentos_utilizados": [
            {k: d[k] for k in ("id", "title", "document_type", "similarity", "score")}
            for d in docs
        ],
        "validacao": validation,
        "confianca": round(confidence, 4),
    }
