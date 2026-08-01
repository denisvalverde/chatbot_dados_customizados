"""Validacao de esquema e qualidade dos dados de entrada."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from src.config import DataConfig
from src.utils.exceptions import DataValidationError
from src.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class ValidationReport:
    """Resumo das verificacoes e transformacoes aplicadas na validacao."""

    rows_in: int = 0
    rows_out: int = 0
    missing_removed: int = 0
    duplicates_removed: int = 0
    outliers_removed: int = 0
    class_distribution: dict[str, int] = field(default_factory=dict)
    steps: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        """Serializa o relatorio para registro em disco/logs."""
        return {
            "rows_in": self.rows_in,
            "rows_out": self.rows_out,
            "missing_removed": self.missing_removed,
            "duplicates_removed": self.duplicates_removed,
            "outliers_removed": self.outliers_removed,
            "class_distribution": self.class_distribution,
            "steps": self.steps,
        }


def validate_schema(df: pd.DataFrame, config: DataConfig) -> None:
    """Garante que as colunas obrigatorias existem e tem tipo textual."""
    required = {config.text_column, config.label_column}
    missing = required - set(df.columns)
    if missing:
        raise DataValidationError(
            f"Colunas obrigatorias ausentes: {sorted(missing)}. "
            f"Colunas presentes: {list(df.columns)}"
        )
    if df.empty:
        raise DataValidationError("O dataset esta vazio.")


def clean_dataframe(
    df: pd.DataFrame, config: DataConfig
) -> tuple[pd.DataFrame, ValidationReport]:
    """Valida o esquema e aplica limpeza basica com relatorio das etapas.

    Etapas: remocao de valores ausentes, duplicidades, textos fora dos
    limites de tamanho (outliers) e classes com menos de 3 exemplos.
    """
    validate_schema(df, config)
    report = ValidationReport(rows_in=len(df))
    text_col, label_col = config.text_column, config.label_column

    frame = df[[text_col, label_col]].copy()
    frame[text_col] = frame[text_col].astype("string")
    frame[label_col] = frame[label_col].astype("string")

    before = len(frame)
    frame = frame.dropna(subset=[text_col, label_col])
    frame = frame[frame[text_col].str.strip() != ""]
    report.missing_removed = before - len(frame)
    report.steps.append(f"removidos {report.missing_removed} registros ausentes/vazios")

    if config.drop_duplicates:
        before = len(frame)
        frame = frame.drop_duplicates(subset=[text_col, label_col])
        report.duplicates_removed = before - len(frame)
        report.steps.append(f"removidas {report.duplicates_removed} duplicidades")

    lengths = frame[text_col].str.len()
    mask = (lengths >= config.min_text_length) & (lengths <= config.max_text_length)
    report.outliers_removed = int((~mask).sum())
    frame = frame[mask]
    report.steps.append(
        f"removidos {report.outliers_removed} outliers de tamanho "
        f"(fora de [{config.min_text_length}, {config.max_text_length}] caracteres)"
    )

    counts = frame[label_col].value_counts()
    rare = counts[counts < 3].index.tolist()
    if rare:
        frame = frame[~frame[label_col].isin(rare)]
        report.steps.append(f"removidas classes raras (<3 exemplos): {rare}")

    if frame.empty:
        raise DataValidationError("Nenhum registro valido apos a limpeza.")
    if frame[label_col].nunique() < 2:
        raise DataValidationError(
            "Sao necessarias ao menos 2 classes distintas apos a limpeza."
        )

    report.rows_out = len(frame)
    report.class_distribution = frame[label_col].value_counts().to_dict()
    logger.info("Validacao concluida: %d -> %d registros", report.rows_in, report.rows_out)
    return frame.reset_index(drop=True), report
