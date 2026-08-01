"""Testes de carga, validacao e pre-processamento dos dados."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from src.config import AppConfig
from src.data.loader import load_dataset, split_dataset
from src.data.preprocessing import TextPreprocessor, clean_text
from src.data.validation import clean_dataframe
from src.utils.exceptions import DataValidationError, PreprocessingError


def test_load_dataset_missing_file() -> None:
    with pytest.raises(DataValidationError):
        load_dataset("data/raw/nao_existe.csv")


def test_load_dataset_roundtrip(raw_dataframe: pd.DataFrame, tmp_path: Path) -> None:
    csv_path = tmp_path / "tickets.csv"
    raw_dataframe.to_csv(csv_path, index=False)
    loaded = load_dataset(csv_path)
    assert len(loaded) == len(raw_dataframe)
    assert {"texto", "categoria"} <= set(loaded.columns)


def test_clean_dataframe_removes_dirty_rows(
    raw_dataframe: pd.DataFrame, test_config: AppConfig
) -> None:
    cleaned, report = clean_dataframe(raw_dataframe, test_config.data)
    assert report.rows_out < report.rows_in
    assert report.missing_removed > 0
    assert report.duplicates_removed > 0
    assert not cleaned["texto"].isna().any()
    assert not cleaned.duplicated(subset=["texto", "categoria"]).any()


def test_clean_dataframe_rejects_bad_schema(test_config: AppConfig) -> None:
    with pytest.raises(DataValidationError):
        clean_dataframe(pd.DataFrame({"foo": ["a"], "bar": ["b"]}), test_config.data)


def test_split_is_stratified_and_disjoint(
    raw_dataframe: pd.DataFrame, test_config: AppConfig
) -> None:
    df, _ = clean_dataframe(raw_dataframe, test_config.data)
    splits = split_dataset(df, test_config.data, seed=42)
    total = len(splits.train) + len(splits.val) + len(splits.test)
    assert total == len(df)
    assert set(splits.train["categoria"]) == set(df["categoria"])


def test_clean_text_normalizes() -> None:
    raw = "URGENTE:  VPN nao conecta!! veja https://exemplo.com/erro"
    cleaned = clean_text(raw)
    assert cleaned == "urgente vpn nao conecta veja"


def test_preprocessor_shapes_and_roundtrip(
    raw_dataframe: pd.DataFrame, test_config: AppConfig, tmp_path: Path
) -> None:
    df, _ = clean_dataframe(raw_dataframe, test_config.data)
    preprocessor = TextPreprocessor(test_config.features)
    preprocessor.fit(df["texto"], df["categoria"])

    features = preprocessor.transform_texts(df["texto"].head(10))
    assert features.shape == (10, preprocessor.input_dim)
    assert features.dtype == np.float32

    labels = preprocessor.transform_labels(df["categoria"].head(10))
    assert labels.shape == (10,)
    assert preprocessor.inverse_transform_labels(labels) == list(df["categoria"].head(10))

    path = tmp_path / "prep.joblib"
    preprocessor.save(path)
    restored = TextPreprocessor.load(path)
    np.testing.assert_allclose(
        restored.transform_texts(["vpn nao conecta"]),
        preprocessor.transform_texts(["vpn nao conecta"]),
    )


def test_preprocessor_requires_fit(test_config: AppConfig) -> None:
    preprocessor = TextPreprocessor(test_config.features)
    with pytest.raises(PreprocessingError):
        preprocessor.transform_texts(["texto qualquer"])
