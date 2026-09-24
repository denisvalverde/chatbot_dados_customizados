"""Escrita de arquivos do vault: sanitizacao, idempotencia, resiliencia.

Principios (secao 3 do prompt de integracao):
- nunca lanca excecao para o chamador em caso de falha de disco (loga e
  retorna False) — a sincronizacao nunca pode derrubar uma requisicao HTTP;
- escrita idempotente: mesmo conteudo -> mesmo arquivo, sem duplicar notas;
- nomes de arquivo seguros em Windows/Mac/Linux;
- nunca escreve fora do vault configurado (protege contra path traversal
  em titulos vindos do usuario).
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_INVALID_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_MULTI_SPACE = re.compile(r"\s+")
_MULTI_DASH = re.compile(r"-{2,}")

# Nomes reservados no Windows que nao podem ser usados como nome de arquivo.
_WINDOWS_RESERVED = {
    "con", "prn", "aux", "nul",
    *(f"com{i}" for i in range(1, 10)),
    *(f"lpt{i}" for i in range(1, 10)),
}


def slugify(text: str, max_length: int = 120) -> str:
    """Converte um titulo livre em um nome de arquivo seguro e legivel.

    Preserva acentuacao removida (ASCII), espacos viram '-', caracteres
    invalidos em qualquer SO alvo sao removidos.
    """
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    normalized = _INVALID_CHARS.sub("", normalized).strip()
    normalized = _MULTI_SPACE.sub("-", normalized)
    normalized = _MULTI_DASH.sub("-", normalized).strip("-.")
    if not normalized:
        normalized = "nota"
    if normalized.lower() in _WINDOWS_RESERVED:
        normalized = f"{normalized}-nota"
    return normalized[:max_length] or "nota"


def is_enabled() -> bool:
    """True quando um vault esta configurado."""
    return bool(get_settings().obsidian_vault_path.strip())


def vault_root() -> Path | None:
    """Raiz do vault configurado, ou None se a integracao estiver desativada."""
    path = get_settings().obsidian_vault_path.strip()
    return Path(path) if path else None


def _safe_join(root: Path, relative: str) -> Path | None:
    """Junta root+relative garantindo que o resultado fique dentro de root."""
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        logger.error("Caminho fora do vault bloqueado: %s", relative)
        return None
    return candidate


def write_note(relative_path: str, content: str) -> bool:
    """Escreve/atualiza uma nota Markdown no vault. Retorna True em sucesso.

    Idempotente: se o conteudo já for igual ao existente, evita escrita
    desnecessaria (preserva mtime, o que ajuda a "recencia" no Obsidian).
    """
    root = vault_root()
    if root is None:
        return False
    target = _safe_join(root, relative_path)
    if target is None:
        return False
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and target.read_text(encoding="utf-8") == content:
            return True
        target.write_text(content, encoding="utf-8")
        return True
    except OSError as exc:
        logger.error("Falha ao escrever nota %s: %s", target, exc)
        return False


def write_json(relative_path: str, data: dict[str, Any]) -> bool:
    """Escreve um arquivo JSON (usado para .canvas) no vault."""
    return write_note(relative_path, json.dumps(data, indent=2, ensure_ascii=False))


def count_notes() -> dict[str, int]:
    """Conta notas .md e .canvas por subpasta de primeiro nivel (para /status)."""
    root = vault_root()
    if root is None or not root.exists():
        return {}
    counts: dict[str, int] = {}
    for child in sorted(root.iterdir()):
        if child.is_dir():
            counts[child.name] = sum(1 for _ in child.rglob("*.md")) + sum(
                1 for _ in child.rglob("*.canvas")
            )
    return counts
