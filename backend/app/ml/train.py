"""Pipeline de treinamento da rede multi-head (secao 4.2 e 11).

Inclui: validacao do dataset, split estratificado, class weights, early
stopping, scheduler, gradient clipping, metricas por cabeca (accuracy,
precision, recall, F1 macro, F1 multilabel), matriz de confusao, checkpoint
e exportacao ONNX. MLflow e opcional (import guardado).
"""

from __future__ import annotations

import json
import math
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import torch
from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from torch import nn
from torch.utils.data import DataLoader, Dataset

from app.core.config import get_settings
from app.core.logging import get_logger
from app.infrastructure.embeddings import get_embedder
from app.ml.dataset import DatasetExample, label_vocabularies, load_dataset
from app.ml.network import MultiHeadTicketClassifier, OnnxWrapper

logger = get_logger(__name__)

HEADS = list(MultiHeadTicketClassifier.MULTICLASS_HEADS)
ML_HEAD = MultiHeadTicketClassifier.MULTILABEL_HEAD


def set_seed(seed: int = 42) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


class TicketDataset(Dataset):
    """Dataset PyTorch: embeddings + rotulos por cabeca."""

    def __init__(
        self, features: np.ndarray, labels: dict[str, np.ndarray]
    ) -> None:
        self.features = torch.from_numpy(features).float()
        self.labels = {
            name: torch.from_numpy(values) for name, values in labels.items()
        }

    def __len__(self) -> int:
        return len(self.features)

    def __getitem__(self, index: int):
        item = {name: values[index] for name, values in self.labels.items()}
        return self.features[index], item


def _encode_labels(
    examples: list[DatasetExample], vocab: dict[str, list[str]]
) -> dict[str, np.ndarray]:
    index = {head: {label: i for i, label in enumerate(vocab[head])} for head in vocab}
    labels: dict[str, np.ndarray] = {
        "categoria": np.array([index["categoria"][e.categoria.value] for e in examples]),
        "subcategoria": np.array(
            [index["subcategoria"].get(e.subcategoria, index["subcategoria"]["outro"]) for e in examples]
        ),
        "severidade": np.array([index["severidade"][e.severidade.value] for e in examples]),
        "equipe": np.array([index["equipe"][e.resolved_team().value] for e in examples]),
        "risco": np.array([index["risco"][e.risco.value] for e in examples]),
    }
    multilabel = np.zeros((len(examples), len(vocab[ML_HEAD])), dtype=np.float32)
    for row, example in enumerate(examples):
        for tech in example.tecnologias:
            multilabel[row, index[ML_HEAD][tech]] = 1.0
    labels[ML_HEAD] = multilabel
    return labels


def _class_weights(values: np.ndarray, num_classes: int) -> torch.Tensor:
    counts = np.bincount(values, minlength=num_classes).astype(np.float64)
    weights = np.where(counts > 0, 1.0 / np.maximum(counts, 1), 0.0)
    total = weights.sum() or 1.0
    return torch.tensor(weights / total * num_classes, dtype=torch.float32)


def train_model(
    dataset_path: str | Path | None = None,
    epochs: int = 30,
    batch_size: int = 32,
    learning_rate: float = 1e-3,
    patience: int = 5,
    seed: int = 42,
    artifacts_dir: str | Path | None = None,
) -> dict[str, Any]:
    """Treina a rede e retorna metricas + caminho dos artefatos."""
    settings = get_settings()
    set_seed(seed)
    dataset_path = Path(dataset_path or settings.ml_dataset_path)
    artifacts = Path(artifacts_dir or settings.ml_artifacts_dir)
    artifacts.mkdir(parents=True, exist_ok=True)

    examples = load_dataset(dataset_path)
    synthetic = sum(1 for e in examples if e.origem == "sintetico")
    logger.info(
        "Dataset: %d exemplos (%d sinteticos, %d reais)",
        len(examples), synthetic, len(examples) - synthetic,
    )
    vocab = label_vocabularies()

    embedder = get_embedder()
    features = embedder.embed([e.texto for e in examples])
    labels = _encode_labels(examples, vocab)

    idx_train, idx_temp = train_test_split(
        np.arange(len(examples)), test_size=0.3, random_state=seed,
        stratify=labels["categoria"],
    )
    idx_val, idx_test = train_test_split(
        idx_temp, test_size=0.5, random_state=seed,
        stratify=labels["categoria"][idx_temp],
    )

    def subset(indices: np.ndarray) -> TicketDataset:
        return TicketDataset(
            features[indices], {k: v[indices] for k, v in labels.items()}
        )

    train_loader = DataLoader(subset(idx_train), batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(subset(idx_val), batch_size=batch_size)
    test_loader = DataLoader(subset(idx_test), batch_size=batch_size)

    head_sizes = {head: len(vocab[head]) for head in HEADS + [ML_HEAD]}
    model = MultiHeadTicketClassifier(input_dim=features.shape[1], head_sizes=head_sizes)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    criteria = {
        head: nn.CrossEntropyLoss(
            weight=_class_weights(labels[head][idx_train], head_sizes[head]).to(device)
        )
        for head in HEADS
    }
    ml_criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=2)

    best_val = math.inf
    stale = 0
    history: list[dict[str, float]] = []
    checkpoint_path = artifacts / "multihead_best.pt"

    def run_epoch(loader: DataLoader, training: bool) -> float:
        model.train(training)
        total = 0.0
        with torch.set_grad_enabled(training):
            for batch_features, batch_labels in loader:
                batch_features = batch_features.to(device)
                logits = model(batch_features)
                loss = sum(
                    criteria[h](logits[h], batch_labels[h].long().to(device)) for h in HEADS
                ) + ml_criterion(logits[ML_HEAD], batch_labels[ML_HEAD].to(device))
                if not torch.isfinite(loss):
                    raise RuntimeError("Loss NaN/Inf durante o treinamento.")
                if training:
                    optimizer.zero_grad(set_to_none=True)
                    loss.backward()
                    nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                    optimizer.step()
                total += float(loss.item()) * len(batch_features)
        return total / len(loader.dataset)

    for epoch in range(epochs):
        train_loss = run_epoch(train_loader, training=True)
        val_loss = run_epoch(val_loader, training=False)
        scheduler.step(val_loss)
        history.append({"epoch": epoch + 1, "train_loss": round(train_loss, 4), "val_loss": round(val_loss, 4)})
        logger.info("Epoca %d/%d train=%.4f val=%.4f", epoch + 1, epochs, train_loss, val_loss)
        if val_loss < best_val - 1e-4:
            best_val = val_loss
            stale = 0
            torch.save(
                {
                    "state_dict": model.state_dict(),
                    "input_dim": features.shape[1],
                    "head_sizes": head_sizes,
                    "vocab": vocab,
                    "embedder": embedder.name,
                    "trained_at": datetime.now(timezone.utc).isoformat(),
                    "dataset": str(dataset_path),
                    "synthetic_examples": synthetic,
                    "total_examples": len(examples),
                },
                checkpoint_path,
            )
        else:
            stale += 1
            if stale >= patience:
                logger.info("Early stopping na epoca %d", epoch + 1)
                break

    # Avaliacao no teste com o melhor checkpoint
    state = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model.load_state_dict(state["state_dict"])
    metrics = evaluate_model(model, test_loader, vocab, device)
    metrics["history"] = history
    metrics["synthetic_ratio"] = round(synthetic / len(examples), 4)
    metrics["is_production_ready"] = synthetic / len(examples) < 0.5
    if not metrics["is_production_ready"]:
        metrics["aviso"] = (
            "Modelo treinado majoritariamente com dados SINTETICOS. NAO representa "
            "desempenho de producao; o baseline deterministico permanece recomendado."
        )
    (artifacts / "metrics.json").write_text(
        json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    export_onnx(model, features.shape[1], artifacts / "multihead.onnx")

    mlflow_log(metrics)
    return {"metrics": metrics, "checkpoint": str(checkpoint_path), "onnx": str(artifacts / "multihead.onnx")}


def evaluate_model(
    model: MultiHeadTicketClassifier,
    loader: DataLoader,
    vocab: dict[str, list[str]],
    device: torch.device,
) -> dict[str, Any]:
    """Metricas por cabeca no conjunto informado."""
    model.eval()
    preds: dict[str, list[int]] = {h: [] for h in HEADS}
    trues: dict[str, list[int]] = {h: [] for h in HEADS}
    ml_preds: list[np.ndarray] = []
    ml_trues: list[np.ndarray] = []
    with torch.no_grad():
        for batch_features, batch_labels in loader:
            output = model.predict(batch_features.to(device))
            for head in HEADS:
                preds[head].extend(output[head].argmax(dim=1).cpu().tolist())
                trues[head].extend(batch_labels[head].long().tolist())
            ml_preds.append((output[ML_HEAD].cpu().numpy() >= 0.5).astype(int))
            ml_trues.append(batch_labels[ML_HEAD].numpy().astype(int))

    metrics: dict[str, Any] = {}
    for head in HEADS:
        y_true, y_pred = np.array(trues[head]), np.array(preds[head])
        metrics[head] = {
            "accuracy": round(float((y_true == y_pred).mean()), 4),
            "precision_macro": round(float(precision_score(y_true, y_pred, average="macro", zero_division=0)), 4),
            "recall_macro": round(float(recall_score(y_true, y_pred, average="macro", zero_division=0)), 4),
            "f1_macro": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        }
    y_true_cat, y_pred_cat = np.array(trues["categoria"]), np.array(preds["categoria"])
    present = sorted(set(y_true_cat.tolist()) | set(y_pred_cat.tolist()))
    metrics["confusion_matrix_categoria"] = {
        "labels": [vocab["categoria"][i] for i in present],
        "matrix": confusion_matrix(y_true_cat, y_pred_cat, labels=present).tolist(),
    }
    ml_true = np.concatenate(ml_trues)
    ml_pred = np.concatenate(ml_preds)
    metrics["tecnologias_multilabel_f1_micro"] = round(
        float(f1_score(ml_true, ml_pred, average="micro", zero_division=0)), 4
    )
    return metrics


def export_onnx(model: MultiHeadTicketClassifier, input_dim: int, path: Path) -> None:
    """Exporta o modelo para ONNX (saidas na ordem das cabecas)."""
    wrapper = OnnxWrapper(model.cpu())
    dummy = torch.zeros(1, input_dim, dtype=torch.float32)
    torch.onnx.export(
        wrapper, (dummy,), str(path),
        input_names=["embedding"],
        output_names=wrapper.order,
        dynamic_axes={"embedding": {0: "batch"}},
        dynamo=False,
    )
    logger.info("ONNX exportado em %s", path)


def mlflow_log(metrics: dict[str, Any]) -> None:
    """Registra no MLflow se instalado e habilitado (opcional)."""
    try:
        import mlflow  # type: ignore
    except ImportError:
        return
    try:
        mlflow.set_experiment("ticket-multihead")
        with mlflow.start_run():
            for head in HEADS:
                for metric, value in metrics[head].items():
                    mlflow.log_metric(f"{head}_{metric}", value)
    except Exception as exc:  # pragma: no cover
        logger.warning("MLflow indisponivel: %s", exc)
