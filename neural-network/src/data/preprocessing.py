"""Pipeline de pre-processamento de texto reutilizavel (treino e inferencia).

O pipeline e ajustado (fit) exclusivamente nos dados de treino para evitar
data leakage e e persistido em disco, garantindo que a inferencia aplique
exatamente as mesmas transformacoes do treinamento.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Iterable

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder

from src.config import FeaturesConfig
from src.utils.exceptions import PreprocessingError
from src.utils.logger import get_logger

logger = get_logger(__name__)

_URL_RE = re.compile(r"https?://\S+|www\.\S+")
_NON_TEXT_RE = re.compile(r"[^a-z0-9áàâãéèêíïóôõöúçñü\s]", re.IGNORECASE)
_SPACES_RE = re.compile(r"\s+")


def clean_text(text: str) -> str:
    """Normaliza um texto: minusculas, remove URLs, pontuacao e espacos extras."""
    text = text.lower()
    text = _URL_RE.sub(" ", text)
    text = _NON_TEXT_RE.sub(" ", text)
    return _SPACES_RE.sub(" ", text).strip()


class TextPreprocessor:
    """Vetorizacao TF-IDF + codificacao de rotulos, com persistencia."""

    def __init__(self, config: FeaturesConfig) -> None:
        self.config = config
        self.vectorizer = TfidfVectorizer(
            max_features=config.max_features,
            ngram_range=config.ngram_range,
            min_df=config.min_df,
            sublinear_tf=config.sublinear_tf,
            preprocessor=clean_text,
        )
        self.label_encoder = LabelEncoder()
        self.fitted = False
        self.transformations: list[str] = []

    def fit(self, texts: Iterable[str], labels: Iterable[str]) -> "TextPreprocessor":
        """Ajusta o vetorizador e o codificador de rotulos no conjunto de treino."""
        texts = list(texts)
        labels = list(labels)
        if not texts:
            raise PreprocessingError("Lista de textos vazia no fit do pre-processador.")
        self.vectorizer.fit(texts)
        self.label_encoder.fit(labels)
        self.fitted = True
        self.transformations = [
            "clean_text: minusculas, remocao de URLs/pontuacao/espacos extras",
            (
                f"tfidf: max_features={self.config.max_features}, "
                f"ngram_range={self.config.ngram_range}, min_df={self.config.min_df}, "
                f"sublinear_tf={self.config.sublinear_tf}"
            ),
            f"label_encoder: {len(self.label_encoder.classes_)} classes",
        ]
        logger.info(
            "Pre-processador ajustado: vocabulario=%d, classes=%d",
            len(self.vectorizer.vocabulary_),
            len(self.label_encoder.classes_),
        )
        return self

    def transform_texts(self, texts: Iterable[str]) -> np.ndarray:
        """Transforma textos em matriz densa TF-IDF (float32)."""
        self._check_fitted()
        matrix = self.vectorizer.transform(list(texts))
        return np.asarray(matrix.todense(), dtype=np.float32)

    def transform_labels(self, labels: Iterable[str]) -> np.ndarray:
        """Codifica rotulos em inteiros."""
        self._check_fitted()
        return self.label_encoder.transform(list(labels)).astype(np.int64)

    def inverse_transform_labels(self, indices: Iterable[int]) -> list[str]:
        """Converte indices de classe de volta para os rotulos originais."""
        self._check_fitted()
        return list(self.label_encoder.inverse_transform(np.asarray(list(indices))))

    @property
    def classes(self) -> list[str]:
        """Rotulos conhecidos, na ordem dos indices de classe."""
        self._check_fitted()
        return list(self.label_encoder.classes_)

    @property
    def input_dim(self) -> int:
        """Dimensao do vetor de entrada gerado pelo TF-IDF."""
        self._check_fitted()
        return len(self.vectorizer.vocabulary_)

    def save(self, path: str | Path) -> None:
        """Persiste o pre-processador completo em disco."""
        self._check_fitted()
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path)
        logger.info("Pre-processador salvo em %s", path)

    @staticmethod
    def load(path: str | Path) -> "TextPreprocessor":
        """Carrega um pre-processador previamente salvo."""
        path = Path(path)
        if not path.exists():
            raise PreprocessingError(f"Pre-processador nao encontrado: {path}")
        preprocessor: TextPreprocessor = joblib.load(path)
        if not preprocessor.fitted:
            raise PreprocessingError("Pre-processador carregado nao esta ajustado.")
        return preprocessor

    def metadata(self) -> dict[str, Any]:
        """Metadados das transformacoes aplicadas (para auditoria)."""
        self._check_fitted()
        return {
            "input_dim": self.input_dim,
            "classes": self.classes,
            "transformations": self.transformations,
        }

    def _check_fitted(self) -> None:
        if not self.fitted:
            raise PreprocessingError(
                "Pre-processador nao ajustado. Chame fit() antes de transform()."
            )
