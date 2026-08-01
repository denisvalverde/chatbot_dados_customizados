"""Schemas de entrada/saida da API v1."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.domain.enums import (
    Audience,
    DocumentType,
    EvidenceType,
    MessageKind,
    Severity,
    TicketStatus,
    Urgency,
)


# ---------------------------------------------------------------- auth
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str


# ---------------------------------------------------------------- tickets
class EvidenceIn(BaseModel):
    type: EvidenceType
    content: str = Field(min_length=1, max_length=200_000)
    source: str = ""


class TicketCreate(BaseModel):
    external_id: str = ""
    title: str = Field(min_length=5, max_length=500)
    description: str = Field(default="", max_length=200_000)
    customer: str = ""
    contact: str = ""
    hostname: str = ""
    product: str = ""
    severity: Severity = Severity.MEDIA
    urgency: Urgency = Urgency.MEDIA
    evidences: list[EvidenceIn] = Field(default_factory=list, max_length=50)


class TicketPatch(BaseModel):
    status: TicketStatus | None = None
    severity: Severity | None = None
    category: str | None = None
    subcategory: str | None = None
    assigned_team: str | None = None
    description: str | None = None


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_id: str
    title: str
    description: str
    customer: str
    contact: str
    hostname: str
    product: str
    status: str
    severity: str
    urgency: str
    impact: str
    category: str
    subcategory: str
    assigned_team: str
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None


class TicketListOut(BaseModel):
    items: list[TicketOut]
    total: int
    offset: int
    limit: int


# ---------------------------------------------------------------- analise
class AnalyzeRequest(BaseModel):
    ticket_id: int | None = None
    title: str = ""
    description: str = Field(min_length=10, max_length=200_000)
    product: str = ""
    evidences: list[EvidenceIn] = Field(default_factory=list, max_length=50)


class ClassifyRequest(BaseModel):
    text: str = Field(min_length=10, max_length=200_000)
    product: str = ""


class ExtractEntitiesRequest(BaseModel):
    text: str = Field(min_length=3, max_length=200_000)


class GenerateResponseRequest(BaseModel):
    kind: MessageKind
    audience: Audience = Audience.CLIENTE_TECNICO
    ticket_id: int | None = None
    ticket_ref: str = ""
    customer: str = ""
    subject: str = ""
    summary: str = ""
    facts: list[str] = Field(default_factory=list)
    hypotheses: list[str] = Field(default_factory=list)
    actions_taken: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    missing_info: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    timeline: list[dict] = Field(default_factory=list)
    team: str = ""
    enrich_with_rag: bool = False


class GenerateCommandsRequest(BaseModel):
    category: str = Field(min_length=2, max_length=64)
    context: str = ""


# ---------------------------------------------------------------- knowledge
class KnowledgeDocumentIn(BaseModel):
    title: str = Field(min_length=3, max_length=500)
    content: str = Field(min_length=10, max_length=500_000)
    document_type: DocumentType
    category: str = ""
    technology: list[str] = Field(default_factory=list)
    product: str = ""
    source: str = ""
    approved: bool = False
    success_score: float = Field(default=0.5, ge=0.0, le=1.0)
    metadata: dict[str, Any] = Field(default_factory=dict)


class KnowledgeIngestRequest(BaseModel):
    documents: list[KnowledgeDocumentIn] = Field(min_length=1, max_length=100)


class KnowledgeDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    document_type: str
    category: str
    technology: list
    product: str
    source: str
    approved: bool
    success_score: float
    created_at: datetime


# ---------------------------------------------------------------- feedback
class FeedbackIn(BaseModel):
    analysis_id: int
    rating: int = Field(ge=1, le=5)
    accepted: bool = False
    correction: str = ""
    comments: str = ""


# ---------------------------------------------------------------- modelos
class TrainRequest(BaseModel):
    epochs: int = Field(default=20, ge=1, le=200)
    dataset_path: str = ""


class ModelVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    version: str
    artifact_path: str
    metrics: dict
    status: str
    created_at: datetime
    deployed_at: datetime | None
