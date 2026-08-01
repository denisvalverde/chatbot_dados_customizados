"""Redaction: mascaramento de dados sensiveis antes de armazenar/treinar.

Mascara e-mails, telefones, tokens/chaves/segredos, authorization headers,
access keys AWS/S3 e, opcionalmente, IPs (configuravel por chamada, pois IPs
costumam ser evidencia tecnica legitima).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("email", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")),
    ("telefone", re.compile(r"\b(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}\b")),
    ("aws_access_key", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("aws_secret", re.compile(r"(?i)\baws_secret_access_key\s*[=:]\s*\S+")),
    ("authorization", re.compile(r"(?i)\bauthorization\s*:\s*\S+(?:\s+\S+)?")),
    ("bearer", re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/-]{16,}=*")),
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----")),
    ("password_kv", re.compile(r"(?i)\b(senha|password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)\b\s*[=:]\s*\S+")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")),
]

_IP_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}(?:/\d{1,2})?\b")


@dataclass
class RedactionResult:
    """Texto mascarado + contagem por tipo de dado sensivel encontrado."""

    text: str
    found: dict[str, int] = field(default_factory=dict)

    @property
    def had_secrets(self) -> bool:
        sensitive = {
            "aws_access_key", "aws_secret", "authorization", "bearer",
            "private_key", "password_kv", "jwt",
        }
        return any(self.found.get(k, 0) > 0 for k in sensitive)


def redact(text: str, mask_ips: bool = False) -> RedactionResult:
    """Aplica mascaramento e retorna o texto seguro + relatorio."""
    found: dict[str, int] = {}
    result = text
    for name, pattern in _PATTERNS:
        result, count = pattern.subn(f"[{name.upper()}_REDACTED]", result)
        if count:
            found[name] = count
    if mask_ips:
        result, count = _IP_PATTERN.subn("[IP_REDACTED]", result)
        if count:
            found["ip"] = count
    return RedactionResult(text=result, found=found)
