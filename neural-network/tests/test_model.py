"""Testes da arquitetura da rede neural."""

from __future__ import annotations

import pytest
import torch

from src.config import ModelConfig
from src.models.model_factory import build_model, count_parameters
from src.models.neural_network import MLPClassifier


def test_forward_pass_output_shape() -> None:
    model = MLPClassifier(input_dim=100, num_classes=6, hidden_dims=[32, 16])
    batch = torch.randn(8, 100)
    logits = model(batch)
    assert logits.shape == (8, 6)


def test_predict_proba_sums_to_one() -> None:
    model = MLPClassifier(input_dim=50, num_classes=4, hidden_dims=[16])
    proba = model.predict_proba(torch.randn(5, 50))
    assert proba.shape == (5, 4)
    torch.testing.assert_close(proba.sum(dim=1), torch.ones(5))


def test_invalid_dimensions_raise() -> None:
    with pytest.raises(ValueError):
        MLPClassifier(input_dim=0, num_classes=3)
    with pytest.raises(ValueError):
        MLPClassifier(input_dim=10, num_classes=1)


def test_factory_builds_from_config() -> None:
    config = ModelConfig(hidden_dims=[64, 32], dropout=0.5, batch_norm=False)
    model = build_model(config, input_dim=200, num_classes=5)
    assert isinstance(model, MLPClassifier)
    assert count_parameters(model) > 0
    assert model(torch.randn(3, 200)).shape == (3, 5)
