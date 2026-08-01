"""Endpoints de IA: analise, classificacao, entidades, geracao (secao 8)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, audit, get_db_session, require
from app.domain.enums import MessageKind
from app.infrastructure.repositories import AnalysisRepository, TicketRepository
from app.schemas.api import (
    AnalyzeRequest,
    ClassifyRequest,
    ExtractEntitiesRequest,
    GenerateCommandsRequest,
    GenerateResponseRequest,
)
from app.services.analysis import analyze
from app.services.classification import classify_ticket
from app.services.commands import generate_commands
from app.services.communication import CommunicationRequest, generate_message
from app.services.entity_extraction import ExtractedEntities, extract_entities
from app.services.rag import generate_with_rag

router = APIRouter(tags=["ia"])


@router.post("/classify", response_model=dict)
def classify(
    payload: ClassifyRequest,
    db: Session = Depends(get_db_session),
    _: CurrentUser = Depends(require("analysis:run")),
) -> dict:
    """Classificacao hibrida com o contrato da secao 3.2."""
    return classify_ticket(db, payload.text, product=payload.product)


@router.post("/extract-entities", response_model=dict)
def extract(
    payload: ExtractEntitiesRequest,
    _: CurrentUser = Depends(require("analysis:run")),
) -> dict:
    """Extracao estruturada de entidades tecnicas."""
    return extract_entities(payload.text).model_dump()


@router.post("/analyze", response_model=dict)
def run_analysis(
    payload: AnalyzeRequest,
    db: Session = Depends(get_db_session),
    user: CurrentUser = Depends(require("analysis:run")),
) -> dict:
    """Analise tecnica completa (secao 3.4), persistida e auditada."""
    text = f"{payload.title}\n{payload.description}".strip()
    evidences = [e.model_dump() for e in payload.evidences]
    if payload.ticket_id is not None:
        ticket = TicketRepository(db).get(payload.ticket_id)
        text = f"{ticket.title}\n{ticket.description}\n{text}"
        evidences.extend(
            {"type": e.type, "content": e.content, "source": e.source}
            for e in ticket.evidences
        )

    classification = classify_ticket(db, text, product=payload.product)
    entities = ExtractedEntities(**classification["entidades"])
    result = analyze(payload.description, classification, entities, evidences)

    record = AnalysisRepository(db).create(
        {
            "ticket_id": payload.ticket_id,
            "summary": result["resumo_executivo"],
            "facts": result["fatos_confirmados"],
            "hypotheses": result["hipoteses"],
            "missing_information": result["informacoes_ausentes"],
            "risks": result["riscos"],
            "recommendations": result["acoes_recomendadas"],
            "classification": {
                k: v for k, v in classification.items() if k != "entidades"
            },
            "entities": classification["entidades"],
            "confidence": result["confianca_global"],
            "model_version": "hybrid-v1",
        }
    )
    audit(db, user, "analysis.run", resource=str(record.id))
    return {"analysis_id": record.id, "classificacao": classification, **result}


@router.post("/generate-commands", response_model=dict)
def commands(
    payload: GenerateCommandsRequest,
    _: CurrentUser = Depends(require("analysis:run")),
) -> dict:
    """Comandos de diagnostico seguros para a categoria."""
    return generate_commands(payload.category, payload.context)


async def _generate(payload: GenerateResponseRequest, db: Session, user: CurrentUser) -> dict:
    if payload.ticket_id is not None:
        ticket = TicketRepository(db).get(payload.ticket_id)
        payload.ticket_ref = payload.ticket_ref or (ticket.external_id or str(ticket.id))
        payload.customer = payload.customer or ticket.customer
        payload.subject = payload.subject or ticket.title
        payload.summary = payload.summary or ticket.description[:500]
    message = generate_message(
        CommunicationRequest(**payload.model_dump(exclude={"ticket_id", "enrich_with_rag"}))
    )
    if payload.enrich_with_rag and (payload.summary or payload.subject):
        rag = await generate_with_rag(
            db,
            query=f"{payload.subject} {payload.summary}",
            instruction=(
                f"Enriqueca tecnicamente (sem inventar fatos) o rascunho a seguir:\n{message['corpo']}"
            ),
        )
        message["contexto_rag"] = rag
    audit(db, user, "generate.message", detail={"kind": payload.kind.value})
    return message


@router.post("/generate-response", response_model=dict)
async def generate_response(
    payload: GenerateResponseRequest,
    db: Session = Depends(get_db_session),
    user: CurrentUser = Depends(require("analysis:run")),
) -> dict:
    """Comunicacao profissional por tipo/publico (secao 3.6)."""
    return await _generate(payload, db, user)


def _fixed_kind(kind: MessageKind):
    async def handler(
        payload: GenerateResponseRequest,
        db: Session = Depends(get_db_session),
        user: CurrentUser = Depends(require("analysis:run")),
    ) -> dict:
        payload.kind = kind
        return await _generate(payload, db, user)

    return handler


router.add_api_route(
    "/generate-gmud", _fixed_kind(MessageKind.GMUD), methods=["POST"],
    response_model=dict, summary="Gera documento de GMUD",
)
router.add_api_route(
    "/generate-action-plan", _fixed_kind(MessageKind.PLANO_DE_ACAO), methods=["POST"],
    response_model=dict, summary="Gera plano de acao",
)
router.add_api_route(
    "/generate-rca", _fixed_kind(MessageKind.RCA), methods=["POST"],
    response_model=dict, summary="Gera RCA (sem afirmar causa sem evidencia)",
)
router.add_api_route(
    "/generate-timeline", _fixed_kind(MessageKind.CRONOLOGIA), methods=["POST"],
    response_model=dict, summary="Gera cronologia",
)
