"""Motor de analise (anti-alucinacao) e catalogo de comandos."""

from __future__ import annotations

from app.domain.enums import Audience, MessageKind
from app.services.analysis import analyze
from app.services.commands import generate_commands, is_destructive
from app.services.communication import CommunicationRequest, generate_message
from app.services.entity_extraction import extract_entities


def _classification(category: str = "raid", severity: str = "alta") -> dict:
    return {
        "categoria_principal": category,
        "subcategoria": "degraded",
        "severidade": severity,
        "equipe_recomendada": "infraestrutura",
        "confianca": 0.8,
    }


class TestAnalysis:
    def test_sem_evidencia_nao_afirma_causa(self) -> None:
        text = "raid degraded no servidor"
        result = analyze(text, _classification(), extract_entities(text), evidences=[])
        assert result["fatos_confirmados"] == []
        assert "NAO confirmada" in result["resumo_executivo"]
        assert result["confianca_global"] <= 0.55
        assert any("Evidencia objetiva" in m for m in result["informacoes_ausentes"])

    def test_evidencia_objetiva_vira_fato(self) -> None:
        text = "raid degraded no srv-db02"
        evidences = [{"type": "saida_comando", "content": "VD0 Dgrd, PD 252:4 Flt"}]
        result = analyze(text, _classification(), extract_entities(text), evidences)
        assert len(result["fatos_confirmados"]) == 1
        assert result["hipoteses"][0]["confianca"] <= 0.85

    def test_critico_escalona(self) -> None:
        result = analyze(
            "producao parada", _classification(severity="critica"),
            extract_entities("producao parada"), [],
        )
        assert result["necessita_escalonamento"] is True


class TestCommands:
    def test_catalogo_somente_leitura(self) -> None:
        for category in ("raid", "hardware", "rede", "object_storage", "virtualizacao"):
            result = generate_commands(category)
            assert result["comandos"], category
            for command in result["comandos"]:
                assert command["risco"] in {"leitura", "diagnostico"}
                assert not is_destructive(command["comando"]), command["comando"]

    def test_detector_destrutivo(self) -> None:
        assert is_destructive("rm -rf /data")
        assert is_destructive("qm destroy 104")
        assert not is_destructive("qm status 104")

    def test_fallback_categoria_desconhecida(self) -> None:
        assert generate_commands("categoria_inexistente")["comandos"]


class TestCommunication:
    def test_gmud_tem_rollback(self) -> None:
        message = generate_message(
            CommunicationRequest(kind=MessageKind.GMUD, summary="troca de disco")
        )
        assert "ROLLBACK" in message["corpo"]
        assert "Backup validado" in message["corpo"]

    def test_rca_sem_fatos_nao_afirma_causa(self) -> None:
        message = generate_message(CommunicationRequest(kind=MessageKind.RCA, summary="x"))
        assert "NAO afirma causa raiz" in message["corpo"]

    def test_publicos_diferentes(self) -> None:
        for audience in Audience:
            message = generate_message(
                CommunicationRequest(
                    kind=MessageKind.RESPOSTA_INICIAL, audience=audience,
                    customer="ACME", subject="teste",
                )
            )
            assert message["corpo"]
            assert message["publico"] == audience.value
