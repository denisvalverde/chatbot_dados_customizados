"""Vocabularios controlados da plataforma (secoes 2 e 3.2 da especificacao)."""

from __future__ import annotations

from enum import Enum


class Category(str, Enum):
    """Categorias principais de chamados."""

    HARDWARE = "hardware"
    STORAGE = "storage"
    RAID = "raid"
    REDE = "rede"
    SEGURANCA = "seguranca"
    DDOS = "ddos"
    VIRTUALIZACAO = "virtualizacao"
    SISTEMA_OPERACIONAL = "sistema_operacional"
    BANCO_DE_DADOS = "banco_de_dados"
    OBJECT_STORAGE = "object_storage"
    BACKUP = "backup"
    PERFORMANCE = "performance"
    ACESSO = "acesso"
    LICENCA = "licenca"
    INDISPONIBILIDADE = "indisponibilidade"
    MUDANCA = "mudanca"
    CONFIGURACAO = "configuracao"
    FALHA_APLICACAO = "falha_aplicacao"
    PROBLEMA_CLIENTE = "problema_cliente"
    NECESSIDADE_ENGENHARIA = "necessidade_engenharia"
    NECESSIDADE_INFRAESTRUTURA = "necessidade_infraestrutura"
    NECESSIDADE_DESENVOLVIMENTO = "necessidade_desenvolvimento"
    DUVIDA_TECNICA = "duvida_tecnica"


class Severity(str, Enum):
    """Severidade do chamado."""

    BAIXA = "baixa"
    MEDIA = "media"
    ALTA = "alta"
    CRITICA = "critica"


class Urgency(str, Enum):
    BAIXA = "baixa"
    MEDIA = "media"
    ALTA = "alta"


class Impact(str, Enum):
    BAIXO = "baixo"
    MEDIO = "medio"
    ALTO = "alto"


class Risk(str, Enum):
    BAIXO = "baixo"
    MEDIO = "medio"
    ALTO = "alto"
    CRITICO = "critico"


class Team(str, Enum):
    """Equipes para roteamento/escalonamento."""

    SUPORTE_N1 = "suporte_n1"
    SUPORTE_N2 = "suporte_n2"
    INFRAESTRUTURA = "infraestrutura"
    ENGENHARIA = "engenharia"
    SEGURANCA = "seguranca"
    DESENVOLVIMENTO = "desenvolvimento"


class TicketStatus(str, Enum):
    ABERTO = "aberto"
    EM_ANALISE = "em_analise"
    AGUARDANDO_CLIENTE = "aguardando_cliente"
    ESCALONADO = "escalonado"
    RESOLVIDO = "resolvido"
    ENCERRADO = "encerrado"


class EvidenceType(str, Enum):
    LOG = "log"
    COMANDO = "comando"
    SAIDA_COMANDO = "saida_comando"
    PRINT = "print"
    ARQUIVO = "arquivo"
    METRICA = "metrica"
    MENSAGEM_CLIENTE = "mensagem_cliente"
    OBSERVACAO_INTERNA = "observacao_interna"


class DocumentType(str, Enum):
    """Tipos de documento da base de conhecimento."""

    CHAMADO_RESOLVIDO = "chamado_resolvido"
    PROCEDIMENTO = "procedimento"
    ARTIGO = "artigo"
    COMANDO = "comando"
    RCA = "rca"
    GMUD = "gmud"
    MENSAGEM_APROVADA = "mensagem_aprovada"
    EVIDENCIA = "evidencia"
    SOLUCAO = "solucao"


class CommandRisk(str, Enum):
    """Classificacao de risco de comandos (secao 3.5)."""

    LEITURA = "leitura"
    DIAGNOSTICO = "diagnostico"
    BAIXO_RISCO = "baixo_risco"
    ALTERACAO = "alteracao"
    ALTO_RISCO = "alto_risco"
    DESTRUTIVO = "destrutivo"


class Audience(str, Enum):
    """Publicos-alvo da comunicacao (secao 3.6)."""

    CLIENTE_TECNICO = "cliente_tecnico"
    CLIENTE_NAO_TECNICO = "cliente_nao_tecnico"
    INFRAESTRUTURA = "infraestrutura"
    ENGENHARIA = "engenharia"
    GESTAO = "gestao"
    DIRETORIA = "diretoria"
    FINANCEIRO = "financeiro"
    OPERACAO = "operacao"
    EXECUTIVO = "executivo"


class MessageKind(str, Enum):
    """Tipos de comunicacao gerada."""

    RESPOSTA_INICIAL = "resposta_inicial"
    ATUALIZACAO_PARCIAL = "atualizacao_parcial"
    SOLICITACAO_EVIDENCIAS = "solicitacao_evidencias"
    SOLICITACAO_JANELA = "solicitacao_janela"
    SOLICITACAO_BACKUP = "solicitacao_backup"
    ESCALONAMENTO = "escalonamento"
    DEVOLUTIVA_TECNICA = "devolutiva_tecnica"
    ENCERRAMENTO = "encerramento"
    CONVITE_AVALIACAO = "convite_avaliacao"
    PLANO_DE_ACAO = "plano_de_acao"
    CRONOLOGIA = "cronologia"
    GMUD = "gmud"
    RCA = "rca"
    RELATORIO_EXECUTIVO = "relatorio_executivo"
    RELATORIO_TECNICO = "relatorio_tecnico"


# Subcategorias por categoria (vocabulario resumido dos dominios 2.1-2.7)
SUBCATEGORIES: dict[str, list[str]] = {
    Category.HARDWARE.value: [
        "fonte", "ventilador", "sensor_temperatura", "memoria", "cpu",
        "bmc_ilo_idrac", "firmware", "reinicializacao_inesperada", "outro",
    ],
    Category.STORAGE.value: [
        "disco_ssd", "disco_hdd", "nvme", "latencia_io", "saturacao",
        "smart_predictive", "outro",
    ],
    Category.RAID.value: [
        "degraded", "rebuild", "controladora", "bateria_cache", "cabo_backplane",
        "virtual_disk", "outro",
    ],
    Category.REDE.value: [
        "conectividade", "perda_pacotes", "latencia", "vlan", "dns", "dhcp",
        "mtu", "rotas", "outro",
    ],
    Category.SEGURANCA.value: ["firewall", "vpn", "bloqueio", "credenciais", "outro"],
    Category.DDOS.value: ["ataque_em_andamento", "mitigacao", "pos_ataque", "outro"],
    Category.VIRTUALIZACAO.value: [
        "proxmox", "kvm_qemu", "vmware", "vm_nao_inicia", "migracao", "snapshot",
        "cluster_ha", "outro",
    ],
    Category.SISTEMA_OPERACIONAL.value: [
        "boot", "kernel", "servico", "filesystem", "pacotes", "outro",
    ],
    Category.BANCO_DE_DADOS.value: ["conexao", "performance", "corrupcao", "outro"],
    Category.OBJECT_STORAGE.value: [
        "erro_http", "rate_limiting", "listagem", "upload_multipart",
        "credenciais_s3", "quota", "outro",
    ],
    Category.BACKUP.value: [
        "falha_backup", "falha_restore", "pbs", "acronis", "verificacao",
        "prune_gc", "outro",
    ],
    Category.PERFORMANCE.value: ["cpu", "memoria", "io", "rede", "outro"],
    Category.ACESSO.value: ["login", "permissao", "chave_ssh", "console", "outro"],
    Category.LICENCA.value: ["ativacao", "expiracao", "outro"],
    Category.INDISPONIBILIDADE.value: ["total", "parcial", "intermitente", "outro"],
    Category.MUDANCA.value: ["gmud", "janela", "rollback", "outro"],
    Category.CONFIGURACAO.value: ["solicitacao", "revisao", "outro"],
    Category.FALHA_APLICACAO.value: ["erro", "crash", "outro"],
    Category.PROBLEMA_CLIENTE.value: ["ambiente_cliente", "uso_incorreto", "outro"],
    Category.NECESSIDADE_ENGENHARIA.value: ["analise_avancada", "outro"],
    Category.NECESSIDADE_INFRAESTRUTURA.value: ["intervencao_fisica", "outro"],
    Category.NECESSIDADE_DESENVOLVIMENTO.value: ["correcao_codigo", "outro"],
    Category.DUVIDA_TECNICA.value: ["como_fazer", "boas_praticas", "outro"],
}

# Tecnologias reconhecidas (para extracao e cabeca multilabel da rede)
TECHNOLOGIES: list[str] = [
    "hpe_proliant", "dell_poweredge", "huawei", "ilo", "idrac", "ibmc", "ipmi",
    "megaraid", "ssd", "hdd", "nvme", "sas", "sata", "proxmox", "kvm", "qemu",
    "libvirt", "vmware", "cockpit", "almalinux", "rocky", "ubuntu", "debian",
    "centos", "rhel", "windows_server", "systemd", "pfsense", "fortigate",
    "juniper", "s3", "aws_cli", "rclone", "pbs", "acronis", "postgresql",
    "mysql", "docker", "zabbix", "grafana", "dns", "vpn", "vlan",
]
