"""Gestao de modelos: listagem, treino, avaliacao e deploy (secao 11)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, audit, get_db_session, require
from app.core.config import get_settings
from app.core.exceptions import ModelNotReadyError, NotFoundError
from app.infrastructure.repositories import ModelVersionRepository
from app.ml.infer import get_neural_predictor, reset_neural_predictor
from app.obsidian.sync import export_model_version
from app.schemas.api import ModelVersionOut, TrainRequest

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=list[ModelVersionOut])
def list_models(
    db: Session = Depends(get_db_session),
    _: CurrentUser = Depends(require("models:read")),
) -> list[ModelVersionOut]:
    """Lista versoes de modelo registradas."""
    return [ModelVersionOut.model_validate(m) for m in ModelVersionRepository(db).list()]


@router.post("/train", response_model=dict)
def train(
    payload: TrainRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_session),
    user: CurrentUser = Depends(require("models:manage")),
) -> dict:
    """Treina a rede multi-head de forma sincrona e registra a versao.

    Observacao: em producao com dataset grande, mover para worker assincrono
    (Celery/Dramatiq); com o dataset atual o treino leva segundos.
    """
    from app.ml.train import train_model

    settings = get_settings()
    dataset = payload.dataset_path or settings.ml_dataset_path
    if not Path(dataset).exists():
        raise NotFoundError(
            f"Dataset nao encontrado: {dataset}. Gere com scripts/build_dataset.py "
            "ou importe dados reais."
        )
    result = train_model(dataset_path=dataset, epochs=payload.epochs)
    metrics = result["metrics"]
    version = ModelVersionRepository(db).create(
        {
            "name": "multihead-ticket-classifier",
            "version": Path(result["checkpoint"]).stat().st_mtime_ns.__str__()[:12],
            "artifact_path": result["checkpoint"],
            "metrics": {
                "categoria": metrics["categoria"],
                "severidade": metrics["severidade"],
                "equipe": metrics["equipe"],
                "tecnologias_multilabel_f1_micro": metrics["tecnologias_multilabel_f1_micro"],
                "synthetic_ratio": metrics["synthetic_ratio"],
                "is_production_ready": metrics["is_production_ready"],
            },
            "status": "trained",
        }
    )
    reset_neural_predictor()
    audit(db, user, "models.train", resource=str(version.id))
    background_tasks.add_task(export_model_version, db, version.id)
    return {
        "model_version_id": version.id,
        "checkpoint": result["checkpoint"],
        "onnx": result["onnx"],
        "metrics": version.metrics,
        "aviso": metrics.get("aviso", ""),
    }


@router.post("/evaluate", response_model=dict)
def evaluate(
    db: Session = Depends(get_db_session),
    _: CurrentUser = Depends(require("models:read")),
) -> dict:
    """Retorna as metricas persistidas do ultimo treinamento."""
    import json

    metrics_path = Path(get_settings().ml_artifacts_dir) / "metrics.json"
    if not metrics_path.exists():
        raise ModelNotReadyError("Nenhum treinamento registrado ainda.")
    return json.loads(metrics_path.read_text(encoding="utf-8"))


@router.post("/deploy", response_model=dict)
def deploy(
    model_version_id: int,
    db: Session = Depends(get_db_session),
    user: CurrentUser = Depends(require("models:manage")),
) -> dict:
    """Marca uma versao como deployed (arquiva a anterior) e recarrega."""
    model = ModelVersionRepository(db).deploy(model_version_id)
    reset_neural_predictor()
    audit(db, user, "models.deploy", resource=str(model_version_id))
    return {"deployed": model.id, "status": model.status}


@router.get("/active", response_model=dict)
def active_model(
    _: CurrentUser = Depends(require("models:read")),
) -> dict:
    """Estado do preditor neural em memoria (ou baseline)."""
    predictor = get_neural_predictor()
    if predictor is None:
        return {
            "neural": False,
            "baseline": "regras_deterministicas",
            "detalhe": "Sem checkpoint treinado; classificacao usa regras + similaridade.",
        }
    return {
        "neural": True,
        "treinado_em": predictor.trained_at,
        "exemplos": predictor.total_examples,
        "exemplos_sinteticos": predictor.synthetic_examples,
        "apenas_sintetico": predictor.is_synthetic_only,
        "embedder": predictor.embedder_name,
    }


@router.post("/{model_version_id}/visualize", response_model=dict)
def visualize(
    model_version_id: int,
    db: Session = Depends(get_db_session),
    user: CurrentUser = Depends(require("obsidian:manage")),
) -> dict:
    """Regenera a nota + o .canvas da arquitetura da rede para esta versao no Obsidian."""
    ModelVersionRepository(db).get(model_version_id)  # valida existencia (404 se nao existir)
    ok = export_model_version(db, model_version_id)
    audit(db, user, "obsidian.visualize", resource=str(model_version_id))
    return {"gerado": ok}
