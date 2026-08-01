"""Provedores de embeddings com interface abstrata (secao 4.3).

Padrao: LocalHashingEmbedder — deterministico, offline, sem download de
modelos (HashingVectorizer caractere+palavra com normalizacao L2). Adequado
como fallback funcional; para producao com dados reais, configure
EMBEDDING_PROVIDER=sentence-transformers (modelo multilingue) ou openai.
"""

from __future__ import annotations

from typing import Protocol

import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer

from app.core.config import get_settings
from app.core.exceptions import ProviderError
from app.core.logging import get_logger

logger = get_logger(__name__)


class EmbeddingProvider(Protocol):
    """Contrato de provedor de embeddings."""

    dim: int
    name: str

    def embed(self, texts: list[str]) -> np.ndarray:
        """Retorna matriz (n, dim) float32 L2-normalizada."""
        ...


class LocalHashingEmbedder:
    """Embedding local deterministico: hashing de palavras + bigramas de char.

    Nao captura semantica profunda como um transformer, mas e estavel,
    offline, rapido e suficiente para similaridade lexical — e serve como
    baseline honesto enquanto nao ha provedor semantico configurado.
    """

    name = "local-hashing"

    def __init__(self, dim: int = 384) -> None:
        self.dim = dim
        half = dim // 2
        self._word = HashingVectorizer(
            n_features=half, ngram_range=(1, 2), norm=None, alternate_sign=False
        )
        self._char = HashingVectorizer(
            n_features=dim - half, analyzer="char_wb", ngram_range=(3, 4),
            norm=None, alternate_sign=False,
        )

    def embed(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        words = np.asarray(self._word.transform(texts).todense(), dtype=np.float32)
        chars = np.asarray(self._char.transform(texts).todense(), dtype=np.float32)
        matrix = np.concatenate([words, chars], axis=1)
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return (matrix / norms).astype(np.float32)


class SentenceTransformersEmbedder:
    """Adapter para sentence-transformers (requer pacote + download do modelo)."""

    name = "sentence-transformers"

    def __init__(self, model_name: str) -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise ProviderError(
                "Pacote 'sentence-transformers' nao instalado. "
                "Instale com: pip install sentence-transformers"
            ) from exc
        self._model = SentenceTransformer(model_name)
        self.dim = int(self._model.get_sentence_embedding_dimension())

    def embed(self, texts: list[str]) -> np.ndarray:
        vectors = self._model.encode(
            texts, normalize_embeddings=True, show_progress_bar=False
        )
        return np.asarray(vectors, dtype=np.float32)


class OpenAIEmbedder:
    """Adapter para embeddings da OpenAI via HTTP (sem SDK)."""

    name = "openai"
    dim = 1536

    def __init__(self, api_key: str, model: str = "text-embedding-3-small") -> None:
        if not api_key:
            raise ProviderError("OPENAI_API_KEY nao configurada para embeddings.")
        self._api_key = api_key
        self._model = model

    def embed(self, texts: list[str]) -> np.ndarray:
        import httpx

        response = httpx.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={"model": self._model, "input": texts},
            timeout=60,
        )
        if response.status_code != 200:
            raise ProviderError(f"OpenAI embeddings falhou: {response.status_code}")
        data = response.json()["data"]
        matrix = np.asarray([item["embedding"] for item in data], dtype=np.float32)
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return matrix / norms


_provider: EmbeddingProvider | None = None


def get_embedder() -> EmbeddingProvider:
    """Fabrica (singleton) do provedor configurado, com fallback local seguro."""
    global _provider
    if _provider is not None:
        return _provider
    settings = get_settings()
    choice = settings.embedding_provider.lower()
    if choice == "sentence-transformers":
        try:
            _provider = SentenceTransformersEmbedder(settings.sentence_transformers_model)
        except ProviderError as exc:
            logger.warning("Fallback para embeddings locais: %s", exc)
            _provider = LocalHashingEmbedder(settings.embedding_dim)
    elif choice == "openai":
        _provider = OpenAIEmbedder(settings.openai_api_key)
    else:
        _provider = LocalHashingEmbedder(settings.embedding_dim)
    logger.info("Provedor de embeddings ativo: %s (dim=%d)", _provider.name, _provider.dim)
    return _provider


def reset_embedder() -> None:
    """Limpa o singleton (usado em testes)."""
    global _provider
    _provider = None
