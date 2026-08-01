"""CRUD de tickets e evidencias."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, audit, get_db_session, require
from app.infrastructure.repositories import TicketRepository
from app.schemas.api import TicketCreate, TicketListOut, TicketOut, TicketPatch
from app.services.classification import classify_ticket
from app.services.redaction import redact

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.post("", response_model=TicketOut, status_code=201)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db_session),
    user: CurrentUser = Depends(require("tickets:write")),
) -> TicketOut:
    """Cadastra um chamado, classifica automaticamente e anexa evidencias."""
    repo = TicketRepository(db)
    classification = classify_ticket(
        db, f"{payload.title}\n{payload.description}", product=payload.product
    )
    ticket = repo.create(
        {
            "external_id": payload.external_id,
            "title": redact(payload.title).text,
            "description": redact(payload.description).text,
            "customer": payload.customer,
            "contact": payload.contact,
            "hostname": payload.hostname,
            "product": payload.product,
            "severity": classification["severidade"],
            "urgency": classification["urgencia"],
            "impact": classification["impacto"],
            "category": classification["categoria_principal"],
            "subcategory": classification["subcategoria"],
            "assigned_team": classification["equipe_recomendada"],
        }
    )
    for evidence in payload.evidences:
        repo.add_evidence(
            ticket.id, evidence.type.value, redact(evidence.content).text, evidence.source
        )
    audit(db, user, "ticket.create", resource=str(ticket.id))
    return TicketOut.model_validate(ticket)


@router.get("", response_model=TicketListOut)
def list_tickets(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db_session),
    _: CurrentUser = Depends(require("tickets:read")),
) -> TicketListOut:
    """Lista chamados com paginacao e filtros."""
    rows, total = TicketRepository(db).list(
        offset=offset, limit=limit, status=status, category=category
    )
    return TicketListOut(
        items=[TicketOut.model_validate(t) for t in rows],
        total=total, offset=offset, limit=limit,
    )


@router.get("/stats", response_model=dict)
def ticket_stats(
    db: Session = Depends(get_db_session),
    _: CurrentUser = Depends(require("tickets:read")),
) -> dict:
    """Estatisticas agregadas para o dashboard."""
    from app.infrastructure.repositories import AnalysisRepository, FeedbackRepository

    stats = TicketRepository(db).stats()
    stats["confianca_media_analises"] = AnalysisRepository(db).average_confidence()
    stats["taxa_aceitacao_feedback"] = FeedbackRepository(db).acceptance_rate()
    return stats


@router.get("/{ticket_id}", response_model=dict)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db_session),
    _: CurrentUser = Depends(require("tickets:read")),
) -> dict:
    """Detalhe do chamado com evidencias e analises."""
    ticket = TicketRepository(db).get(ticket_id)
    return {
        "ticket": TicketOut.model_validate(ticket).model_dump(mode="json"),
        "evidences": [
            {
                "id": e.id, "type": e.type, "source": e.source,
                "content": e.content[:5000], "collected_at": e.collected_at.isoformat(),
            }
            for e in ticket.evidences
        ],
        "analyses": [
            {
                "id": a.id, "summary": a.summary, "confidence": a.confidence,
                "created_at": a.created_at.isoformat(),
            }
            for a in ticket.analyses
        ],
    }


@router.patch("/{ticket_id}", response_model=TicketOut)
def patch_ticket(
    ticket_id: int,
    payload: TicketPatch,
    db: Session = Depends(get_db_session),
    user: CurrentUser = Depends(require("tickets:write")),
) -> TicketOut:
    """Atualiza campos do chamado."""
    data = {
        key: (value.value if hasattr(value, "value") else value)
        for key, value in payload.model_dump(exclude_none=True).items()
    }
    ticket = TicketRepository(db).update(ticket_id, data)
    audit(db, user, "ticket.update", resource=str(ticket_id), detail=data)
    return TicketOut.model_validate(ticket)
