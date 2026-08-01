"""Inicia a API de inferencia com Uvicorn.

Uso:
    python scripts/serve.py
    API_HOST=127.0.0.1 API_PORT=9000 python scripts/serve.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import load_config  # noqa: E402


def main() -> None:
    """Sobe o servidor com host/porta do config, sobrescritos por env vars."""
    config = load_config()
    host = os.environ.get("API_HOST", config.api.host)
    port = int(os.environ.get("API_PORT", config.api.port))
    uvicorn.run("src.api.main:app", host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
