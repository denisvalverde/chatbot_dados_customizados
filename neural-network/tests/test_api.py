"""Testes dos endpoints da API FastAPI."""

from __future__ import annotations

from pathlib import Path
from typing import Iterator

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(trained_artifacts: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """Cliente de teste com o modelo minimo carregado via MODELS_DIR."""
    monkeypatch.setenv("MODELS_DIR", str(trained_artifacts))
    from src.api.main import app

    with TestClient(app) as test_client:
        yield test_client


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True


def test_model_info(client: TestClient) -> None:
    response = client.get("/model-info")
    assert response.status_code == 200
    body = response.json()
    assert body["num_classes"] == len(body["classes"])
    assert body["input_dim"] > 0


def test_predict(client: TestClient) -> None:
    response = client.post(
        "/predict", json={"text": "nao consigo fazer login no portal desde ontem"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["prediction"]
    assert 0.0 <= body["confidence"] <= 1.0
    assert body["model_version"]
    assert body["prediction"] in body["probabilities"]


def test_predict_rejects_short_text(client: TestClient) -> None:
    response = client.post("/predict", json={"text": "oi"})
    assert response.status_code == 422


def test_predict_rejects_missing_field(client: TestClient) -> None:
    response = client.post("/predict", json={})
    assert response.status_code == 422


def test_predict_batch(client: TestClient) -> None:
    texts = [
        "meu notebook nao liga desde ontem",
        "erro de licenca ao abrir o erp hoje de manha",
    ]
    response = client.post("/predict-batch", json={"texts": texts})
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 2
    assert len(body["predictions"]) == 2


def test_predict_batch_rejects_short_items(client: TestClient) -> None:
    response = client.post("/predict-batch", json={"texts": ["ok"]})
    assert response.status_code == 422


def test_api_without_model(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("MODELS_DIR", str(tmp_path))
    from src.api.main import app

    with TestClient(app) as test_client:
        health = test_client.get("/health")
        assert health.json()["model_loaded"] is False
        predict = test_client.post("/predict", json={"text": "texto de teste valido"})
        assert predict.status_code == 503
