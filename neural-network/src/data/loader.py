"""Carregamento de dados e divisao treino/validacao/teste sem data leakage."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, TensorDataset

from src.config import DataConfig
from src.utils.exceptions import DataValidationError
from src.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class DataSplits:
    """Divisoes do dataset em DataFrames (texto bruto + rotulo)."""

    train: pd.DataFrame
    val: pd.DataFrame
    test: pd.DataFrame


def load_dataset(csv_path: str | Path) -> pd.DataFrame:
    """Le um dataset CSV do disco."""
    path = Path(csv_path)
    if not path.exists():
        raise DataValidationError(f"Arquivo de dados nao encontrado: {path}")
    df = pd.read_csv(path)
    logger.info("Dataset carregado de %s: %d registros", path, len(df))
    return df


def split_dataset(df: pd.DataFrame, config: DataConfig, seed: int = 42) -> DataSplits:
    """Divide o dataset em treino/validacao/teste com estratificacao.

    A divisao e feita sobre o texto bruto ANTES de qualquer fit de
    vetorizador, evitando data leakage.
    """
    label_col = config.label_column
    train_val, test = train_test_split(
        df,
        test_size=config.test_size,
        stratify=df[label_col],
        random_state=seed,
    )
    val_fraction = config.val_size / (1.0 - config.test_size)
    train, val = train_test_split(
        train_val,
        test_size=val_fraction,
        stratify=train_val[label_col],
        random_state=seed,
    )
    logger.info(
        "Divisao: treino=%d, validacao=%d, teste=%d", len(train), len(val), len(test)
    )
    return DataSplits(
        train=train.reset_index(drop=True),
        val=val.reset_index(drop=True),
        test=test.reset_index(drop=True),
    )


def save_splits(splits: DataSplits, out_dir: str | Path) -> None:
    """Salva as divisoes em CSV para reprodutibilidade e avaliacao posterior."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    splits.train.to_csv(out / "train.csv", index=False)
    splits.val.to_csv(out / "val.csv", index=False)
    splits.test.to_csv(out / "test.csv", index=False)
    logger.info("Divisoes salvas em %s", out)


def build_dataloader(
    features: np.ndarray,
    labels: np.ndarray,
    batch_size: int,
    shuffle: bool = False,
    num_workers: int = 0,
) -> DataLoader:
    """Cria um DataLoader a partir de matrizes NumPy ja pre-processadas."""
    dataset = TensorDataset(
        torch.from_numpy(features).float(),
        torch.from_numpy(labels).long(),
    )
    return DataLoader(
        dataset, batch_size=batch_size, shuffle=shuffle, num_workers=num_workers
    )
