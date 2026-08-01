"""Inferencia da rede multi-head com carregamento preguicoso do checkpoint."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import torch

from app.core.config import get_settings
from app.core.exceptions import ModelNotReadyError
from app.core.logging import get_logger
from app.infrastructure.embeddings import get_embedder
from app.ml.network import MultiHeadTicketClassifier

logger = get_logger(__name__)


class NeuralPredictor:
    """Carrega o checkpoint treinado e executa inferencia por texto."""

    def __init__(self, checkpoint_path: str | Path) -> None:
        path = Path(checkpoint_path)
        if not path.exists():
            raise ModelNotReadyError(
                f"Checkpoint nao encontrado em {path}. Treine com scripts/train_nn.py "
                "ou POST /api/v1/models/train."
            )
        state = torch.load(path, map_location="cpu", weights_only=False)
        self.vocab: dict[str, list[str]] = state["vocab"]
        self.embedder_name: str = state.get("embedder", "?")
        self.synthetic_examples: int = int(state.get("synthetic_examples", 0))
        self.total_examples: int = int(state.get("total_examples", 0))
        self.trained_at: str = state.get("trained_at", "")
        self.model = MultiHeadTicketClassifier(
            input_dim=state["input_dim"], head_sizes=state["head_sizes"]
        )
        self.model.load_state_dict(state["state_dict"])
        self.model.eval()
        self._embedder = get_embedder()
        if self._embedder.name != self.embedder_name:
            logger.warning(
                "Embedder atual (%s) difere do usado no treino (%s); "
                "as predicoes da rede serao ignoradas em favor do baseline.",
                self._embedder.name, self.embedder_name,
            )
            raise ModelNotReadyError(
                "Embedder ativo difere do usado no treinamento; retreine o modelo."
            )

    @property
    def is_synthetic_only(self) -> bool:
        """True quando o modelo foi treinado apenas com dados sinteticos."""
        return self.total_examples > 0 and self.synthetic_examples == self.total_examples

    def predict(self, text: str) -> dict[str, Any]:
        """Predicao por cabeca com confianca."""
        vector = torch.from_numpy(self._embedder.embed([text])).float()
        output = self.model.predict(vector)
        result: dict[str, Any] = {}
        for head in self.model.MULTICLASS_HEADS:
            probs = output[head][0]
            index = int(probs.argmax())
            result[head] = {
                "valor": self.vocab[head][index],
                "confianca": round(float(probs[index]), 4),
            }
        tech_probs = output[self.model.MULTILABEL_HEAD][0]
        result["tecnologias"] = [
            {"valor": self.vocab["tecnologias"][i], "confianca": round(float(p), 4)}
            for i, p in enumerate(tech_probs.tolist())
            if p >= 0.5
        ]
        return result


_predictor: NeuralPredictor | None = None
_load_failed = False


def get_neural_predictor() -> NeuralPredictor | None:
    """Singleton tolerante: retorna None se nao houver modelo treinado."""
    global _predictor, _load_failed
    if _predictor is not None:
        return _predictor
    if _load_failed:
        return None
    settings = get_settings()
    try:
        _predictor = NeuralPredictor(Path(settings.ml_artifacts_dir) / "multihead_best.pt")
        return _predictor
    except ModelNotReadyError:
        _load_failed = True
        return None


def reset_neural_predictor() -> None:
    """Forca recarga (apos novo treinamento ou em testes)."""
    global _predictor, _load_failed
    _predictor = None
    _load_failed = False
