"""Seguranca: hash de senha (PBKDF2, stdlib), JWT (PyJWT) e RBAC."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError, PermissionDeniedError

_PBKDF2_ITERATIONS = 240_000

# Papeis e permissoes (RBAC simples e explicito)
ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin": {
        "tickets:read", "tickets:write", "analysis:run", "knowledge:read",
        "knowledge:write", "feedback:write", "models:read", "models:manage",
        "users:manage", "audit:read",
    },
    "analyst": {
        "tickets:read", "tickets:write", "analysis:run", "knowledge:read",
        "knowledge:write", "feedback:write", "models:read",
    },
    "viewer": {"tickets:read", "knowledge:read", "models:read"},
}


def hash_password(password: str) -> str:
    """Gera hash PBKDF2-SHA256 com salt aleatorio (formato salt$hash)."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ITERATIONS
    )
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Verifica a senha contra o hash armazenado (comparacao constante)."""
    try:
        salt, expected = stored.split("$", 1)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ITERATIONS
    )
    return hmac.compare_digest(digest.hex(), expected)


def create_access_token(user_id: int, email: str, role: str) -> str:
    """Emite um JWT assinado com expiracao."""
    settings = get_settings()
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expiration_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decodifica e valida um JWT; lanca AuthenticationError se invalido."""
    settings = get_settings()
    try:
        return jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Token expirado.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("Token invalido.") from exc


def require_permission(role: str, permission: str) -> None:
    """Garante que o papel possui a permissao; lanca PermissionDeniedError."""
    if permission not in ROLE_PERMISSIONS.get(role, set()):
        raise PermissionDeniedError(
            f"Papel '{role}' nao possui a permissao '{permission}'."
        )
