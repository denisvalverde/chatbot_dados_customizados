"""Engine e sessao SQLAlchemy 2 (SQLite local por padrao, Postgres via env)."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Base declarativa dos modelos ORM."""


def _build_engine():
    settings = get_settings()
    url = settings.database_url
    kwargs: dict = {"echo": settings.database_echo, "pool_pre_ping": True}
    if url.startswith("sqlite"):
        Path(url.split("///", 1)[-1]).parent.mkdir(parents=True, exist_ok=True)
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs.update({"pool_size": 5, "max_overflow": 10})
    return create_engine(url, **kwargs)


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Dependencia FastAPI: sessao por requisicao."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Cria as tabelas (usado em dev/testes; producao usa Alembic)."""
    from app.infrastructure import models  # noqa: F401  (registra os modelos)

    Base.metadata.create_all(bind=engine)
