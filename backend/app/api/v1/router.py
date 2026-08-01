"""Agregador de rotas da API v1."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import ai, auth, feedback, knowledge, models, tickets

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(tickets.router)
api_router.include_router(ai.router)
api_router.include_router(knowledge.router)
api_router.include_router(feedback.router)
api_router.include_router(models.router)
