"""Dependencias da API: autenticacao, autorizacao e auditoria."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationError
from app.core.logging import request_id_var
from app.core.security import decode_access_token, require_permission
from app.infrastructure.database import get_db
from app.infrastructure.repositories import AuditRepository

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: int
    email: str
    role: str


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    """Extrai e valida o usuario do token JWT."""
    if credentials is None:
        raise AuthenticationError("Token de acesso ausente.")
    payload = decode_access_token(credentials.credentials)
    return CurrentUser(
        id=int(payload["sub"]), email=payload["email"], role=payload["role"]
    )


def require(permission: str):
    """Fabrica de dependencia: exige a permissao informada."""

    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        require_permission(user.role, permission)
        return user

    return dependency


def audit(
    db: Session,
    user: CurrentUser | None,
    action: str,
    resource: str = "",
    detail: dict | None = None,
) -> None:
    """Registra evento de auditoria vinculado ao request atual."""
    AuditRepository(db).log(
        action=action,
        user_email=user.email if user else "",
        resource=resource,
        detail=detail or {},
        request_id=request_id_var.get(),
    )


def get_db_session(db: Session = Depends(get_db)) -> Session:
    """Alias para clareza nos endpoints."""
    return db


def client_ip(request: Request) -> str:
    """IP do cliente respeitando X-Forwarded-For atras do Nginx."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
