"""Laco de treinamento com AMP opcional, early stopping e checkpoints."""

from __future__ import annotations

import math
from typing import Any

import torch
from torch import nn
from torch.utils.data import DataLoader
from tqdm import tqdm

from src.config import AppConfig
from src.training.callbacks import EarlyStopping, ModelCheckpoint
from src.utils.exceptions import TrainingError
from src.utils.logger import get_logger

logger = get_logger(__name__)


def detect_device() -> torch.device:
    """Seleciona automaticamente GPU CUDA quando disponivel, senao CPU."""
    if torch.cuda.is_available():
        logger.info("GPU CUDA detectada: %s", torch.cuda.get_device_name(0))
        return torch.device("cuda")
    logger.info("Nenhuma GPU CUDA detectada; usando CPU.")
    return torch.device("cpu")


class Trainer:
    """Treina o modelo com logging por epoca, scheduler e validacao de NaN."""

    def __init__(
        self,
        model: nn.Module,
        config: AppConfig,
        checkpoint: ModelCheckpoint,
        device: torch.device | None = None,
        checkpoint_extra: dict[str, Any] | None = None,
    ) -> None:
        self.config = config
        self.device = device or detect_device()
        self.model = model.to(self.device)
        self.checkpoint = checkpoint
        self.checkpoint_extra = checkpoint_extra or {}

        train_cfg = config.training
        self.criterion = nn.CrossEntropyLoss()
        self.optimizer = torch.optim.AdamW(
            self.model.parameters(),
            lr=train_cfg.learning_rate,
            weight_decay=train_cfg.weight_decay,
        )
        self.scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer,
            mode="min",
            factor=train_cfg.scheduler_factor,
            patience=train_cfg.scheduler_patience,
        )
        self.use_amp = bool(train_cfg.mixed_precision and self.device.type == "cuda")
        self.scaler = torch.amp.GradScaler("cuda", enabled=self.use_amp)
        self.early_stopping = EarlyStopping(patience=train_cfg.early_stopping_patience)
        self.history: dict[str, list[float]] = {
            "train_loss": [],
            "val_loss": [],
            "val_accuracy": [],
        }
        self.start_epoch = 0

    def resume(self) -> None:
        """Retoma o treinamento a partir do ultimo checkpoint salvo."""
        state = self.checkpoint.load(best=False, map_location=str(self.device))
        self.model.load_state_dict(state["model_state_dict"])
        self.optimizer.load_state_dict(state["optimizer_state_dict"])
        self.scheduler.load_state_dict(state["scheduler_state_dict"])
        self.history = state.get("history", self.history)
        self.start_epoch = int(state.get("epoch", 0))
        self.early_stopping.best_loss = float(state.get("best_val_loss", float("inf")))
        logger.info("Treinamento retomado a partir da epoca %d", self.start_epoch)

    def fit(self, train_loader: DataLoader, val_loader: DataLoader) -> dict[str, list[float]]:
        """Executa o treinamento completo e retorna o historico de metricas."""
        epochs = self.config.training.epochs
        try:
            for epoch in range(self.start_epoch, epochs):
                train_loss = self._train_epoch(train_loader, epoch, epochs)
                val_loss, val_acc = self._validate(val_loader)
                self.scheduler.step(val_loss)

                self.history["train_loss"].append(train_loss)
                self.history["val_loss"].append(val_loss)
                self.history["val_accuracy"].append(val_acc)
                logger.info(
                    "Epoca %d/%d | train_loss=%.4f | val_loss=%.4f | val_acc=%.4f | lr=%.2e",
                    epoch + 1,
                    epochs,
                    train_loss,
                    val_loss,
                    val_acc,
                    self.optimizer.param_groups[0]["lr"],
                )

                improved = self.early_stopping.step(val_loss)
                self._save_checkpoint(epoch + 1, improved)
                if self.early_stopping.should_stop:
                    break
        except TrainingError:
            raise
        except Exception as exc:  # pragma: no cover - protecao generica
            raise TrainingError(f"Falha inesperada durante o treinamento: {exc}") from exc
        return self.history

    def _train_epoch(self, loader: DataLoader, epoch: int, epochs: int) -> float:
        self.model.train()
        total_loss = 0.0
        progress = tqdm(loader, desc=f"Epoca {epoch + 1}/{epochs}", leave=False)
        for features, targets in progress:
            features = features.to(self.device)
            targets = targets.to(self.device)
            self.optimizer.zero_grad(set_to_none=True)

            with torch.amp.autocast("cuda", enabled=self.use_amp):
                logits = self.model(features)
                loss = self.criterion(logits, targets)

            self._check_finite(loss)
            self.scaler.scale(loss).backward()
            self.scaler.unscale_(self.optimizer)
            nn.utils.clip_grad_norm_(
                self.model.parameters(), self.config.training.gradient_clip_norm
            )
            self.scaler.step(self.optimizer)
            self.scaler.update()

            total_loss += loss.item() * features.size(0)
            progress.set_postfix(loss=f"{loss.item():.4f}")
        return total_loss / len(loader.dataset)

    @torch.no_grad()
    def _validate(self, loader: DataLoader) -> tuple[float, float]:
        self.model.eval()
        total_loss = 0.0
        correct = 0
        for features, targets in loader:
            features = features.to(self.device)
            targets = targets.to(self.device)
            logits = self.model(features)
            loss = self.criterion(logits, targets)
            self._check_finite(loss)
            total_loss += loss.item() * features.size(0)
            correct += int((logits.argmax(dim=1) == targets).sum().item())
        size = len(loader.dataset)
        return total_loss / size, correct / size

    def _save_checkpoint(self, epoch: int, is_best: bool) -> None:
        payload: dict[str, Any] = {
            "epoch": epoch,
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "scheduler_state_dict": self.scheduler.state_dict(),
            "history": self.history,
            "best_val_loss": self.early_stopping.best_loss,
            "model_version": self.config.model_version,
            **self.checkpoint_extra,
        }
        self.checkpoint.save(payload, is_best=is_best)

    @staticmethod
    def _check_finite(loss: torch.Tensor) -> None:
        value = float(loss.detach().item())
        if math.isnan(value) or math.isinf(value):
            raise TrainingError(
                f"Loss invalida ({value}) detectada; treinamento interrompido."
            )
