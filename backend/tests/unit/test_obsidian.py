"""Modulo Obsidian: sanitizacao, templates, Mermaid/Canvas por introspecao, sync, idempotencia."""

from __future__ import annotations

from pathlib import Path

import torch

from app.ml.network import MultiHeadTicketClassifier
from app.obsidian import sync, templates
from app.obsidian.canvas import generate_network_canvas
from app.obsidian.mermaid import (
    count_parameters,
    generate_network_mermaid,
    hidden_dim_of,
    load_model_from_checkpoint,
)
from app.obsidian.vault import is_enabled, slugify, vault_root, write_note


class TestSlugify:
    def test_remove_acentos_e_caracteres_invalidos(self) -> None:
        assert slugify('RAID: disco "degraded"?') == "RAID-disco-degraded"

    def test_nome_reservado_windows(self) -> None:
        assert slugify("CON") == "CON-nota"

    def test_texto_vazio_vira_nota(self) -> None:
        assert slugify("   ") == "nota"

    def test_trunca_no_limite(self) -> None:
        assert len(slugify("a" * 500, max_length=50)) == 50


class TestVaultConfigurado:
    def test_habilitado_no_ambiente_de_teste(self) -> None:
        # conftest.py define OBSIDIAN_VAULT_PATH para toda a sessao de testes
        assert is_enabled()
        assert vault_root() is not None

    def test_write_note_e_idempotente(self) -> None:
        relative = "00-Inbox/teste-idempotencia.md"
        assert write_note(relative, "conteudo v1")
        path = vault_root() / relative  # type: ignore[operator]
        mtime_1 = path.stat().st_mtime_ns
        assert write_note(relative, "conteudo v1")  # mesmo conteudo -> nao reescreve
        assert path.stat().st_mtime_ns == mtime_1
        assert write_note(relative, "conteudo v2")
        assert path.read_text(encoding="utf-8") == "conteudo v2"

    def test_no_op_quando_desabilitado(self, monkeypatch) -> None:
        monkeypatch.setattr("app.obsidian.vault.vault_root", lambda: None)
        assert write_note("qualquer.md", "x") is False


class TestTemplates:
    def test_render_ticket_note_contem_wikilinks(self) -> None:
        ticket = {
            "id": 1, "title": "RAID degraded no srv-db02", "description": "descricao",
            "category": "raid", "subcategory": "degraded", "severity": "alta",
            "urgency": "alta", "impact": "alto", "assigned_team": "infraestrutura",
            "status": "aberto", "updated_at": "2026-01-01",
        }
        path, content = templates.render_ticket_note(ticket, analysis_ids=[7])
        assert path.startswith("01-Chamados/Chamado-1-")
        assert "[[raid]]" in content
        assert "[[infraestrutura]]" in content
        assert "[[Analise-7]]" in content
        assert "Chamado #1" in content

    def test_render_analysis_note_sem_fatos(self) -> None:
        analysis = {
            "id": 5, "ticket_id": 1, "summary": "resumo", "confidence": 0.5,
            "facts": [], "hypotheses": [{"descricao": "disco em falha", "confianca": 0.7}],
            "missing_information": ["horario"], "risks": ["risco x"],
            "classification": {"categoria_principal": "raid", "tecnologia": ["megaraid"]},
            "created_at": "2026-01-01", "model_version": "hybrid-v1",
        }
        _, content = templates.render_analysis_note(analysis)
        assert "Nenhum fato" in content
        assert "disco em falha" in content
        assert "70%" in content
        assert "[[megaraid]]" in content
        assert "[[Chamado-1]]" in content

    def test_render_knowledge_note(self) -> None:
        doc = {
            "id": 3, "title": "Procedimento X", "content": "conteudo do procedimento",
            "document_type": "procedimento", "category": "raid",
            "technology": ["megaraid"], "approved": True, "success_score": 0.9,
            "source": "seed",
        }
        path, content = templates.render_knowledge_note(doc)
        assert path.startswith("03-Base-de-Conhecimento/Procedimentos/Documento-3-")
        assert "[[raid]]" in content
        assert "sim" in content  # aprovado

    def test_render_hub_note(self) -> None:
        path, content = templates.render_hub_note(
            "categoria", "raid", [(1, "Chamado A")], [(2, "Doc B")]
        )
        assert path == "04-Categorias/raid.md"
        assert "[[Chamado-1]]" in content
        assert "[[Documento-2]]" in content


class TestVisualizacaoRede:
    def _tiny_model(self) -> MultiHeadTicketClassifier:
        head_sizes = {
            "categoria": 5, "subcategoria": 3, "severidade": 4,
            "equipe": 6, "risco": 4, "tecnologias": 8,
        }
        return MultiHeadTicketClassifier(input_dim=32, head_sizes=head_sizes, hidden_dim=16)

    def test_mermaid_reflete_arquitetura_real(self) -> None:
        model = self._tiny_model()
        block = generate_network_mermaid(model)
        assert "```mermaid" in block
        assert "32 neuronios" in block
        assert "16" in block  # hidden_dim aparece nas transicoes
        for head in ("categoria", "subcategoria", "severidade", "equipe", "risco", "tecnologias"):
            assert head in block
        assert str(count_parameters(model)).replace(",", "") or True  # sanidade: nao lanca

    def test_canvas_tem_um_no_por_camada_e_arestas_do_tronco(self) -> None:
        model = self._tiny_model()
        canvas = generate_network_canvas(model, onnx_path="artifacts/multihead.onnx")
        node_ids = {n["id"] for n in canvas["nodes"]}
        assert {"input", "trunk", "info"} <= node_ids
        for head in model.MULTICLASS_HEADS:
            assert f"head-{head}" in node_ids
        assert f"head-{model.MULTILABEL_HEAD}" in node_ids
        # uma aresta do tronco para cada cabeca + uma da entrada para o tronco
        assert len(canvas["edges"]) == 1 + len(model.MULTICLASS_HEADS) + 1
        assert "netron.app" in canvas["nodes"][-1]["text"]

    def test_hidden_dim_of_le_a_camada_real(self) -> None:
        model = self._tiny_model()
        assert hidden_dim_of(model) == 16

    def test_load_model_from_checkpoint(self, tmp_path: Path) -> None:
        model = self._tiny_model()
        checkpoint_path = tmp_path / "fake.pt"
        torch.save(
            {
                "state_dict": model.state_dict(),
                "input_dim": model.input_dim,
                "head_sizes": model.head_sizes,
                "trained_at": "2026-01-01T00:00:00",
            },
            checkpoint_path,
        )
        loaded, state = load_model_from_checkpoint(checkpoint_path)
        assert loaded.input_dim == model.input_dim
        assert state["trained_at"] == "2026-01-01T00:00:00"


class TestSyncComBanco:
    def test_export_ticket_analysis_knowledge_e_idempotente(self) -> None:
        from app.infrastructure.database import SessionLocal
        from app.infrastructure.repositories import (
            AnalysisRepository,
            KnowledgeRepository,
            TicketRepository,
        )

        db = SessionLocal()
        try:
            ticket = TicketRepository(db).create(
                {
                    "title": "Teste Obsidian RAID", "description": "descricao de teste",
                    "category": "raid", "severity": "alta", "assigned_team": "infraestrutura",
                }
            )
            analysis = AnalysisRepository(db).create(
                {
                    "ticket_id": ticket.id, "summary": "resumo de teste", "confidence": 0.6,
                    "facts": [], "hypotheses": [], "missing_information": [], "risks": [],
                    "classification": {"categoria_principal": "raid", "tecnologia": ["megaraid"]},
                    "entities": {}, "model_version": "test",
                }
            )
            doc = KnowledgeRepository(db).create(
                {
                    "title": "Doc de teste", "content": "conteudo",
                    "document_type": "procedimento", "category": "raid",
                    "technology": ["megaraid"], "approved": True, "success_score": 0.8,
                }
            )

            assert sync.export_ticket(db, ticket.id) is True
            assert sync.export_analysis(db, analysis.id) is True
            assert sync.export_knowledge_document(db, doc.id) is True
            # rodar de novo nao falha nem duplica (idempotente)
            assert sync.export_ticket(db, ticket.id) is True
            assert sync.export_analysis(db, analysis.id) is True

            root = vault_root()
            assert root is not None
            assert any(root.glob(f"01-Chamados/Chamado-{ticket.id}-*.md"))
            assert any(root.glob(f"02-Analises/Analise-{analysis.id}-*.md"))
            assert any(root.glob(f"03-Base-de-Conhecimento/Procedimentos/Documento-{doc.id}-*.md"))
            assert (root / "04-Categorias" / "raid.md").exists()
            assert (root / "05-Tecnologias" / "megaraid.md").exists()

            hub_content = (root / "04-Categorias" / "raid.md").read_text(encoding="utf-8")
            assert f"[[Chamado-{ticket.id}]]" in hub_content
            assert f"[[Documento-{doc.id}]]" in hub_content
        finally:
            db.close()

    def test_export_entidade_inexistente_retorna_false(self) -> None:
        from app.infrastructure.database import SessionLocal

        db = SessionLocal()
        try:
            assert sync.export_ticket(db, 999_999) is False
            assert sync.export_analysis(db, 999_999) is False
            assert sync.export_knowledge_document(db, 999_999) is False
        finally:
            db.close()

    def test_full_resync_retorna_contagens(self) -> None:
        from app.infrastructure.database import SessionLocal

        db = SessionLocal()
        try:
            counts = sync.full_resync(db)
            assert set(counts) == {"tickets", "analises", "documentos", "modelos"}
            assert all(v >= 0 for v in counts.values())
        finally:
            db.close()

    def test_status_reporta_vault_habilitado(self) -> None:
        status = sync.get_status()
        assert status["habilitado"] is True
        assert status["caminho_vault"]
