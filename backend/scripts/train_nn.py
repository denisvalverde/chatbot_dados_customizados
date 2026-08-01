"""Treina a rede multi-head pela linha de comando.

Uso:
    python scripts/train_nn.py --epochs 20
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.logging import configure_logging  # noqa: E402
from app.ml.train import train_model  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--dataset", type=Path, default=None)
    args = parser.parse_args()

    configure_logging()
    result = train_model(dataset_path=args.dataset, epochs=args.epochs)
    metrics = result["metrics"]
    resumo = {
        "categoria": metrics["categoria"],
        "severidade": metrics["severidade"],
        "equipe": metrics["equipe"],
        "tecnologias_multilabel_f1_micro": metrics["tecnologias_multilabel_f1_micro"],
        "synthetic_ratio": metrics["synthetic_ratio"],
        "is_production_ready": metrics["is_production_ready"],
        "checkpoint": result["checkpoint"],
        "onnx": result["onnx"],
    }
    if "aviso" in metrics:
        resumo["aviso"] = metrics["aviso"]
    print(json.dumps(resumo, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
