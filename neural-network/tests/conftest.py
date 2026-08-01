"""Fixtures compartilhadas: dataset sintetico pequeno e modelo treinado."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import pytest
import torch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from generate_sample_data import generate_dataset  # noqa: E402

from src.config import AppConfig  # noqa: E402
from src.data.loader import build_dataloader, split_dataset  # noqa: E402
from src.data.preprocessing import TextPreprocessor  # noqa: E402
from src.data.validation import clean_dataframe  # noqa: E402
from src.models.model_factory import build_model  # noqa: E402
from src.training.callbacks import ModelCheckpoint  # noqa: E402
from src.training.trainer import Trainer  # noqa: E402
from src.utils.seed import set_seed  # noqa: E402


@pytest.fixture(scope="session")
def test_config() -> AppConfig:
    """Configuracao reduzida para testes rapidos."""
    config = AppConfig()
    config.features.max_features = 500
    config.features.min_df = 1
    config.model.hidden_dims = [32]
    config.training.epochs = 3
    config.training.batch_size = 32
    return config


@pytest.fixture(scope="session")
def raw_dataframe() -> pd.DataFrame:
    """Dataset sintetico bruto (com sujeira proposital)."""
    return generate_dataset(rows=600, seed=123)


@pytest.fixture(scope="session")
def trained_artifacts(
    test_config: AppConfig, raw_dataframe: pd.DataFrame, tmp_path_factory: pytest.TempPathFactory
) -> Path:
    """Treina um modelo minimo e retorna o diretorio de artefatos."""
    set_seed(test_config.seed)
    models_dir = tmp_path_factory.mktemp("models")

    df, _ = clean_dataframe(raw_dataframe, test_config.data)
    splits = split_dataset(df, test_config.data, seed=test_config.seed)

    preprocessor = TextPreprocessor(test_config.features)
    text_col, label_col = test_config.data.text_column, test_config.data.label_column
    preprocessor.fit(splits.train[text_col], splits.train[label_col])

    x_train = preprocessor.transform_texts(splits.train[text_col])
    y_train = preprocessor.transform_labels(splits.train[label_col])
    x_val = preprocessor.transform_texts(splits.val[text_col])
    y_val = preprocessor.transform_labels(splits.val[label_col])

    train_loader = build_dataloader(x_train, y_train, 32, shuffle=True)
    val_loader = build_dataloader(x_val, y_val, 32)

    model = build_model(test_config.model, preprocessor.input_dim, len(preprocessor.classes))
    checkpoint = ModelCheckpoint(models_dir)
    trainer = Trainer(
        model,
        test_config,
        checkpoint,
        device=torch.device("cpu"),
        checkpoint_extra={
            "input_dim": preprocessor.input_dim,
            "num_classes": len(preprocessor.classes),
            "hidden_dims": list(test_config.model.hidden_dims),
            "dropout": test_config.model.dropout,
            "batch_norm": test_config.model.batch_norm,
            "classes": preprocessor.classes,
        },
    )
    trainer.fit(train_loader, val_loader)
    preprocessor.save(models_dir / "preprocessor.joblib")
    return models_dir
