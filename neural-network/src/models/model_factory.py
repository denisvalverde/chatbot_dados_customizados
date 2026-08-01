"""Fabrica de modelos: construcao a partir da configuracao."""

from __future__ import annotations

from src.config import ModelConfig
from src.models.neural_network import MLPClassifier
from src.utils.logger import get_logger

logger = get_logger(__name__)


def build_model(config: ModelConfig, input_dim: int, num_classes: int) -> MLPClassifier:
    """Instancia o MLP com os hiperparametros da configuracao."""
    model = MLPClassifier(
        input_dim=input_dim,
        num_classes=num_classes,
        hidden_dims=list(config.hidden_dims),
        dropout=config.dropout,
        batch_norm=config.batch_norm,
    )
    logger.info(
        "Modelo criado: input_dim=%d, hidden=%s, classes=%d, parametros=%d",
        input_dim,
        config.hidden_dims,
        num_classes,
        count_parameters(model),
    )
    return model


def count_parameters(model: MLPClassifier) -> int:
    """Conta os parametros treinaveis do modelo."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)
