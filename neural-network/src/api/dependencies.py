"""Dependencias da API: acesso ao Predictor carregado na inicializacao."""

from __future__ import annotations

from fastapi import HTTPException, Request, status

from src.inference.predictor import Predictor


def get_predictor(request: Request) -> Predictor:
    """Retorna o Predictor do estado da aplicacao (carregado no startup)."""
    predictor: Predictor | None = getattr(request.app.state, "predictor", None)
    if predictor is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Modelo nao carregado. Treine o modelo e reinicie a API.",
        )
    return predictor
