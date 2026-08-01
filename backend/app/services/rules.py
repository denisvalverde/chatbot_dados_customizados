"""Classificacao deterministica por regras (baseline sempre disponivel).

Cobre os dominios da secao 2 da especificacao com pontuacao por palavras-chave.
E o primeiro estagio do pipeline hibrido e o fallback quando nao ha modelo
treinado com dados reais.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.domain.enums import Category, Severity, Team

# Palavras-chave por categoria: (termo, peso). Termos compostos pesam mais.
KEYWORDS: dict[Category, list[tuple[str, float]]] = {
    Category.DDOS: [
        ("ddos", 3.0), ("ataque volumetrico", 3.0), ("mitigacao", 1.5),
        ("syn flood", 3.0), ("udp flood", 3.0), ("trafego anomalo", 2.0),
    ],
    Category.RAID: [
        ("raid", 2.5), ("rebuild", 2.5), ("degraded", 2.5), ("virtual disk", 2.0),
        ("physical disk", 2.0), ("megaraid", 2.5), ("storcli", 2.0), ("perccli", 2.0),
        ("controladora", 1.5), ("bateria da controladora", 2.5), ("cache pinned", 3.0),
        ("backplane", 2.0), ("predictive failure", 2.5),
    ],
    Category.STORAGE: [
        ("disco", 1.5), ("ssd", 1.5), ("hdd", 1.5), ("nvme", 2.0), ("smart", 2.0),
        ("i/o error", 2.5), ("io error", 2.5), ("badblocks", 2.5), ("iops", 2.0),
        ("latencia de disco", 2.5), ("fio", 1.0), ("setor defeituoso", 2.5),
        ("throughput", 1.0), ("sas", 1.0), ("sata", 1.0),
    ],
    Category.HARDWARE: [
        ("ilo", 2.5), ("idrac", 2.5), ("ibmc", 2.5), ("ipmi", 2.0), ("bmc", 1.5),
        ("fonte", 1.5), ("ventilador", 2.0), ("fan", 1.5), ("temperatura", 1.5),
        ("sensor", 1.5), ("firmware", 1.5), ("bios", 1.5), ("uefi", 1.5),
        ("proliant", 2.0), ("poweredge", 2.0), ("desligamento inesperado", 2.5),
        ("reinicializacao inesperada", 2.5), ("memoria ecc", 2.5), ("dimm", 2.5),
        ("nao liga", 2.0), ("hardware", 1.5),
    ],
    Category.VIRTUALIZACAO: [
        ("proxmox", 2.5), ("kvm", 2.0), ("qemu", 2.0), ("libvirt", 2.0), ("virsh", 2.0),
        ("vmware", 2.5), ("vcenter", 2.5), ("vm ", 1.0), ("maquina virtual", 2.0),
        ("snapshot", 1.5), ("migracao", 1.5), ("ballooning", 2.5), ("vcpu", 2.0),
        ("cluster", 1.0), ("cockpit", 1.5), ("ha ", 0.5),
    ],
    Category.OBJECT_STORAGE: [
        ("s3", 2.5), ("bucket", 2.5), ("object storage", 3.0), ("multipart", 2.5),
        ("delete marker", 3.0), ("versionamento", 1.5), ("rclone", 2.0),
        ("aws cli", 2.0), ("s3 browser", 2.5), ("slowdown", 2.5), ("endpoint s3", 3.0),
        ("403", 1.0), ("409", 1.0), ("429", 1.5),
    ],
    Category.BACKUP: [
        ("backup", 2.0), ("restore", 2.0), ("pbs", 2.5), ("proxmox backup", 3.0),
        ("acronis", 2.5), ("prune", 2.0), ("garbage collection", 2.0),
        ("verificacao de integridade", 2.0), ("retencao", 1.5),
    ],
    Category.REDE: [
        ("rede", 1.5), ("vlan", 2.0), ("arp", 2.0), ("dhcp", 2.0), ("gateway", 2.0),
        ("mtu", 2.5), ("perda de pacotes", 2.5), ("latencia", 1.0), ("rota", 1.5),
        ("switch", 1.5), ("ping", 1.0), ("traceroute", 2.0), ("dns", 2.0),
        ("conectividade", 2.0), ("link", 1.0), ("ipv6", 2.0), ("nat", 1.5),
    ],
    Category.SEGURANCA: [
        ("firewall", 2.0), ("pfsense", 2.5), ("fortigate", 2.5), ("juniper", 2.0),
        ("vpn", 2.0), ("bloqueio", 1.5), ("invasao", 2.5), ("malware", 2.5),
        ("vulnerabilidade", 2.0), ("porta bloqueada", 2.0), ("regra de firewall", 2.5),
    ],
    Category.SISTEMA_OPERACIONAL: [
        ("kernel", 2.0), ("systemd", 2.0), ("journalctl", 2.0), ("boot", 1.5),
        ("almalinux", 2.0), ("rocky", 1.5), ("ubuntu", 1.5), ("debian", 1.5),
        ("centos", 1.5), ("rhel", 2.0), ("windows server", 2.0), ("filesystem", 1.5),
        ("read-only", 2.0), ("kernel panic", 3.0), ("swap", 1.0), ("fsck", 2.5),
    ],
    Category.BANCO_DE_DADOS: [
        ("postgres", 2.5), ("mysql", 2.5), ("mariadb", 2.5), ("mongodb", 2.5),
        ("banco de dados", 2.0), ("query lenta", 2.5), ("replicacao", 2.0),
        ("deadlock", 2.5),
    ],
    Category.PERFORMANCE: [
        ("lentidao", 2.0), ("lento", 1.5), ("performance", 2.0), ("load average", 2.5),
        ("cpu alta", 2.5), ("memoria alta", 2.0), ("consumo elevado", 2.0),
        ("saturacao", 2.0), ("gargalo", 2.5),
    ],
    Category.ACESSO: [
        ("senha", 2.0), ("login", 2.0), ("acesso negado", 2.5), ("permissao", 1.5),
        ("bloqueada", 1.5), ("chave ssh", 2.5), ("credencial", 2.0), ("console", 1.0),
        ("nao consigo acessar", 2.0),
    ],
    Category.LICENCA: [
        ("licenca", 3.0), ("license", 3.0), ("ativacao", 2.0), ("chave de produto", 2.5),
    ],
    Category.INDISPONIBILIDADE: [
        ("indisponivel", 2.5), ("fora do ar", 3.0), ("down", 1.5), ("offline", 2.0),
        ("nao responde", 2.0), ("inacessivel", 2.5), ("queda total", 3.0),
    ],
    Category.MUDANCA: [
        ("gmud", 3.0), ("janela de manutencao", 2.5), ("mudanca programada", 2.5),
        ("rollback", 1.5), ("change", 1.5),
    ],
    Category.CONFIGURACAO: [
        ("configurar", 2.0), ("configuracao", 1.5), ("parametrizar", 2.0),
        ("ajuste de", 1.5), ("solicito alteracao", 2.0),
    ],
    Category.FALHA_APLICACAO: [
        ("aplicacao", 1.5), ("crash", 2.0), ("stacktrace", 2.5), ("exception", 2.0),
        ("erro 500 na aplicacao", 3.0),
    ],
    Category.DUVIDA_TECNICA: [
        ("duvida", 2.5), ("como faco", 2.5), ("como configurar", 2.0),
        ("boas praticas", 2.5), ("orientacao", 2.0), ("gostaria de saber", 2.5),
    ],
}

# Roteamento padrao por categoria
TEAM_BY_CATEGORY: dict[Category, Team] = {
    Category.HARDWARE: Team.INFRAESTRUTURA,
    Category.STORAGE: Team.INFRAESTRUTURA,
    Category.RAID: Team.INFRAESTRUTURA,
    Category.REDE: Team.INFRAESTRUTURA,
    Category.SEGURANCA: Team.SEGURANCA,
    Category.DDOS: Team.SEGURANCA,
    Category.VIRTUALIZACAO: Team.SUPORTE_N2,
    Category.SISTEMA_OPERACIONAL: Team.SUPORTE_N2,
    Category.BANCO_DE_DADOS: Team.ENGENHARIA,
    Category.OBJECT_STORAGE: Team.ENGENHARIA,
    Category.BACKUP: Team.SUPORTE_N2,
    Category.PERFORMANCE: Team.SUPORTE_N2,
    Category.ACESSO: Team.SUPORTE_N1,
    Category.LICENCA: Team.SUPORTE_N1,
    Category.INDISPONIBILIDADE: Team.INFRAESTRUTURA,
    Category.MUDANCA: Team.INFRAESTRUTURA,
    Category.CONFIGURACAO: Team.SUPORTE_N2,
    Category.FALHA_APLICACAO: Team.DESENVOLVIMENTO,
    Category.PROBLEMA_CLIENTE: Team.SUPORTE_N1,
    Category.NECESSIDADE_ENGENHARIA: Team.ENGENHARIA,
    Category.NECESSIDADE_INFRAESTRUTURA: Team.INFRAESTRUTURA,
    Category.NECESSIDADE_DESENVOLVIMENTO: Team.DESENVOLVIMENTO,
    Category.DUVIDA_TECNICA: Team.SUPORTE_N1,
}

_SEVERITY_ESCALATORS: list[tuple[str, Severity]] = [
    ("producao parada", Severity.CRITICA), ("fora do ar", Severity.CRITICA),
    ("queda total", Severity.CRITICA), ("perda de dados", Severity.CRITICA),
    ("ddos", Severity.CRITICA), ("kernel panic", Severity.ALTA),
    ("degraded", Severity.ALTA), ("failed", Severity.ALTA),
    ("indisponivel", Severity.ALTA), ("nao liga", Severity.ALTA),
    ("intermitente", Severity.MEDIA), ("lentidao", Severity.MEDIA),
    ("duvida", Severity.BAIXA), ("como faco", Severity.BAIXA),
]

_SUBCATEGORY_HINTS: dict[str, list[tuple[str, str]]] = {
    Category.RAID.value: [
        ("rebuild", "rebuild"), ("degraded", "degraded"), ("bateria", "bateria_cache"),
        ("cabo", "cabo_backplane"), ("backplane", "cabo_backplane"),
        ("controladora", "controladora"), ("virtual disk", "virtual_disk"),
    ],
    Category.OBJECT_STORAGE.value: [
        ("429", "rate_limiting"), ("slowdown", "rate_limiting"),
        ("403", "credenciais_s3"), ("multipart", "upload_multipart"),
        ("listagem", "listagem"), ("quota", "quota"),
        ("500", "erro_http"), ("503", "erro_http"), ("erro", "erro_http"),
    ],
    Category.HARDWARE.value: [
        ("fonte", "fonte"), ("ventilador", "ventilador"), ("fan", "ventilador"),
        ("temperatura", "sensor_temperatura"), ("memoria", "memoria"),
        ("dimm", "memoria"), ("ilo", "bmc_ilo_idrac"), ("idrac", "bmc_ilo_idrac"),
        ("firmware", "firmware"), ("reinicia", "reinicializacao_inesperada"),
    ],
    Category.VIRTUALIZACAO.value: [
        ("proxmox", "proxmox"), ("vmware", "vmware"), ("kvm", "kvm_qemu"),
        ("nao inicia", "vm_nao_inicia"), ("migra", "migracao"),
        ("snapshot", "snapshot"), ("cluster", "cluster_ha"),
    ],
    Category.REDE.value: [
        ("perda de pacotes", "perda_pacotes"), ("latencia", "latencia"),
        ("vlan", "vlan"), ("dns", "dns"), ("dhcp", "dhcp"), ("mtu", "mtu"),
        ("rota", "rotas"), ("conectividade", "conectividade"),
    ],
    Category.BACKUP.value: [
        ("restore", "falha_restore"), ("pbs", "pbs"), ("acronis", "acronis"),
        ("prune", "prune_gc"), ("garbage", "prune_gc"), ("verifica", "verificacao"),
        ("backup", "falha_backup"),
    ],
}


@dataclass
class RuleClassification:
    """Resultado da classificacao deterministica."""

    category: Category
    subcategory: str
    severity: Severity
    team: Team
    confidence: float
    matched_terms: list[str] = field(default_factory=list)
    scores: dict[str, float] = field(default_factory=dict)


def classify_by_rules(text: str) -> RuleClassification:
    """Classifica o texto por pontuacao de palavras-chave."""
    lower = f" {text.lower()} "
    scores: dict[Category, float] = {}
    matched: dict[Category, list[str]] = {}
    for category, terms in KEYWORDS.items():
        score = 0.0
        hits: list[str] = []
        for term, weight in terms:
            if term in lower:
                score += weight
                hits.append(term)
        if score > 0:
            scores[category] = score
            matched[category] = hits

    if not scores:
        category = Category.DUVIDA_TECNICA
        confidence = 0.2
        hits = []
    else:
        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        category, top_score = ranked[0]
        second = ranked[1][1] if len(ranked) > 1 else 0.0
        # confianca cresce com o score absoluto e com a margem sobre o segundo
        margin = (top_score - second) / top_score if top_score else 0.0
        confidence = min(0.95, 0.35 + min(top_score / 10.0, 0.4) + 0.2 * margin)
        hits = matched[category]

    severity = Severity.MEDIA
    for term, level in _SEVERITY_ESCALATORS:
        if term in lower:
            severity = level
            break

    subcategory = "outro"
    for term, sub in _SUBCATEGORY_HINTS.get(category.value, []):
        if term in lower:
            subcategory = sub
            break

    return RuleClassification(
        category=category,
        subcategory=subcategory,
        severity=severity,
        team=TEAM_BY_CATEGORY[category],
        confidence=round(confidence, 4),
        matched_terms=hits,
        scores={c.value: round(s, 2) for c, s in scores.items()},
    )
