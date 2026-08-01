"""Esquemas Pydantic de entrada e saida da API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    """Entrada para classificacao de um unico chamado."""

    text: str = Field(..., min_length=5, max_length=1000, description="Texto do chamado")


class PredictBatchRequest(BaseModel):
    """Entrada para classificacao em lote."""

    texts: list[str] = Field(..., min_length=1, max_length=256)


class PredictionResponse(BaseModel):
    """Resultado de uma predicao individual."""

    prediction: str
    confidence: float
    probabilities: dict[str, float]
    model_version: str


class PredictBatchResponse(BaseModel):
    """Resultado da predicao em lote."""

    predictions: list[PredictionResponse]
    count: int


class HealthResponse(BaseModel):
    """Status de saude da API."""

    status: str
    model_loaded: bool


class ModelInfoResponse(BaseModel):
    """Metadados do modelo em producao."""

    model_version: str
    model_type: str
    input_dim: int
    num_classes: int
    classes: list[str]
    device: str
    transformations: list[str]
