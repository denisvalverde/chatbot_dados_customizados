"""Importador de dados reais para o dataset de treinamento.

Aceita CSV (colunas: texto, categoria[, subcategoria, severidade, equipe,
risco, tecnologias]) ou JSONL no esquema oficial. Valida tudo com Pydantic
e grava com origem='real'.

Uso:
    python scripts/import_dataset.py entrada.csv --output datasets/tickets_real.jsonl
    python scripts/import_dataset.py entrada.jsonl --append datasets/tickets_synthetic.jsonl
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.logging import configure_logging, get_logger  # noqa: E402
from app.ml.dataset import DatasetExample, load_dataset, save_dataset  # noqa: E402

logger = get_logger("import_dataset")


def read_csv(path: Path) -> list[DatasetExample]:
    examples: list[DatasetExample] = []
    with path.open("r", encoding="utf-8") as handle:
        for row_number, row in enumerate(csv.DictReader(handle), 1):
            techs = [t.strip() for t in (row.get("tecnologias") or "").split(";") if t.strip()]
            try:
                examples.append(
                    DatasetExample(
                        texto=row["texto"],
                        categoria=row["categoria"],
                        subcategoria=row.get("subcategoria") or "outro",
                        severidade=row.get("severidade") or "media",
                        equipe=row.get("equipe") or None,
                        risco=row.get("risco") or "medio",
                        tecnologias=techs,
                        origem="real",
                    )
                )
            except Exception as exc:
                raise ValueError(f"Linha {row_number} invalida: {exc}") from exc
    return examples


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, default=Path("datasets/tickets_real.jsonl"))
    parser.add_argument(
        "--append", type=Path, default=None,
        help="Tambem anexa os exemplos a um dataset existente (ex.: o sintetico)",
    )
    args = parser.parse_args()

    configure_logging()
    if args.input.suffix.lower() == ".csv":
        examples = read_csv(args.input)
    else:
        examples = load_dataset(args.input)
        for example in examples:
            example.origem = "real"

    save_dataset(examples, args.output)
    logger.info("%d exemplos REAIS validados e salvos em %s", len(examples), args.output)

    if args.append:
        existing = load_dataset(args.append)
        save_dataset(existing + examples, args.append)
        logger.info("Dataset combinado atualizado: %s (%d exemplos)", args.append, len(existing) + len(examples))


if __name__ == "__main__":
    main()
