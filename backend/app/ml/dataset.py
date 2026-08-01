"""Esquema do dataset, importacao e gerador sintetico (secao 4.2).

ATENCAO: o gerador abaixo produz dados SINTETICOS, claramente identificados
no arquivo gerado (campo "origem": "sintetico"). Ele existe apenas para
viabilizar o pipeline ponta a ponta. Um modelo treinado somente com estes
dados NAO deve ser tratado como modelo de producao — o baseline
deterministico (rules.py) permanece ativo ate haver volume real.

Esquema JSONL (uma linha por exemplo):
{
  "texto": str,               # obrigatorio
  "categoria": str,           # obrigatorio (enum Category)
  "subcategoria": str,        # opcional (default "outro")
  "severidade": str,          # opcional (enum Severity, default "media")
  "equipe": str,              # opcional (enum Team; default roteamento da categoria)
  "risco": str,               # opcional (enum Risk, default "medio")
  "tecnologias": [str],       # opcional (subset de TECHNOLOGIES)
  "origem": str               # "real" | "sintetico"
}
"""

from __future__ import annotations

import json
import random
from pathlib import Path

from pydantic import BaseModel, Field, field_validator

from app.domain.enums import (
    SUBCATEGORIES,
    TECHNOLOGIES,
    Category,
    Risk,
    Severity,
    Team,
)
from app.services.rules import TEAM_BY_CATEGORY


class DatasetExample(BaseModel):
    """Um exemplo validado do dataset."""

    texto: str = Field(min_length=10)
    categoria: Category
    subcategoria: str = "outro"
    severidade: Severity = Severity.MEDIA
    equipe: Team | None = None
    risco: Risk = Risk.MEDIO
    tecnologias: list[str] = Field(default_factory=list)
    origem: str = "real"

    @field_validator("tecnologias")
    @classmethod
    def _known_tech(cls, value: list[str]) -> list[str]:
        unknown = [t for t in value if t not in TECHNOLOGIES]
        if unknown:
            raise ValueError(f"Tecnologias desconhecidas: {unknown}")
        return value

    def resolved_team(self) -> Team:
        return self.equipe or TEAM_BY_CATEGORY[self.categoria]


def load_dataset(path: str | Path) -> list[DatasetExample]:
    """Le e valida um dataset JSONL. Linhas invalidas geram erro explicito."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset nao encontrado: {path}. Gere o sintetico com "
            "'python scripts/build_dataset.py' ou importe dados reais."
        )
    examples: list[DatasetExample] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            line = line.strip()
            if not line:
                continue
            try:
                examples.append(DatasetExample(**json.loads(line)))
            except Exception as exc:
                raise ValueError(f"Linha {line_number} invalida em {path}: {exc}") from exc
    return examples


# ----------------------------------------------------------------------------
# Gerador sintetico (claramente identificado)
# ----------------------------------------------------------------------------

_TEMPLATES: dict[Category, list[tuple[str, str, Severity, Risk, list[str]]]] = {
    # (texto, subcategoria, severidade, risco, tecnologias)
    Category.HARDWARE: [
        ("servidor {host} desligou sozinho, ilo mostra evento de fonte redundante em falha", "fonte", Severity.ALTA, Risk.ALTO, ["ilo", "hpe_proliant"]),
        ("idrac reporta ventilador fan3 em estado critico no {host}", "ventilador", Severity.MEDIA, Risk.MEDIO, ["idrac", "dell_poweredge"]),
        ("temperatura do chassi acima de 75 graus, sensores em alerta no servidor {host}", "sensor_temperatura", Severity.ALTA, Risk.ALTO, ["ipmi"]),
        ("erros de memoria ecc corrigiveis crescendo no dimm b2 do {host}", "memoria", Severity.MEDIA, Risk.MEDIO, ["idrac"]),
        ("apos atualizacao de firmware o servidor {host} nao passa do post", "firmware", Severity.CRITICA, Risk.CRITICO, ["hpe_proliant", "ilo"]),
        ("servidor {host} reiniciou de forma inesperada duas vezes hoje, sel registra mce", "reinicializacao_inesperada", Severity.ALTA, Risk.ALTO, ["ipmi"]),
    ],
    Category.RAID: [
        ("virtual disk em estado degraded na controladora megaraid do {host}", "degraded", Severity.ALTA, Risk.ALTO, ["megaraid"]),
        ("rebuild do raid 5 esta ha 12 horas em 40 por cento no servidor {host}", "rebuild", Severity.ALTA, Risk.ALTO, ["megaraid"]),
        ("bateria da controladora em falha e cache em writethrough no {host}", "bateria_cache", Severity.MEDIA, Risk.MEDIO, ["megaraid"]),
        ("dois discos marcados como failed no backplane do {host}, raid 10", "cabo_backplane", Severity.CRITICA, Risk.CRITICO, ["megaraid", "sas"]),
    ],
    Category.STORAGE: [
        ("smart do disco /dev/sdb indica predictive failure no {host}", "smart_predictive", Severity.ALTA, Risk.ALTO, ["ssd", "sas"]),
        ("latencia de escrita acima de 200ms no nvme do servidor {host}", "latencia_io", Severity.MEDIA, Risk.MEDIO, ["nvme"]),
        ("i/o error no dmesg ao acessar /dev/sdc, aplicacao caindo no {host}", "disco_hdd", Severity.ALTA, Risk.ALTO, ["hdd"]),
        ("iops muito abaixo do esperado apos troca de disco no {host}", "saturacao", Severity.MEDIA, Risk.MEDIO, ["ssd"]),
    ],
    Category.REDE: [
        ("perda de pacotes intermitente de 15 por cento entre {host} e o gateway", "perda_pacotes", Severity.ALTA, Risk.MEDIO, ["vlan"]),
        ("vlan 120 sem comunicacao apos manutencao no switch do rack", "vlan", Severity.ALTA, Risk.ALTO, ["vlan"]),
        ("resolucao dns falhando para dominios externos no servidor {host}", "dns", Severity.MEDIA, Risk.MEDIO, ["dns"]),
        ("mtu incorreta causando fragmentacao no tunel entre datacenters", "mtu", Severity.MEDIA, Risk.MEDIO, []),
        ("latencia alta e jitter nas videoconferencias a partir da vlan 30", "latencia", Severity.MEDIA, Risk.BAIXO, ["vlan"]),
    ],
    Category.SEGURANCA: [
        ("regra de firewall bloqueando porta 443 para o bloco 203.0.113.0/24 no pfsense", "firewall", Severity.MEDIA, Risk.MEDIO, ["pfsense"]),
        ("vpn ipsec com fortigate nao estabelece fase 2 desde ontem", "vpn", Severity.ALTA, Risk.MEDIO, ["fortigate", "vpn"]),
        ("tentativas de forca bruta ssh no {host}, solicito bloqueio e analise", "bloqueio", Severity.ALTA, Risk.ALTO, []),
    ],
    Category.DDOS: [
        ("ataque ddos volumetrico em andamento contra o ip do cliente, 40gbps", "ataque_em_andamento", Severity.CRITICA, Risk.CRITICO, []),
        ("solicito ativacao de mitigacao ddos para o bloco do cliente apos alerta", "mitigacao", Severity.CRITICA, Risk.ALTO, []),
        ("pos ataque ddos, validar se o trafego normalizou e gerar relatorio", "pos_ataque", Severity.MEDIA, Risk.MEDIO, []),
    ],
    Category.VIRTUALIZACAO: [
        ("vm 104 nao inicia no proxmox, erro de storage lvm indisponivel", "vm_nao_inicia", Severity.ALTA, Risk.ALTO, ["proxmox", "kvm"]),
        ("migracao de vm entre nos do cluster proxmox falha em 80 por cento", "migracao", Severity.MEDIA, Risk.MEDIO, ["proxmox"]),
        ("snapshot antigo consumindo espaco e travando backup da vm 210", "snapshot", Severity.MEDIA, Risk.MEDIO, ["proxmox"]),
        ("cluster vmware perdeu ha apos queda de um host esxi", "cluster_ha", Severity.ALTA, Risk.ALTO, ["vmware"]),
        ("virsh list mostra dominio pausado e nao consigo retomar no kvm", "kvm_qemu", Severity.MEDIA, Risk.MEDIO, ["kvm", "libvirt"]),
    ],
    Category.SISTEMA_OPERACIONAL: [
        ("almalinux 9 travando no boot apos update de kernel no {host}", "kernel", Severity.ALTA, Risk.ALTO, ["almalinux"]),
        ("filesystem raiz montado somente leitura apos queda de energia no {host}", "filesystem", Severity.CRITICA, Risk.CRITICO, ["ubuntu"]),
        ("servico systemd do nginx em failed apos reboot no {host}", "servico", Severity.MEDIA, Risk.MEDIO, ["systemd"]),
        ("windows server 2019 com update travado em 30 por cento no {host}", "pacotes", Severity.MEDIA, Risk.MEDIO, ["windows_server"]),
    ],
    Category.BANCO_DE_DADOS: [
        ("postgresql recusando conexoes, max_connections atingido no {host}", "conexao", Severity.ALTA, Risk.ALTO, ["postgresql"]),
        ("query lenta apos crescimento da tabela de pedidos no mysql", "performance", Severity.MEDIA, Risk.MEDIO, ["mysql"]),
        ("replicacao do postgres com lag de 4 horas no standby", "performance", Severity.ALTA, Risk.ALTO, ["postgresql"]),
    ],
    Category.OBJECT_STORAGE: [
        ("uploads multipart falhando com http 500 no endpoint s3 do cliente", "upload_multipart", Severity.ALTA, Risk.MEDIO, ["s3"]),
        ("aws cli retorna 403 forbidden ao listar bucket {bucket}", "credenciais_s3", Severity.MEDIA, Risk.BAIXO, ["s3", "aws_cli"]),
        ("erros 429 slowdown ao gravar objetos no bucket {bucket} via rclone", "rate_limiting", Severity.MEDIA, Risk.MEDIO, ["s3", "rclone"]),
        ("listagem de bucket com milhoes de delete markers esta lentissima", "listagem", Severity.MEDIA, Risk.MEDIO, ["s3"]),
        ("quota de object storage excedida, gravacoes retornando 403", "quota", Severity.ALTA, Risk.MEDIO, ["s3"]),
    ],
    Category.BACKUP: [
        ("job de backup do pbs falha com timeout ao conectar no datastore", "pbs", Severity.ALTA, Risk.ALTO, ["pbs"]),
        ("restore de vm pelo proxmox backup server esta corrompido", "falha_restore", Severity.CRITICA, Risk.CRITICO, ["pbs", "proxmox"]),
        ("acronis reporta falha de verificacao de integridade no plano diario", "acronis", Severity.MEDIA, Risk.MEDIO, ["acronis"]),
        ("garbage collection do pbs nao libera espaco apos prune", "prune_gc", Severity.MEDIA, Risk.MEDIO, ["pbs"]),
    ],
    Category.PERFORMANCE: [
        ("load average de 40 em servidor de 8 nucleos, aplicacao lenta no {host}", "cpu", Severity.ALTA, Risk.MEDIO, []),
        ("consumo de memoria em 95 por cento com swap constante no {host}", "memoria", Severity.MEDIA, Risk.MEDIO, []),
        ("gargalo de i/o durante janela de backup deixa aplicacao inutilizavel", "io", Severity.ALTA, Risk.MEDIO, []),
    ],
    Category.ACESSO: [
        ("perdi acesso ssh ao servidor {host}, chave recusada", "chave_ssh", Severity.MEDIA, Risk.BAIXO, []),
        ("usuario bloqueado apos tentativas de senha no painel do cliente", "login", Severity.BAIXA, Risk.BAIXO, []),
        ("preciso de acesso ao console ilo do servidor {host}", "console", Severity.BAIXA, Risk.BAIXO, ["ilo"]),
    ],
    Category.LICENCA: [
        ("licenca do windows server expirou e o servidor exibe aviso", "expiracao", Severity.MEDIA, Risk.BAIXO, ["windows_server"]),
        ("erro de ativacao de licenca do cpanel apos migracao", "ativacao", Severity.MEDIA, Risk.BAIXO, []),
    ],
    Category.INDISPONIBILIDADE: [
        ("servidor {host} totalmente fora do ar, nao responde ping nem console", "total", Severity.CRITICA, Risk.CRITICO, []),
        ("site do cliente intermitente, oscilando a cada poucos minutos", "intermitente", Severity.ALTA, Risk.ALTO, []),
        ("apenas o servico de email esta indisponivel, web segue ok", "parcial", Severity.MEDIA, Risk.MEDIO, []),
    ],
    Category.MUDANCA: [
        ("solicito gmud para troca de disco no raid do servidor {host}", "gmud", Severity.MEDIA, Risk.ALTO, ["megaraid"]),
        ("agendar janela de manutencao para atualizacao de firmware", "janela", Severity.BAIXA, Risk.MEDIO, []),
        ("necessario rollback da mudanca de ontem que afetou a rede", "rollback", Severity.ALTA, Risk.ALTO, []),
    ],
    Category.CONFIGURACAO: [
        ("configurar novo vhost e certificado ssl no servidor {host}", "solicitacao", Severity.BAIXA, Risk.BAIXO, []),
        ("revisar configuracao de sysctl para melhorar rede do {host}", "revisao", Severity.BAIXA, Risk.MEDIO, []),
    ],
    Category.FALHA_APLICACAO: [
        ("aplicacao do cliente retorna erro 500 apos deploy, logs mostram exception", "erro", Severity.ALTA, Risk.MEDIO, []),
        ("processo da aplicacao crasha a cada 2 horas com segfault", "crash", Severity.ALTA, Risk.MEDIO, []),
    ],
    Category.PROBLEMA_CLIENTE: [
        ("cliente alterou configuracao por conta propria e o servico parou", "ambiente_cliente", Severity.MEDIA, Risk.MEDIO, []),
        ("script do proprio cliente consumindo toda a cpu do servidor", "uso_incorreto", Severity.MEDIA, Risk.BAIXO, []),
    ],
    Category.NECESSIDADE_ENGENHARIA: [
        ("necessaria analise de engenharia para recorrencia de erros no storage central", "analise_avancada", Severity.ALTA, Risk.ALTO, []),
    ],
    Category.NECESSIDADE_INFRAESTRUTURA: [
        ("necessaria intervencao fisica no datacenter para troca de cabo sas", "intervencao_fisica", Severity.MEDIA, Risk.MEDIO, ["sas"]),
    ],
    Category.NECESSIDADE_DESENVOLVIMENTO: [
        ("bug no painel interno exige correcao de codigo pela equipe de desenvolvimento", "correcao_codigo", Severity.MEDIA, Risk.BAIXO, []),
    ],
    Category.DUVIDA_TECNICA: [
        ("duvida sobre como configurar backup incremental no pbs", "como_fazer", Severity.BAIXA, Risk.BAIXO, ["pbs"]),
        ("quais as boas praticas de raid para banco de dados com muita escrita", "boas_praticas", Severity.BAIXA, Risk.BAIXO, ["megaraid"]),
        ("como faco para aumentar o disco de uma vm no proxmox", "como_fazer", Severity.BAIXA, Risk.BAIXO, ["proxmox"]),
    ],
}

_HOSTS = ["srv-web01", "srv-db02", "hv-node03", "bkp-srv01", "app-srv07", "px-node02"]
_BUCKETS = ["backup-cliente-a", "midia-prod", "logs-centrais"]
_PREFIX = ["", "urgente: ", "bom dia, ", "boa tarde, ", "cliente informa: ", "monitoramento alertou: "]
_SUFFIX = ["", " favor verificar", " aguardo retorno", " impacto em producao", " sem alteracao recente conhecida"]


def generate_synthetic_dataset(rows: int = 1500, seed: int = 42) -> list[DatasetExample]:
    """Gera exemplos SINTETICOS (origem='sintetico') a partir dos templates."""
    rng = random.Random(seed)
    categories = list(_TEMPLATES.keys())
    examples: list[DatasetExample] = []
    for _ in range(rows):
        category = rng.choice(categories)
        texto, sub, sev, risk, techs = rng.choice(_TEMPLATES[category])
        texto = texto.replace("{host}", rng.choice(_HOSTS)).replace("{bucket}", rng.choice(_BUCKETS))
        texto = rng.choice(_PREFIX) + texto + rng.choice(_SUFFIX)
        examples.append(
            DatasetExample(
                texto=texto,
                categoria=category,
                subcategoria=sub,
                severidade=sev,
                risco=risk,
                tecnologias=techs,
                origem="sintetico",
            )
        )
    return examples


def save_dataset(examples: list[DatasetExample], path: str | Path) -> None:
    """Persiste o dataset em JSONL."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for example in examples:
            handle.write(json.dumps(example.model_dump(mode="json"), ensure_ascii=False) + "\n")


# Vocabularios de rotulos (ordem estavel para as cabecas da rede)
def label_vocabularies() -> dict[str, list[str]]:
    """Listas ordenadas de rotulos por cabeca."""
    all_subs = sorted({s for subs in SUBCATEGORIES.values() for s in subs})
    return {
        "categoria": [c.value for c in Category],
        "subcategoria": all_subs,
        "severidade": [s.value for s in Severity],
        "equipe": [t.value for t in Team],
        "risco": [r.value for r in Risk],
        "tecnologias": list(TECHNOLOGIES),
    }
