"""Testes de API: auth, RBAC, tickets, analise, conhecimento, feedback, infra."""

from __future__ import annotations

from fastapi.testclient import TestClient


class TestInfra:
    def test_health_ready_metrics(self, client: TestClient) -> None:
        assert client.get("/health").json()["status"] == "ok"
        assert client.get("/ready").json()["status"] == "ready"
        assert b"http_requests_total" in client.get("/metrics").content

    def test_ui_servida(self, client: TestClient) -> None:
        response = client.get("/")
        assert response.status_code == 200
        assert "Plataforma IA" in response.text


class TestAuth:
    def test_login_invalido(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "senha-errada"},
        )
        assert response.status_code == 401

    def test_sem_token_401(self, client: TestClient) -> None:
        assert client.get("/api/v1/tickets").status_code == 401

    def test_rbac_viewer_nao_escreve(
        self, client: TestClient, viewer_headers: dict
    ) -> None:
        response = client.post(
            "/api/v1/tickets", headers=viewer_headers,
            json={"title": "titulo valido", "description": "descricao valida"},
        )
        assert response.status_code == 403
        assert client.get("/api/v1/tickets", headers=viewer_headers).status_code == 200


class TestTickets:
    def test_crud_completo(self, client: TestClient, admin_headers: dict) -> None:
        create = client.post(
            "/api/v1/tickets", headers=admin_headers,
            json={
                "title": "RAID degraded no srv-db02",
                "description": "storcli mostra vd degraded e pd failed slot 4 megaraid",
                "customer": "ACME",
                "evidences": [{"type": "saida_comando", "content": "VD0 Dgrd"}],
            },
        )
        assert create.status_code == 201
        body = create.json()
        assert body["category"] == "raid"
        assert body["assigned_team"] == "infraestrutura"
        ticket_id = body["id"]

        detail = client.get(f"/api/v1/tickets/{ticket_id}", headers=admin_headers).json()
        assert len(detail["evidences"]) == 1

        patch = client.patch(
            f"/api/v1/tickets/{ticket_id}", headers=admin_headers,
            json={"status": "resolvido"},
        )
        assert patch.status_code == 200
        assert patch.json()["resolved_at"] is not None

        stats = client.get("/api/v1/tickets/stats", headers=admin_headers).json()
        assert stats["total"] >= 1

    def test_validacao_entrada(self, client: TestClient, admin_headers: dict) -> None:
        response = client.post(
            "/api/v1/tickets", headers=admin_headers, json={"title": "abc"}
        )
        assert response.status_code == 422

    def test_redaction_no_ticket(self, client: TestClient, admin_headers: dict) -> None:
        response = client.post(
            "/api/v1/tickets", headers=admin_headers,
            json={
                "title": "Acesso com segredo exposto",
                "description": "password=minhasenha123 no servidor",
            },
        )
        assert "minhasenha123" not in response.json()["description"]


class TestAI:
    def test_classify_contrato(self, client: TestClient, admin_headers: dict) -> None:
        response = client.post(
            "/api/v1/classify", headers=admin_headers,
            json={"text": "ataque ddos volumetrico contra o ip do cliente"},
        )
        body = response.json()
        for field in (
            "categoria_principal", "subcategoria", "severidade", "urgencia",
            "impacto", "risco", "equipe_recomendada", "confianca",
            "justificativa", "evidencias_utilizadas",
        ):
            assert field in body
        assert body["categoria_principal"] == "ddos"

    def test_analyze_persiste_e_estrutura(
        self, client: TestClient, admin_headers: dict
    ) -> None:
        response = client.post(
            "/api/v1/analyze", headers=admin_headers,
            json={"description": "servidor srv-x 10.1.1.1 fora do ar, ilo reporta fonte em falha"},
        )
        body = response.json()
        assert body["analysis_id"] > 0
        for field in (
            "resumo_executivo", "sintomas", "fatos_confirmados", "hipoteses",
            "informacoes_ausentes", "riscos", "acoes_recomendadas",
            "necessita_escalonamento", "equipe_sugerida", "confianca_global",
        ):
            assert field in body
        assert body["fatos_confirmados"] == []  # sem evidencia objetiva

    def test_extract_entities(self, client: TestClient, admin_headers: dict) -> None:
        response = client.post(
            "/api/v1/extract-entities", headers=admin_headers,
            json={"text": "vlan 200 porta 8080 erro 503 em 10.0.0.9"},
        )
        body = response.json()
        assert "200" in body["vlans"]
        assert 503 in body["erros_http"]

    def test_generate_commands_seguros(
        self, client: TestClient, admin_headers: dict
    ) -> None:
        body = client.post(
            "/api/v1/generate-commands", headers=admin_headers,
            json={"category": "rede"},
        ).json()
        assert body["comandos"]
        assert "politica_seguranca" in body

    def test_generate_response_e_gmud(
        self, client: TestClient, admin_headers: dict
    ) -> None:
        response = client.post(
            "/api/v1/generate-response", headers=admin_headers,
            json={
                "kind": "resposta_inicial", "audience": "cliente_nao_tecnico",
                "customer": "ACME", "subject": "Servidor indisponivel",
            },
        )
        assert "ACME" in response.json()["corpo"]
        gmud = client.post(
            "/api/v1/generate-gmud", headers=admin_headers,
            json={"kind": "gmud", "summary": "troca de disco slot 4"},
        )
        assert "ROLLBACK" in gmud.json()["corpo"]


class TestKnowledgeAndFeedback:
    def test_fluxo_conhecimento(self, client: TestClient, admin_headers: dict) -> None:
        create = client.post(
            "/api/v1/knowledge/documents", headers=admin_headers,
            json={
                "title": "Procedimento teste vlan",
                "content": "verificar configuracao de vlan no switch e no host",
                "document_type": "procedimento", "category": "rede", "approved": True,
            },
        )
        assert create.status_code == 201
        doc_id = create.json()["id"]

        search = client.get(
            "/api/v1/knowledge/search", headers=admin_headers,
            params={"q": "problema de vlan no switch"},
        )
        assert any(r["id"] == doc_id for r in search.json()["results"])

        delete = client.delete(
            f"/api/v1/knowledge/documents/{doc_id}", headers=admin_headers
        )
        assert delete.status_code == 204

    def test_feedback(self, client: TestClient, admin_headers: dict) -> None:
        analysis = client.post(
            "/api/v1/analyze", headers=admin_headers,
            json={"description": "lentidao generalizada no servidor de aplicacao"},
        ).json()
        response = client.post(
            "/api/v1/feedback", headers=admin_headers,
            json={"analysis_id": analysis["analysis_id"], "rating": 5, "accepted": True},
        )
        assert response.status_code == 201
        assert response.json()["taxa_aceitacao"] > 0

    def test_models_endpoints(self, client: TestClient, admin_headers: dict) -> None:
        assert client.get("/api/v1/models", headers=admin_headers).status_code == 200
        active = client.get("/api/v1/models/active", headers=admin_headers).json()
        assert "neural" in active
