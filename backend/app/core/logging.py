"""Logging estruturado em JSON com correlation/request id."""

from __future__ import annotations

import json
import logging
import sys
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="-")

_CONFIGURED = False


class JsonFormatter(logging.Formatter):
    """Formata cada registro como uma linha JSON."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get(),
            "correlation_id": correlation_id_var.get(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        extra = getattr(record, "extra_fields", None)
        if isinstance(extra, dict):
            payload.update(extra)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    """Configura o logger raiz com saida JSON (idempotente)."""
    global _CONFIGURED
    if _CONFIGURED:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    root.handlers = [handler]
    logging.getLogger("uvicorn.access").disabled = True
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Logger nomeado; assume que configure_logging foi chamado no startup."""
    return logging.getLogger(name)


def new_request_id() -> str:
    """Gera um request id curto."""
    return uuid.uuid4().hex[:16]
