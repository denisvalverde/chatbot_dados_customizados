"""Feedback humano sobre analises (aprendizado continuo)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, audit, get_db_session, require
from app.infrastructure.repositories import AnalysisRepository, FeedbackRepository
from app.schemas.api import FeedbackIn

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=dict, status_code=201)
def create_feedback(
    payload: FeedbackIn,
    db: Session = Depends(get_db_session),
    user: CurrentUser = Depends(require("feedback:write")),
) -> dict:
    """Registra avaliacao humana de uma analise."""
    AnalysisRepository(db).get(payload.analysis_id)  # valida existencia
    feedback = FeedbackRepository(db).create(
        {
            "analysis_id": payload.analysis_id,
            "user_id": user.id,
            "rating": payload.rating,
            "accepted": payload.accepted,
            "correction": payload.correction,
            "comments": payload.comments,
        }
    )
    audit(db, user, "feedback.create", resource=str(feedback.id))
    return {"id": feedback.id, "taxa_aceitacao": FeedbackRepository(db).acceptance_rate()}
