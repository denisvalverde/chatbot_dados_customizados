"""Predictor: carrega artefatos e executa inferencia individual e em lote.

Aplica exatamente o mesmo pre-processamento do treinamento, pois o
TextPreprocessor persistido no treino e recarregado aqui.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch

from src.data.preprocessing import TextPreprocessor
from src.models.neural_network import MLPClassifier
from src.utils.exceptions import ModelNotFoundError
from src.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class Prediction:
    """Resultado de uma predicao individual."""

    label: str
    confidence: float
    probabilities: dict[str, float]


class Predictor:
    """Encapsula modelo + pre-processador para inferencia."""

    def __init__(
        self,
        model: MLPClassifier,
        preprocessor: TextPreprocessor,
        model_version: str,
        device: torch.device | None = None,
    ) -> None:
        self.device = device or torch.device("cpu")
        self.model = model.to(self.device)
        self.model.eval()
        self.preprocessor = preprocessor
        self.model_version = model_version

    @classmethod
    def from_artifacts(
        cls, models_dir: str | Path, device: torch.device | None = None
    ) -> "Predictor":
        """Carrega o melhor modelo e o pre-processador de um diretorio."""
        models_dir = Path(models_dir)
        model_path = models_dir / "best_model.pt"
        preprocessor_path = models_dir / "preprocessor.joblib"
        if not model_path.exists() or not preprocessor_path.exists():
            raise ModelNotFoundError(
                f"Artefatos ausentes em {models_dir}. Esperados: "
                f"{model_path.name} e {preprocessor_path.name}. Execute o treinamento."
            )
        preprocessor = TextPreprocessor.load(preprocessor_path)
        checkpoint = torch.load(model_path, map_location="cpu", weights_only=False)
        model = MLPClassifier(
            input_dim=checkpoint["input_dim"],
            num_classes=checkpoint["num_classes"],
            hidden_dims=checkpoint["hidden_dims"],
            dropout=checkpoint["dropout"],
            batch_norm=checkpoint["batch_norm"],
        )
        model.load_state_dict(checkpoint["model_state_dict"])
        version = str(checkpoint.get("model_version", "unknown"))
        logger.info("Predictor carregado (versao %s) de %s", version, models_dir)
        return cls(model=model, preprocessor=preprocessor, model_version=version, device=device)

    def predict(self, text: str) -> Prediction:
        """Classifica um unico texto."""
        return self.predict_batch([text])[0]

    def predict_batch(self, texts: list[str]) -> list[Prediction]:
        """Classifica uma lista de textos."""
        if not texts:
            return []
        features = self.preprocessor.transform_texts(texts)
        tensor = torch.from_numpy(features).float().to(self.device)
        probabilities = self.model.predict_proba(tensor).cpu().numpy()
        classes = self.preprocessor.classes
        results: list[Prediction] = []
        for row in probabilities:
            index = int(np.argmax(row))
            results.append(
                Prediction(
                    label=classes[index],
                    confidence=float(row[index]),
                    probabilities={cls: float(p) for cls, p in zip(classes, row)},
                )
            )
        return results

    def info(self) -> dict[str, object]:
        """Metadados do modelo carregado (para o endpoint /model-info)."""
        return {
            "model_version": self.model_version,
            "model_type": type(self.model).__name__,
            "input_dim": self.model.input_dim,
            "num_classes": self.model.num_classes,
            "classes": self.preprocessor.classes,
            "device": str(self.device),
            "transformations": self.preprocessor.transformations,
        }
