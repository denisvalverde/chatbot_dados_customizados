"""Avalia o melhor modelo salvo contra o conjunto de teste persistido.

Uso:
    python scripts/evaluate.py
    python scripts/evaluate.py --data data/processed/test.csv
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np  # noqa: E402

from src.config import load_config  # noqa: E402
from src.data.loader import load_dataset  # noqa: E402
from src.inference.predictor import Predictor  # noqa: E402
from src.training.evaluator import compute_metrics, plot_confusion_matrix, save_metrics  # noqa: E402
from src.utils.logger import get_logger  # noqa: E402

logger = get_logger("evaluate")


def main() -> None:
    """Executa a avaliacao standalone usando o pipeline de inferencia."""
    parser = argparse.ArgumentParser(description="Avalia o modelo treinado.")
    parser.add_argument("--config", type=Path, default=None, help="Caminho do config.yaml")
    parser.add_argument("--data", type=Path, default=None, help="CSV de teste (texto+rotulo)")
    args = parser.parse_args()

    config = load_config(args.config)
    data_path = args.data or config.resolve_path(config.paths.data_processed) / "test.csv"

    df = load_dataset(data_path)
    text_col, label_col = config.data.text_column, config.data.label_column

    predictor = Predictor.from_artifacts(config.resolve_path(config.paths.models_dir))
    classes = predictor.preprocessor.classes
    class_to_index = {name: i for i, name in enumerate(classes)}

    known = df[df[label_col].isin(class_to_index)].reset_index(drop=True)
    dropped = len(df) - len(known)
    if dropped:
        logger.warning("%d registros com classes desconhecidas foram ignorados", dropped)

    predictions = predictor.predict_batch(known[text_col].astype(str).tolist())
    y_true = np.array([class_to_index[label] for label in known[label_col]])
    y_pred = np.array([class_to_index[p.label] for p in predictions])
    y_proba = np.array([[p.probabilities[c] for c in classes] for p in predictions])

    metrics = compute_metrics(y_true, y_pred, y_proba)
    metrics_dir = config.resolve_path(config.paths.metrics_dir)
    plots_dir = config.resolve_path(config.paths.plots_dir)
    save_metrics(metrics, metrics_dir / "evaluation_metrics.json")
    plot_confusion_matrix(
        metrics["confusion_matrix"], classes, plots_dir / "evaluation_confusion_matrix.png"
    )

    printable = {k: v for k, v in metrics.items() if k != "confusion_matrix"}
    print(json.dumps(printable, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
