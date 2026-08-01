"""Carregamento e validacao da configuracao do projeto via YAML + Pydantic."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Tuple

import yaml
from pydantic import BaseModel, Field, field_validator

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "configs" / "config.yaml"


class PathsConfig(BaseModel):
    """Caminhos de dados e artefatos (relativos a raiz do projeto)."""

    data_raw: Path = Path("data/raw")
    data_processed: Path = Path("data/processed")
    data_sample: Path = Path("data/sample")
    models_dir: Path = Path("artifacts/models")
    metrics_dir: Path = Path("artifacts/metrics")
    plots_dir: Path = Path("artifacts/plots")


class DataConfig(BaseModel):
    """Parametros de validacao e divisao dos dados."""

    text_column: str = "texto"
    label_column: str = "categoria"
    test_size: float = Field(0.15, gt=0.0, lt=0.5)
    val_size: float = Field(0.15, gt=0.0, lt=0.5)
    min_text_length: int = Field(5, ge=1)
    max_text_length: int = Field(1000, ge=10)
    drop_duplicates: bool = True


class FeaturesConfig(BaseModel):
    """Parametros da vetorizacao TF-IDF."""

    max_features: int = Field(5000, ge=100)
    ngram_range: Tuple[int, int] = (1, 2)
    min_df: int = Field(2, ge=1)
    sublinear_tf: bool = True

    @field_validator("ngram_range", mode="before")
    @classmethod
    def _coerce_ngram(cls, value: object) -> Tuple[int, int]:
        if isinstance(value, (list, tuple)) and len(value) == 2:
            return int(value[0]), int(value[1])
        raise ValueError("ngram_range deve ter exatamente 2 elementos")


class ModelConfig(BaseModel):
    """Hiperparametros da arquitetura da rede."""

    hidden_dims: list[int] = [256, 128]
    dropout: float = Field(0.3, ge=0.0, lt=1.0)
    batch_norm: bool = True


class TrainingConfig(BaseModel):
    """Hiperparametros do laco de treinamento."""

    batch_size: int = Field(64, ge=1)
    epochs: int = Field(30, ge=1)
    learning_rate: float = Field(1e-3, gt=0.0)
    weight_decay: float = Field(1e-4, ge=0.0)
    early_stopping_patience: int = Field(5, ge=1)
    gradient_clip_norm: float = Field(1.0, gt=0.0)
    scheduler_factor: float = Field(0.5, gt=0.0, lt=1.0)
    scheduler_patience: int = Field(2, ge=0)
    mixed_precision: bool = True
    num_workers: int = Field(0, ge=0)


class ApiConfig(BaseModel):
    """Parametros do servidor da API."""

    host: str = "0.0.0.0"
    port: int = Field(8000, ge=1, le=65535)


class MlflowConfig(BaseModel):
    """Rastreamento de experimentos (opcional)."""

    enabled: bool = False
    tracking_uri: str = "mlruns"
    experiment_name: str = "ticket-classifier"


class AppConfig(BaseModel):
    """Configuracao completa da aplicacao."""

    seed: int = 42
    paths: PathsConfig = PathsConfig()
    data: DataConfig = DataConfig()
    features: FeaturesConfig = FeaturesConfig()
    model: ModelConfig = ModelConfig()
    training: TrainingConfig = TrainingConfig()
    api: ApiConfig = ApiConfig()
    mlflow: MlflowConfig = MlflowConfig()
    model_version: str = "1.0.0"

    def resolve_path(self, relative: Path) -> Path:
        """Resolve um caminho relativo contra a raiz do projeto."""
        path = Path(relative)
        return path if path.is_absolute() else PROJECT_ROOT / path


def load_config(config_path: str | Path | None = None) -> AppConfig:
    """Carrega a configuracao a partir de um YAML.

    A variavel de ambiente ``APP_CONFIG_PATH`` tem precedencia sobre o
    caminho padrao quando ``config_path`` nao e informado.
    """
    if config_path is None:
        config_path = os.environ.get("APP_CONFIG_PATH", DEFAULT_CONFIG_PATH)
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo de configuracao nao encontrado: {path}")
    with path.open("r", encoding="utf-8") as handle:
        raw = yaml.safe_load(handle) or {}
    return AppConfig(**raw)
