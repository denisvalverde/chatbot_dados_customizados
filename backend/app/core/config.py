"""Configuracao centralizada via variaveis de ambiente (pydantic-settings).

Padroes escolhidos para funcionar 100% local, sem servicos externos:
SQLite + vector store local + embeddings locais + LLM local por templates.
Adaptadores externos (Postgres/pgvector, Sentence Transformers, OpenAI,
Anthropic, Redis) sao ativados apenas por variavel de ambiente.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Configuracao da aplicacao. Tudo pode ser sobrescrito por env vars."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ROOT / ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    # Aplicacao
    app_name: str = "Plataforma IA Suporte/SRE"
    environment: str = "development"  # development | test | production
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # Banco de dados (SQLite local por padrao; Postgres em producao)
    database_url: str = f"sqlite:///{BACKEND_ROOT / 'data' / 'platform.db'}"
    database_echo: bool = False

    # Seguranca
    jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION-use-32+-random-bytes"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 480
    admin_email: str = "admin@example.com"
    admin_password: str = ""  # se vazio, o seed gera uma senha aleatoria e exibe uma unica vez

    # Rate limiting (janela deslizante em memoria)
    rate_limit_requests: int = 120
    rate_limit_window_seconds: int = 60

    # Uploads
    max_upload_bytes: int = 5 * 1024 * 1024

    # Embeddings: local | sentence-transformers | openai
    embedding_provider: str = "local"
    embedding_dim: int = 384
    sentence_transformers_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

    # Vector store: local | pgvector
    vector_backend: str = "local"

    # LLM: local | openai | anthropic | mock (mock apenas em testes)
    llm_provider: str = "local"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5"
    llm_timeout_seconds: int = 60

    # ML
    ml_artifacts_dir: str = str(BACKEND_ROOT / "app" / "ml" / "artifacts")
    ml_dataset_path: str = str(BACKEND_ROOT / "datasets" / "tickets_synthetic.jsonl")

    # Observabilidade
    log_level: str = "INFO"
    metrics_enabled: bool = True

    # Redis/fila (opcional; a aplicacao funciona sem)
    redis_url: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_test(self) -> bool:
        return self.environment == "test"


@lru_cache
def get_settings() -> Settings:
    """Instancia unica de configuracao (cacheada)."""
    return Settings()
