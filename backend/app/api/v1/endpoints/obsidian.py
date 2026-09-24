"""Endpoints da integracao com Obsidian: sincronizacao e status (secao 2.4)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, audit, get_db_session, require
from app.obsidian import sync

router = APIRouter(prefix="/obsidian", tags=["obsidian"])


@router.post("/sync", response_model=dict)
def resync(
    db: Session = Depends(get_db_session),
    user: CurrentUser = Depends(require("obsidian:manage")),
) -> dict:
    """Resincroniza todo o conhecimento (tickets, analises, documentos, modelos) com o vault."""
    counts = sync.full_resync(db)
    audit(db, user, "obsidian.sync", detail=counts)
    return {"sincronizado": counts, **sync.get_status()}


@router.get("/status", response_model=dict)
def status(
    _: CurrentUser = Depends(require("obsidian:manage")),
) -> dict:
    """Estado atual da integracao: se esta habilitada e quantas notas existem."""
    return sync.get_status()
