"""Testes do treinamento minimo, checkpoints e early stopping."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
import torch

from src.config import AppConfig
from src.data.loader import build_dataloader
from src.models.model_factory import build_model
from src.training.callbacks import EarlyStopping, ModelCheckpoint
from src.training.trainer import Trainer, detect_device


def _toy_loaders(config: AppConfig, input_dim: int = 40, samples: int = 200):
    rng = np.random.default_rng(0)
    x = rng.normal(size=(samples, input_dim)).astype(np.float32)
    y = (x[:, 0] > 0).astype(np.int64)  # problema separavel simples
    train = build_dataloader(x[:160], y[:160], config.training.batch_size, shuffle=True)
    val = build_dataloader(x[160:], y[160:], config.training.batch_size)
    return train, val


def test_minimal_training_reduces_loss(test_config: AppConfig, tmp_path: Path) -> None:
    train_loader, val_loader = _toy_loaders(test_config)
    model = build_model(test_config.model, input_dim=40, num_classes=2)
    trainer = Trainer(
        model, test_config, ModelCheckpoint(tmp_path), device=torch.device("cpu")
    )
    history = trainer.fit(train_loader, val_loader)
    assert len(history["train_loss"]) >= 1
    assert history["train_loss"][-1] < history["train_loss"][0]
    assert all(np.isfinite(history["val_loss"]))


def test_checkpoints_saved_and_resumable(test_config: AppConfig, tmp_path: Path) -> None:
    train_loader, val_loader = _toy_loaders(test_config)
    model = build_model(test_config.model, input_dim=40, num_classes=2)
    checkpoint = ModelCheckpoint(tmp_path)
    trainer = Trainer(model, test_config, checkpoint, device=torch.device("cpu"))
    trainer.fit(train_loader, val_loader)

    assert checkpoint.best_path.exists()
    assert checkpoint.last_path.exists()

    model2 = build_model(test_config.model, input_dim=40, num_classes=2)
    trainer2 = Trainer(model2, test_config, checkpoint, device=torch.device("cpu"))
    trainer2.resume()
    assert trainer2.start_epoch == len(trainer.history["train_loss"])


def test_model_state_roundtrip(test_config: AppConfig, tmp_path: Path) -> None:
    train_loader, val_loader = _toy_loaders(test_config)
    model = build_model(test_config.model, input_dim=40, num_classes=2)
    checkpoint = ModelCheckpoint(tmp_path)
    Trainer(model, test_config, checkpoint, device=torch.device("cpu")).fit(
        train_loader, val_loader
    )
    state = checkpoint.load(best=True)
    restored = build_model(test_config.model, input_dim=40, num_classes=2)
    restored.load_state_dict(state["model_state_dict"])
    x = torch.randn(4, 40)
    torch.testing.assert_close(restored.predict_proba(x), model.predict_proba(x))


def test_early_stopping_triggers() -> None:
    stopper = EarlyStopping(patience=2)
    assert stopper.step(1.0) is True
    assert stopper.step(1.0) is False
    assert stopper.step(1.0) is False
    assert stopper.should_stop is True


def test_detect_device_returns_valid_device() -> None:
    device = detect_device()
    assert device.type in {"cpu", "cuda"}


def test_missing_checkpoint_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        ModelCheckpoint(tmp_path).load(best=True)
