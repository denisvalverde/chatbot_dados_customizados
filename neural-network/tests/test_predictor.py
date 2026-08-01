"""Testes de inferencia individual e em lote."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.inference.predictor import Predictor
from src.utils.exceptions import ModelNotFoundError


def test_from_artifacts_missing_dir(tmp_path: Path) -> None:
    with pytest.raises(ModelNotFoundError):
        Predictor.from_artifacts(tmp_path)


def test_single_prediction(trained_artifacts: Path) -> None:
    predictor = Predictor.from_artifacts(trained_artifacts)
    result = predictor.predict("minha senha do erp foi bloqueada e nao consigo fazer login")
    assert result.label in predictor.preprocessor.classes
    assert 0.0 <= result.confidence <= 1.0
    assert result.probabilities[result.label] == pytest.approx(result.confidence)
    assert sum(result.probabilities.values()) == pytest.approx(1.0, abs=1e-4)


def test_batch_prediction(trained_artifacts: Path) -> None:
    predictor = Predictor.from_artifacts(trained_artifacts)
    texts = [
        "internet do setor comercial esta caindo toda hora",
        "meu notebook nao liga desde ontem",
        "cobranca duplicada na fatura deste mes",
    ]
    results = predictor.predict_batch(texts)
    assert len(results) == len(texts)
    for result in results:
        assert result.label in predictor.preprocessor.classes


def test_batch_prediction_empty(trained_artifacts: Path) -> None:
    predictor = Predictor.from_artifacts(trained_artifacts)
    assert predictor.predict_batch([]) == []


def test_predictor_info(trained_artifacts: Path) -> None:
    predictor = Predictor.from_artifacts(trained_artifacts)
    info = predictor.info()
    assert info["num_classes"] == len(info["classes"])
    assert info["input_dim"] > 0
    assert info["model_version"]
