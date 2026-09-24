"""Orquestra a exportacao das entidades da plataforma para o vault Obsidian.

Todas as funcoes publicas sao seguras para chamar mesmo com a integracao
desativada (retornam False/no-op) e nunca propagam excecao — ficam livres
para rodar em BackgroundTasks sem risco de quebrar a resposta HTTP.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.infrastructure.models import Analysis, KnowledgeDocument, ModelVersion, Ticket
from app.obsidian import templates
from app.obsidian.canvas import generate_network_canvas
from app.obsidian.mermaid import generate_network_mermaid, load_model_from_checkpoint
from app.obsidian.vault import count_notes, is_enabled, vault_root, write_json, write_note

logger = get_logger(__name__)

_ARCHITECTURE_NOTE = "06-Machine-Learning/Arquitetura-Rede-Neural.md"
_ARCHITECTURE_CANVAS = "06-Machine-Learning/Arquitetura-Rede-Neural.canvas"


def _ticket_to_dict(ticket: Ticket) -> dict[str, Any]:
    return {
        "id": ticket.id, "title": ticket.title, "description": ticket.description,
        "category": ticket.category, "subcategory": ticket.subcategory,
        "severity": ticket.severity, "urgency": ticket.urgency, "impact": ticket.impact,
        "assigned_team": ticket.assigned_team, "status": ticket.status,
        "updated_at": ticket.updated_at,
    }


def _analysis_to_dict(analysis: Analysis) -> dict[str, Any]:
    return {
        "id": analysis.id, "ticket_id": analysis.ticket_id, "summary": analysis.summary,
        "confidence": analysis.confidence, "facts": analysis.facts,
        "hypotheses": analysis.hypotheses, "missing_information": analysis.missing_information,
        "risks": analysis.risks, "classification": analysis.classification,
        "created_at": analysis.created_at, "model_version": analysis.model_version,
    }


def _document_to_dict(doc: KnowledgeDocument) -> dict[str, Any]:
    return {
        "id": doc.id, "title": doc.title, "content": doc.content,
        "document_type": doc.document_type, "category": doc.category,
        "technology": doc.technology, "approved": doc.approved,
        "success_score": doc.success_score, "source": doc.source,
    }


def _model_version_to_dict(version: ModelVersion) -> dict[str, Any]:
    return {
        "id": version.id, "name": version.name, "status": version.status,
        "created_at": version.created_at, "metrics": version.metrics,
        "artifact_path": version.artifact_path,
    }


def _rebuild_category_hub(db: Session, category: str) -> None:
    if not category:
        return
    tickets = db.scalars(select(Ticket).where(Ticket.category == category)).all()
    docs = db.scalars(select(KnowledgeDocument).where(KnowledgeDocument.category == category)).all()
    path, content = templates.render_hub_note(
        "categoria", category,
        [(t.id, t.title) for t in tickets],
        [(d.id, d.title) for d in docs],
    )
    write_note(path, content)


def _rebuild_technology_hub(db: Session, technology: str) -> None:
    if not technology:
        return
    ticket_ids: dict[int, str] = {}
    for analysis in db.scalars(select(Analysis)).all():
        techs = (analysis.classification or {}).get("tecnologia", [])
        if technology in techs and analysis.ticket_id:
            ticket = db.get(Ticket, analysis.ticket_id)
            if ticket:
                ticket_ids[ticket.id] = ticket.title
    docs = [
        d for d in db.scalars(select(KnowledgeDocument)).all()
        if technology in (d.technology or [])
    ]
    path, content = templates.render_hub_note(
        "tecnologia", technology,
        list(ticket_ids.items()),
        [(d.id, d.title) for d in docs],
    )
    write_note(path, content)


def export_ticket(db: Session, ticket_id: int) -> bool:
    """Exporta/atualiza a nota de um Ticket e sua nota-hub de categoria."""
    if not is_enabled():
        return False
    try:
        ticket = db.get(Ticket, ticket_id)
        if ticket is None:
            return False
        analysis_ids = [a.id for a in ticket.analyses]
        path, content = templates.render_ticket_note(_ticket_to_dict(ticket), analysis_ids)
        ok = write_note(path, content)
        _rebuild_category_hub(db, ticket.category)
        return ok
    except Exception:
        logger.exception("Falha ao exportar ticket %s para o Obsidian", ticket_id)
        return False


def export_analysis(db: Session, analysis_id: int) -> bool:
    """Exporta/atualiza a nota de uma Analysis e re-exporta o chamado relacionado."""
    if not is_enabled():
        return False
    try:
        analysis = db.get(Analysis, analysis_id)
        if analysis is None:
            return False
        path, content = templates.render_analysis_note(_analysis_to_dict(analysis))
        ok = write_note(path, content)
        if analysis.ticket_id:
            export_ticket(db, analysis.ticket_id)
        category = (analysis.classification or {}).get("categoria_principal", "")
        _rebuild_category_hub(db, category)
        for tech in (analysis.classification or {}).get("tecnologia", []):
            _rebuild_technology_hub(db, tech)
        return ok
    except Exception:
        logger.exception("Falha ao exportar analise %s para o Obsidian", analysis_id)
        return False


def export_knowledge_document(db: Session, document_id: int) -> bool:
    """Exporta/atualiza a nota de um KnowledgeDocument e suas notas-hub."""
    if not is_enabled():
        return False
    try:
        doc = db.get(KnowledgeDocument, document_id)
        if doc is None:
            return False
        path, content = templates.render_knowledge_note(_document_to_dict(doc))
        ok = write_note(path, content)
        _rebuild_category_hub(db, doc.category)
        for tech in doc.technology or []:
            _rebuild_technology_hub(db, tech)
        return ok
    except Exception:
        logger.exception("Falha ao exportar documento %s para o Obsidian", document_id)
        return False


def export_network_architecture(checkpoint_path: str, onnx_path: str = "") -> bool:
    """Gera a nota Mermaid + o .canvas da arquitetura, por introspecao real do checkpoint."""
    if not is_enabled():
        return False
    try:
        model, state = load_model_from_checkpoint(checkpoint_path)
        mermaid_block = generate_network_mermaid(model)
        trained_at = state.get("trained_at", "desconhecido")
        content = (
            "---\ntipo: \"arquitetura-rede-neural\"\ntags: [machine-learning]\n---\n\n"
            "# Arquitetura da Rede Neural\n\n"
            f"Gerada por introspecao do checkpoint treinado em {trained_at}.\n\n"
            f"{mermaid_block}\n\n"
            "Ver tambem o [[Arquitetura-Rede-Neural.canvas|Canvas]] navegavel desta mesma arquitetura "
            "e as [[Versoes-de-Modelo|versoes de modelo]] treinadas.\n"
        )
        ok_note = write_note(_ARCHITECTURE_NOTE, content)
        canvas = generate_network_canvas(model, onnx_path=onnx_path)
        ok_canvas = write_json(_ARCHITECTURE_CANVAS, canvas)
        return ok_note and ok_canvas
    except Exception:
        logger.exception("Falha ao gerar visualizacao da rede neural para o Obsidian")
        return False


def export_model_version(db: Session, model_version_id: int) -> bool:
    """Exporta a nota de uma ModelVersion e (re)gera a visualizacao da arquitetura."""
    if not is_enabled():
        return False
    try:
        version = db.get(ModelVersion, model_version_id)
        if version is None:
            return False
        path, content = templates.render_model_version_note(_model_version_to_dict(version))
        ok = write_note(path, content)
        onnx_path = str(Path(version.artifact_path).with_name("multihead.onnx")) if version.artifact_path else ""
        if version.artifact_path:
            export_network_architecture(version.artifact_path, onnx_path=onnx_path)
        return ok
    except Exception:
        logger.exception("Falha ao exportar versao de modelo %s para o Obsidian", model_version_id)
        return False


def full_resync(db: Session) -> dict[str, int]:
    """Resincroniza tudo: todos os tickets, analises, documentos e modelos."""
    counts = {"tickets": 0, "analises": 0, "documentos": 0, "modelos": 0}
    if not is_enabled():
        return counts
    for ticket in db.scalars(select(Ticket)).all():
        if export_ticket(db, ticket.id):
            counts["tickets"] += 1
    for analysis in db.scalars(select(Analysis)).all():
        if export_analysis(db, analysis.id):
            counts["analises"] += 1
    for doc in db.scalars(select(KnowledgeDocument)).all():
        if export_knowledge_document(db, doc.id):
            counts["documentos"] += 1
    for version in db.scalars(select(ModelVersion)).all():
        if export_model_version(db, version.id):
            counts["modelos"] += 1
    logger.info("Resync completo do Obsidian: %s", counts)
    return counts


def get_status() -> dict[str, Any]:
    """Estado atual da integracao (para GET /obsidian/status)."""
    root = vault_root()
    return {
        "habilitado": is_enabled(),
        "caminho_vault": str(root) if root else "",
        "vault_existe": bool(root and root.exists()),
        "notas_por_pasta": count_notes(),
    }
