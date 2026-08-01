"""Repositorios: acesso a dados isolado da camada de aplicacao."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.infrastructure.models import (
    Analysis,
    AuditLog,
    Evidence,
    Feedback,
    KnowledgeDocument,
    ModelVersion,
    Ticket,
    User,
)


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def get(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def create(self, email: str, password_hash: str, role: str, full_name: str = "") -> User:
        user = User(email=email, password_hash=password_hash, role=role, full_name=full_name)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user


class TicketRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, data: dict[str, Any]) -> Ticket:
        ticket = Ticket(**data)
        self.db.add(ticket)
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def get(self, ticket_id: int) -> Ticket:
        ticket = self.db.get(Ticket, ticket_id)
        if ticket is None:
            raise NotFoundError(f"Ticket {ticket_id} nao encontrado.")
        return ticket

    def list(
        self,
        offset: int = 0,
        limit: int = 50,
        status: str | None = None,
        category: str | None = None,
    ) -> tuple[Sequence[Ticket], int]:
        query = select(Ticket)
        if status:
            query = query.where(Ticket.status == status)
        if category:
            query = query.where(Ticket.category == category)
        total = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        rows = self.db.scalars(
            query.order_by(Ticket.created_at.desc()).offset(offset).limit(limit)
        ).all()
        return rows, int(total)

    def update(self, ticket_id: int, data: dict[str, Any]) -> Ticket:
        ticket = self.get(ticket_id)
        for key, value in data.items():
            setattr(ticket, key, value)
        if data.get("status") in {"resolvido", "encerrado"} and ticket.resolved_at is None:
            ticket.resolved_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def add_evidence(
        self, ticket_id: int, type_: str, content: str, source: str = "", meta: dict | None = None
    ) -> Evidence:
        self.get(ticket_id)  # valida existencia
        evidence = Evidence(
            ticket_id=ticket_id,
            type=type_,
            content=content,
            source=source,
            hash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
            meta=meta or {},
        )
        self.db.add(evidence)
        self.db.commit()
        self.db.refresh(evidence)
        return evidence

    def stats(self) -> dict[str, Any]:
        total = self.db.scalar(select(func.count(Ticket.id))) or 0
        by_category = dict(
            self.db.execute(
                select(Ticket.category, func.count(Ticket.id)).group_by(Ticket.category)
            ).all()
        )
        by_severity = dict(
            self.db.execute(
                select(Ticket.severity, func.count(Ticket.id)).group_by(Ticket.severity)
            ).all()
        )
        by_status = dict(
            self.db.execute(
                select(Ticket.status, func.count(Ticket.id)).group_by(Ticket.status)
            ).all()
        )
        resolved = self.db.scalar(
            select(func.count(Ticket.id)).where(Ticket.status.in_(["resolvido", "encerrado"]))
        ) or 0
        return {
            "total": int(total),
            "por_categoria": by_category,
            "por_severidade": by_severity,
            "por_status": by_status,
            "taxa_resolucao": round(resolved / total, 4) if total else 0.0,
        }


class AnalysisRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, data: dict[str, Any]) -> Analysis:
        analysis = Analysis(**data)
        self.db.add(analysis)
        self.db.commit()
        self.db.refresh(analysis)
        return analysis

    def get(self, analysis_id: int) -> Analysis:
        analysis = self.db.get(Analysis, analysis_id)
        if analysis is None:
            raise NotFoundError(f"Analise {analysis_id} nao encontrada.")
        return analysis

    def average_confidence(self) -> float:
        value = self.db.scalar(select(func.avg(Analysis.confidence)))
        return round(float(value), 4) if value is not None else 0.0


class KnowledgeRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, data: dict[str, Any]) -> KnowledgeDocument:
        doc = KnowledgeDocument(**data)
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)
        return doc

    def get(self, doc_id: int) -> KnowledgeDocument:
        doc = self.db.get(KnowledgeDocument, doc_id)
        if doc is None:
            raise NotFoundError(f"Documento {doc_id} nao encontrado.")
        return doc

    def delete(self, doc_id: int) -> None:
        self.db.delete(self.get(doc_id))
        self.db.commit()

    def all_with_embeddings(self) -> Sequence[KnowledgeDocument]:
        return self.db.scalars(
            select(KnowledgeDocument).where(KnowledgeDocument.embedding != [])
        ).all()

    def list(self, offset: int = 0, limit: int = 50) -> tuple[Sequence[KnowledgeDocument], int]:
        total = self.db.scalar(select(func.count(KnowledgeDocument.id))) or 0
        rows = self.db.scalars(
            select(KnowledgeDocument)
            .order_by(KnowledgeDocument.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
        return rows, int(total)


class FeedbackRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, data: dict[str, Any]) -> Feedback:
        feedback = Feedback(**data)
        self.db.add(feedback)
        self.db.commit()
        self.db.refresh(feedback)
        return feedback

    def acceptance_rate(self) -> float:
        total = self.db.scalar(select(func.count(Feedback.id))) or 0
        if not total:
            return 0.0
        accepted = self.db.scalar(
            select(func.count(Feedback.id)).where(Feedback.accepted.is_(True))
        ) or 0
        return round(accepted / total, 4)


class ModelVersionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, data: dict[str, Any]) -> ModelVersion:
        model = ModelVersion(**data)
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return model

    def list(self) -> Sequence[ModelVersion]:
        return self.db.scalars(
            select(ModelVersion).order_by(ModelVersion.created_at.desc())
        ).all()

    def deploy(self, model_id: int) -> ModelVersion:
        model = self.db.get(ModelVersion, model_id)
        if model is None:
            raise NotFoundError(f"Modelo {model_id} nao encontrado.")
        for other in self.list():
            if other.status == "deployed":
                other.status = "archived"
        model.status = "deployed"
        model.deployed_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(model)
        return model

    def deployed(self) -> ModelVersion | None:
        return self.db.scalar(select(ModelVersion).where(ModelVersion.status == "deployed"))


class AuditRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def log(
        self,
        action: str,
        user_email: str = "",
        resource: str = "",
        detail: dict | None = None,
        request_id: str = "",
    ) -> None:
        self.db.add(
            AuditLog(
                action=action,
                user_email=user_email,
                resource=resource,
                detail=detail or {},
                request_id=request_id,
            )
        )
        self.db.commit()

    def list(self, limit: int = 100) -> Sequence[AuditLog]:
        return self.db.scalars(
            select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
        ).all()
