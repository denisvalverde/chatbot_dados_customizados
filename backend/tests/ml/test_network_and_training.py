"""Rede multi-head: forward, treino minimo, inferencia e ONNX."""

from __future__ import annotations

from pathlib import Path

import pytest
import torch

from app.ml.dataset import (
    DatasetExample,
    generate_synthetic_dataset,
    label_vocabularies,
    load_dataset,
    save_dataset,
)
from app.ml.network import MultiHeadTicketClassifier


def _head_sizes() -> dict[str, int]:
    vocab = label_vocabularies()
    return {head: len(labels) for head, labels in vocab.items()}


class TestNetwork:
    def test_forward_shapes(self) -> None:
        sizes = _head_sizes()
        model = MultiHeadTicketClassifier(input_dim=64, head_sizes=sizes, hidden_dim=32)
        logits = model(torch.randn(4, 64))
        for head, size in sizes.items():
            assert logits[head].shape == (4, size)

    def test_predict_probabilidades(self) -> None:
        model = MultiHeadTicketClassifier(input_dim=32, head_sizes=_head_sizes(), hidden_dim=16)
        output = model.predict(torch.randn(2, 32))
        soma = output["categoria"].sum(dim=1)
        torch.testing.assert_close(soma, torch.ones(2))
        assert ((output["tecnologias"] >= 0) & (output["tecnologias"] <= 1)).all()

    def test_head_faltando_gera_erro(self) -> None:
        with pytest.raises(ValueError):
            MultiHeadTicketClassifier(input_dim=8, head_sizes={"categoria": 3})


class TestDataset:
    def test_gerador_marca_sintetico(self, tmp_path: Path) -> None:
        examples = generate_synthetic_dataset(rows=50, seed=1)
        assert all(e.origem == "sintetico" for e in examples)
        path = tmp_path / "ds.jsonl"
        save_dataset(examples, path)
        loaded = load_dataset(path)
        assert len(loaded) == 50

    def test_valida_tecnologia_desconhecida(self) -> None:
        with pytest.raises(ValueError):
            DatasetExample(
                texto="texto valido para teste", categoria="rede",
                tecnologias=["tecnologia_que_nao_existe"],
            )


class TestTraining:
    def test_treino_minimo_e_inferencia(self, tmp_workdir: Path) -> None:
        from app.ml.infer import NeuralPredictor
        from app.ml.train import train_model

        dataset_path = tmp_workdir / "dataset.jsonl"
        save_dataset(generate_synthetic_dataset(rows=300, seed=7), dataset_path)
        result = train_model(
            dataset_path=dataset_path, epochs=3,
            artifacts_dir=tmp_workdir / "artifacts",
        )
        metrics = result["metrics"]
        assert metrics["categoria"]["accuracy"] > 0.3
        assert metrics["is_production_ready"] is False  # 100% sintetico
        assert "aviso" in metrics
        assert Path(result["onnx"]).exists()

        predictor = NeuralPredictor(result["checkpoint"])
        prediction = predictor.predict("virtual disk degraded na controladora megaraid")
        assert prediction["categoria"]["valor"]
        assert 0 <= prediction["categoria"]["confianca"] <= 1
        assert predictor.is_synthetic_only
