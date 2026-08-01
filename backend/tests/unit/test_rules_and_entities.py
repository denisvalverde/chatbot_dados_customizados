"""Regras deterministicas, extracao de entidades e redaction."""

from __future__ import annotations

from app.domain.enums import Category, Severity
from app.services.entity_extraction import extract_entities
from app.services.redaction import redact
from app.services.rules import classify_by_rules


class TestRules:
    def test_raid_degraded(self) -> None:
        result = classify_by_rules("virtual disk degraded na controladora megaraid, rebuild lento")
        assert result.category == Category.RAID
        assert result.severity == Severity.ALTA
        assert result.confidence > 0.5

    def test_ddos_critico(self) -> None:
        result = classify_by_rules("ataque ddos volumetrico em andamento contra o ip do cliente")
        assert result.category == Category.DDOS
        assert result.severity == Severity.CRITICA
        assert result.team.value == "seguranca"

    def test_object_storage(self) -> None:
        result = classify_by_rules("uploads multipart no bucket falham com 429 slowdown no endpoint s3")
        assert result.category == Category.OBJECT_STORAGE
        assert result.subcategory == "rate_limiting"

    def test_texto_sem_sinal_vira_duvida(self) -> None:
        result = classify_by_rules("bom dia tudo bem com voces")
        assert result.category == Category.DUVIDA_TECNICA
        assert result.confidence <= 0.3


class TestEntities:
    def test_extrai_ips_hosts_erros(self) -> None:
        text = (
            "chamado 123456: servidor srv-db02 (10.20.30.40) na vlan 120 retorna "
            "erro http 503 desde 2025-01-10 14:30. disco /dev/sdb com i/o error. "
            "raid 5 degraded. bucket backup-cliente executou aws s3 ls"
        )
        entities = extract_entities(text)
        assert "123456" in entities.numeros_chamado
        assert "10.20.30.40" in entities.ips
        assert "120" in entities.vlans
        assert 503 in entities.erros_http
        assert "/dev/sdb" in entities.discos
        assert "RAID 5" in entities.raids
        assert any("aws s3 ls" in c for c in entities.comandos)

    def test_cidr_nao_duplica_ip(self) -> None:
        entities = extract_entities("bloco 203.0.113.0/24 anunciado")
        assert "203.0.113.0/24" in entities.blocos_ip
        assert "203.0.113.0" not in entities.ips


class TestRedaction:
    def test_mascara_segredos(self) -> None:
        text = (
            "password=SuperSecreta123 AKIAIOSFODNN7EXAMPLE "
            "Authorization: Bearer abc.def.ghi contato@empresa.com.br"
        )
        result = redact(text)
        assert "SuperSecreta123" not in result.text
        assert "AKIAIOSFODNN7EXAMPLE" not in result.text
        assert "contato@empresa.com.br" not in result.text
        assert result.had_secrets

    def test_ip_preservado_por_padrao(self) -> None:
        result = redact("servidor 10.0.0.1 sem resposta")
        assert "10.0.0.1" in result.text
        assert redact("servidor 10.0.0.1", mask_ips=True).text.count("10.0.0.1") == 0
