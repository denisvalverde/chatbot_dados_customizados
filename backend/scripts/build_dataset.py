"""Gera o dataset SINTETICO de treinamento (claramente identificado).

Uso:
    python scripts/build_dataset.py --rows 1500
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings  # noqa: E402
from app.core.logging import configure_logging, get_logger  # noqa: E402
from app.ml.dataset import generate_synthetic_dataset, save_dataset  # noqa: E402

logger = get_logger("build_dataset")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=1500)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()

    configure_logging()
    output = args.output or Path(get_settings().ml_dataset_path)
    examples = generate_synthetic_dataset(rows=args.rows, seed=args.seed)
    save_dataset(examples, output)
    logger.info(
        "Dataset SINTETICO gerado: %d exemplos em %s (todos com origem='sintetico')",
        len(examples), output,
    )


if __name__ == "__main__":
    main()
