"""API FastAPI de inferencia do classificador de chamados.

O modelo e carregado uma unica vez no startup (lifespan) e reutilizado em
todas as requisicoes. O diretorio de artefatos pode ser configurado pela
variavel de ambiente ``MODELS_DIR``.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, status

from src import __version__
from src.api.dependencies import get_predictor
from src.api.schemas import (
    HealthResponse,
    ModelInfoResponse,
    PredictBatchRequest,
    PredictBatchResponse,
    PredictionResponse,
    PredictRequest,
)
from src.config import load_config
from src.inference.predictor import Prediction, Predictor
from src.utils.exceptions import ModelNotFoundError
from src.utils.logger import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Carrega o modelo uma unica vez na inicializacao da API."""
    config = load_config()
    models_dir = os.environ.get("MODELS_DIR") or str(
        config.resolve_path(config.paths.models_dir)
    )
    try:
        app.state.predictor = Predictor.from_artifacts(models_dir)
        logger.info("Modelo carregado com sucesso de %s", models_dir)
    except ModelNotFoundError as exc:
        app.state.predictor = None
        logger.error("API iniciada SEM modelo: %s", exc)
    yield
    app.state.predictor = None


app = FastAPI(
    title="Classificador de Chamados de Suporte",
    description="API de inferencia da rede neural (TF-IDF + MLP em PyTorch).",
    version=__version__,
    lifespan=lifespan,
)


def _to_response(prediction: Prediction, model_version: str) -> PredictionResponse:
    return PredictionResponse(
        prediction=prediction.label,
        confidence=round(prediction.confidence, 6),
        probabilities={k: round(v, 6) for k, v in prediction.probabilities.items()},
        model_version=model_version,
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Verifica se a API esta no ar e se o modelo foi carregado."""
    loaded = getattr(app.state, "predictor", None) is not None
    return HealthResponse(status="ok", model_loaded=loaded)


@app.get("/model-info", response_model=ModelInfoResponse)
def model_info(predictor: Predictor = Depends(get_predictor)) -> ModelInfoResponse:
    """Retorna metadados do modelo em producao."""
    return ModelInfoResponse(**predictor.info())  # type: ignore[arg-type]


@app.post("/predict", response_model=PredictionResponse)
def predict(
    payload: PredictRequest, predictor: Predictor = Depends(get_predictor)
) -> PredictionResponse:
    """Classifica um unico chamado de suporte."""
    try:
        prediction = predictor.predict(payload.text)
    except Exception as exc:
        logger.exception("Falha na predicao individual")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao executar a predicao: {exc}",
        ) from exc
    logger.info(
        "predict: label=%s confidence=%.4f", prediction.label, prediction.confidence
    )
    return _to_response(prediction, predictor.model_version)


@app.post("/predict-batch", response_model=PredictBatchResponse)
def predict_batch(
    payload: PredictBatchRequest, predictor: Predictor = Depends(get_predictor)
) -> PredictBatchResponse:
    """Classifica um lote de chamados de suporte."""
    invalid = [i for i, text in enumerate(payload.texts) if len(text.strip()) < 5]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Textos muito curtos (minimo 5 caracteres) nos indices: {invalid}",
        )
    try:
        predictions = predictor.predict_batch(payload.texts)
    except Exception as exc:
        logger.exception("Falha na predicao em lote")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao executar a predicao em lote: {exc}",
        ) from exc
    logger.info("predict-batch: %d textos classificados", len(predictions))
    return PredictBatchResponse(
        predictions=[_to_response(p, predictor.model_version) for p in predictions],
        count=len(predictions),
    )
