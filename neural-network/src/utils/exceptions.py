"""Excecoes especificas do projeto."""

from __future__ import annotations


class ProjectError(Exception):
    """Erro base do projeto."""


class DataValidationError(ProjectError):
    """Dados de entrada nao atendem ao esquema esperado."""


class PreprocessingError(ProjectError):
    """Falha ao ajustar ou aplicar o pipeline de pre-processamento."""


class TrainingError(ProjectError):
    """Falha durante o treinamento (ex.: loss NaN/infinito)."""


class ModelNotFoundError(ProjectError):
    """Artefatos do modelo nao encontrados em disco."""
