"""Avaliacao do modelo: metricas de classificacao e graficos."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")  # backend sem display, compativel com containers/CI
import matplotlib.pyplot as plt
import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from torch import nn
from torch.utils.data import DataLoader

from src.utils.logger import get_logger

logger = get_logger(__name__)


@torch.no_grad()
def collect_predictions(
    model: nn.Module, loader: DataLoader, device: torch.device
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Roda o modelo no loader e retorna (y_true, y_pred, probabilidades)."""
    model.eval()
    trues: list[np.ndarray] = []
    preds: list[np.ndarray] = []
    probas: list[np.ndarray] = []
    for features, targets in loader:
        logits = model(features.to(device))
        proba = torch.softmax(logits, dim=1).cpu().numpy()
        probas.append(proba)
        preds.append(proba.argmax(axis=1))
        trues.append(targets.numpy())
    return np.concatenate(trues), np.concatenate(preds), np.concatenate(probas)


def compute_metrics(
    y_true: np.ndarray, y_pred: np.ndarray, y_proba: np.ndarray
) -> dict[str, Any]:
    """Calcula accuracy, precision, recall, F1 (macro), ROC-AUC e matriz de confusao."""
    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_macro": float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
    }
    try:
        metrics["roc_auc_ovr"] = float(
            roc_auc_score(y_true, y_proba, multi_class="ovr", average="macro")
        )
    except ValueError as exc:
        logger.warning("ROC-AUC nao calculado: %s", exc)
        metrics["roc_auc_ovr"] = None
    return metrics


def save_metrics(metrics: dict[str, Any], path: str | Path) -> None:
    """Salva as metricas em JSON."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info("Metricas salvas em %s", path)


def plot_training_curves(history: dict[str, list[float]], out_path: str | Path) -> None:
    """Gera o grafico das curvas de loss de treino/validacao e acuracia."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    epochs = range(1, len(history["train_loss"]) + 1)
    axes[0].plot(epochs, history["train_loss"], label="treino")
    axes[0].plot(epochs, history["val_loss"], label="validacao")
    axes[0].set_xlabel("Epoca")
    axes[0].set_ylabel("Loss")
    axes[0].set_title("Curvas de loss")
    axes[0].legend()
    axes[1].plot(epochs, history["val_accuracy"], color="tab:green")
    axes[1].set_xlabel("Epoca")
    axes[1].set_ylabel("Acuracia")
    axes[1].set_title("Acuracia de validacao")
    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)
    logger.info("Curvas de treinamento salvas em %s", out_path)


def plot_confusion_matrix(
    matrix: list[list[int]], class_names: list[str], out_path: str | Path
) -> None:
    """Gera o grafico da matriz de confusao."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    data = np.asarray(matrix)
    fig, ax = plt.subplots(figsize=(7, 6))
    image = ax.imshow(data, cmap="Blues")
    fig.colorbar(image, ax=ax)
    ax.set_xticks(range(len(class_names)), labels=class_names, rotation=45, ha="right")
    ax.set_yticks(range(len(class_names)), labels=class_names)
    ax.set_xlabel("Previsto")
    ax.set_ylabel("Real")
    ax.set_title("Matriz de confusao")
    threshold = data.max() / 2 if data.size else 0
    for i in range(data.shape[0]):
        for j in range(data.shape[1]):
            color = "white" if data[i, j] > threshold else "black"
            ax.text(j, i, str(data[i, j]), ha="center", va="center", color=color)
    fig.tight_layout()
    fig.savefig(out_path, dpi=120)
    plt.close(fig)
    logger.info("Matriz de confusao salva em %s", out_path)
