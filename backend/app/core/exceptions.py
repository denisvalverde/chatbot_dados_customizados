"""Excecoes de dominio da plataforma."""

from __future__ import annotations


class PlatformError(Exception):
    """Erro base da plataforma."""

    status_code: int = 500
    detail: str = "Erro interno."

    def __init__(self, detail: str | None = None) -> None:
        if detail:
            self.detail = detail
        super().__init__(self.detail)


class NotFoundError(PlatformError):
    status_code = 404
    detail = "Recurso nao encontrado."


class ValidationFailedError(PlatformError):
    status_code = 422
    detail = "Dados de entrada invalidos."


class AuthenticationError(PlatformError):
    status_code = 401
    detail = "Credenciais invalidas ou token ausente/expirado."


class PermissionDeniedError(PlatformError):
    status_code = 403
    detail = "Permissao insuficiente para esta operacao."


class RateLimitedError(PlatformError):
    status_code = 429
    detail = "Limite de requisicoes excedido. Tente novamente em instantes."


class ProviderError(PlatformError):
    status_code = 502
    detail = "Falha ao acionar provedor externo."


class ModelNotReadyError(PlatformError):
    status_code = 503
    detail = "Modelo de ML ainda nao treinado/carregado. Baseline deterministico em uso."
