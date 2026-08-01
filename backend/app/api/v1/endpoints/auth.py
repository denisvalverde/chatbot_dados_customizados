"""Autenticacao: login com JWT."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import audit, get_db_session
from app.core.exceptions import AuthenticationError
from app.core.security import create_access_token, verify_password
from app.infrastructure.repositories import UserRepository
from app.schemas.api import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db_session)) -> TokenResponse:
    """Autentica por email/senha e emite JWT."""
    user = UserRepository(db).get_by_email(payload.email)
    if user is None or not user.is_active or not verify_password(
        payload.password, user.password_hash
    ):
        raise AuthenticationError("Email ou senha invalidos.")
    audit(db, None, "auth.login", resource=user.email)
    return TokenResponse(
        access_token=create_access_token(user.id, user.email, user.role),
        role=user.role,
        email=user.email,
    )
