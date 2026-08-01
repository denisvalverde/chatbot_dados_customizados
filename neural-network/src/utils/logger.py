"""Configuracao centralizada de logging usando a biblioteca padrao."""

from __future__ import annotations

import logging
import os
import sys

_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
_CONFIGURED = False


def _configure_root() -> None:
    """Configura o logger raiz uma unica vez."""
    global _CONFIGURED
    if _CONFIGURED:
        return
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_FORMAT))
    root = logging.getLogger()
    root.setLevel(level)
    if not root.handlers:
        root.addHandler(handler)
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Retorna um logger nomeado com a configuracao padrao do projeto."""
    _configure_root()
    return logging.getLogger(name)
