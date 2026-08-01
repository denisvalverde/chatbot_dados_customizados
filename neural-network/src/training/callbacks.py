"""Callbacks de treinamento: early stopping e checkpoints."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import torch

from src.utils.logger import get_logger

logger = get_logger(__name__)


class EarlyStopping:
    """Interrompe o treinamento quando a loss de validacao para de melhorar."""

    def __init__(self, patience: int = 5, min_delta: float = 1e-4) -> None:
        self.patience = patience
        self.min_delta = min_delta
        self.best_loss = float("inf")
        self.counter = 0
        self.should_stop = False

    def step(self, val_loss: float) -> bool:
        """Atualiza o estado e retorna True se houve melhora."""
        if val_loss < self.best_loss - self.min_delta:
            self.best_loss = val_loss
            self.counter = 0
            return True
        self.counter += 1
        if self.counter >= self.patience:
            self.should_stop = True
            logger.info(
                "Early stopping: sem melhora ha %d epocas (melhor loss=%.4f)",
                self.counter,
                self.best_loss,
            )
        return False


class ModelCheckpoint:
    """Salva checkpoints do melhor e do ultimo modelo, com metadados."""

    def __init__(self, models_dir: str | Path) -> None:
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.best_path = self.models_dir / "best_model.pt"
        self.last_path = self.models_dir / "last_model.pt"

    def save(
        self,
        payload: dict[str, Any],
        is_best: bool,
    ) -> None:
        """Persiste o checkpoint como 'last' e, se aplicavel, como 'best'."""
        torch.save(payload, self.last_path)
        if is_best:
            torch.save(payload, self.best_path)
            logger.info("Novo melhor modelo salvo em %s", self.best_path)

    def load(self, best: bool = True, map_location: str = "cpu") -> dict[str, Any]:
        """Carrega um checkpoint salvo ('best' ou 'last')."""
        path = self.best_path if best else self.last_path
        if not path.exists():
            raise FileNotFoundError(f"Checkpoint nao encontrado: {path}")
        return torch.load(path, map_location=map_location, weights_only=False)
