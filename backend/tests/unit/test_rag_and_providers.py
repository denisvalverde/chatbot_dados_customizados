"""Embeddings, vector store, reranking e provedores LLM."""

from __future__ import annotations

import numpy as np
import pytest

from app.infrastructure.database import SessionLocal
from app.infrastructure.embeddings import LocalHashingEmbedder
from app.infrastructure.llm import (
    GenerationRequest,
    LocalLLMProvider,
    MockProvider,
)
from app.services.rag import ingest_document, search_knowledge


class TestEmbeddings:
    def test_deterministico_e_normalizado(self) -> None:
        embedder = LocalHashingEmbedder(dim=128)
        first = embedder.embed(["raid degraded no servidor"])
        second = embedder.embed(["raid degraded no servidor"])
        np.testing.assert_allclose(first, second)
        assert first.shape == (1, 128)
        assert abs(np.linalg.norm(first[0]) - 1.0) < 1e-5

    def test_similaridade_relativa(self) -> None:
        embedder = LocalHashingEmbedder(dim=384)
        vectors = embedder.embed(
            [
                "disco degraded no raid da controladora",
                "raid com disco em falha degraded",
                "fatura de cobranca duplicada no financeiro",
            ]
        )
        sim_related = float(vectors[0] @ vectors[1])
        sim_unrelated = float(vectors[0] @ vectors[2])
        assert sim_related > sim_unrelated


class TestRagSearch:
    def test_ingest_e_busca(self) -> None:
        db = SessionLocal()
        try:
            ingest_document(
                db, title="Procedimento rebuild RAID",
                content="acompanhar rebuild com storcli e validar bbu",
                document_type="procedimento", category="raid",
                technology=["megaraid"], approved=True, success_score=0.9,
            )
            ingest_document(
                db, title="Erros 429 no S3",
                content="reduzir concorrencia do rclone resolve slowdown",
                document_type="chamado_resolvido", category="object_storage",
                technology=["s3"], approved=True, success_score=0.8,
            )
            results = search_knowledge(db, "rebuild do raid parado", limit=2)
            assert results
            assert results[0]["category"] == "raid"
            filtered = search_knowledge(db, "qualquer", category="object_storage")
            assert all(r["category"] == "object_storage" for r in filtered)
        finally:
            db.close()

    def test_redaction_na_ingestao(self) -> None:
        db = SessionLocal()
        try:
            result = ingest_document(
                db, title="Doc com segredo",
                content="password=abc123segredo no host",
                document_type="artigo",
            )
            from app.infrastructure.repositories import KnowledgeRepository

            doc = KnowledgeRepository(db).get(result["id"])
            assert "abc123segredo" not in doc.content
        finally:
            db.close()


class TestLLMProviders:
    @pytest.mark.asyncio
    async def test_local_usa_apenas_contexto(self) -> None:
        provider = LocalLLMProvider()
        response = await provider.generate(
            GenerationRequest(instruction="resuma", context_documents=["doc um", "doc dois"])
        )
        assert response.used_context
        assert "Fonte 1" in response.text

    @pytest.mark.asyncio
    async def test_mock_permitido_apenas_em_teste(self) -> None:
        provider = MockProvider()  # ENVIRONMENT=test no conftest
        response = await provider.generate(GenerationRequest(instruction="x"))
        assert response.provider == "mock"
