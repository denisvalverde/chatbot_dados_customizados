"""Catalogo de comandos de diagnostico com classificacao de risco (secao 3.5).

Politica de seguranca: o catalogo contem APENAS comandos de leitura e
diagnostico. Comandos de alteracao/destrutivos nunca sao gerados
automaticamente; quando uma acao de risco e necessaria, o sistema retorna
um AVISO estruturado exigindo backup, janela, rollback e confirmacao.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.domain.enums import Category, CommandRisk


class DiagnosticCommand(BaseModel):
    """Comando de diagnostico estruturado."""

    objetivo: str
    sistema: str
    risco: CommandRisk
    requer_privilegio: bool
    impacto: str
    explicacao: str
    comando: str
    saida_esperada: str
    interpretacao: str
    rollback: str = ""


# Termos que marcam um comando como destrutivo/alteracao (bloqueio de geracao)
DESTRUCTIVE_MARKERS = [
    "rm -rf", "mkfs", "dd if=", "wipefs", "parted", "fdisk -w", "shred",
    "reboot", "shutdown", "poweroff", "init 0", "init 6", "systemctl stop",
    "systemctl disable", "userdel", "dropdb", "drop table", "truncate",
    "mdadm --zero-superblock", "storcli /c0 delete", "megacli -cfgclr",
    "qm destroy", "pct destroy", "virsh undefine", "zpool destroy",
    "aws s3 rb", "aws s3 rm", "rclone delete", "rclone purge", "iptables -F",
]

CATALOG: dict[str, list[DiagnosticCommand]] = {
    Category.HARDWARE.value: [
        DiagnosticCommand(
            objetivo="Verificar eventos de hardware no kernel",
            sistema="Linux", risco=CommandRisk.LEITURA, requer_privilegio=True,
            impacto="Nenhum (somente leitura)",
            explicacao="Lista mensagens recentes do kernel relacionadas a hardware.",
            comando="dmesg -T --level=err,crit,alert,emerg | tail -50",
            saida_esperada="Linhas com timestamp e mensagens de erro, ou vazio.",
            interpretacao="Mensagens de MCE, ECC, thermal ou PCIe indicam falha fisica; vazio afasta erro recente de kernel.",
        ),
        DiagnosticCommand(
            objetivo="Consultar saude via IPMI/BMC (iLO/iDRAC/iBMC)",
            sistema="Linux", risco=CommandRisk.DIAGNOSTICO, requer_privilegio=True,
            impacto="Nenhum (somente leitura)",
            explicacao="Le sensores e eventos do controlador de gerenciamento.",
            comando="ipmitool sdr elist; ipmitool sel elist | tail -30",
            saida_esperada="Lista de sensores com estado ok/nr e eventos do SEL.",
            interpretacao="Sensores 'nr'/'cr' ou eventos de fonte/ventilador/temperatura confirmam falha de hardware.",
        ),
        DiagnosticCommand(
            objetivo="Verificar erros de memoria ECC",
            sistema="Linux", risco=CommandRisk.LEITURA, requer_privilegio=True,
            impacto="Nenhum",
            explicacao="Consulta contadores EDAC de erros corrigiveis/incorrigiveis.",
            comando="grep -H . /sys/devices/system/edac/mc/mc*/*e_count 2>/dev/null",
            saida_esperada="Contadores por controlador de memoria (0 = sem erros).",
            interpretacao="ue_count > 0 indica DIMM com erro incorrigivel: planejar substituicao.",
        ),
    ],
    Category.RAID.value: [
        DiagnosticCommand(
            objetivo="Estado geral da controladora e discos (LSI/MegaRAID)",
            sistema="Linux", risco=CommandRisk.DIAGNOSTICO, requer_privilegio=True,
            impacto="Nenhum (somente leitura)",
            explicacao="Mostra estado de virtual disks, physical disks, BBU e cache.",
            comando="storcli /c0 show all | head -120",
            saida_esperada="Status Optl/Dgrd por VD, estado dos PDs, BBU status.",
            interpretacao="VD 'Dgrd' com PD 'Flt/UBad' confirma degradacao; 'Rbld' indica rebuild em andamento.",
        ),
        DiagnosticCommand(
            objetivo="Acompanhar progresso de rebuild",
            sistema="Linux", risco=CommandRisk.LEITURA, requer_privilegio=True,
            impacto="Nenhum",
            explicacao="Percentual de reconstrucao por disco fisico.",
            comando="storcli /c0/eall/sall show rebuild",
            saida_esperada="Progresso em % ou 'Not in progress'.",
            interpretacao="Progresso crescente = rebuild saudavel; estagnado por horas = investigar disco/backplane.",
        ),
        DiagnosticCommand(
            objetivo="Estado de RAID por software",
            sistema="Linux", risco=CommandRisk.LEITURA, requer_privilegio=False,
            impacto="Nenhum",
            explicacao="Le o estado dos arrays mdraid.",
            comando="cat /proc/mdstat",
            saida_esperada="Arrays com [UU] saudaveis ou [U_] degradados.",
            interpretacao="'_' indica membro ausente/falho; 'recovery' mostra rebuild com percentual.",
        ),
    ],
    Category.STORAGE.value: [
        DiagnosticCommand(
            objetivo="Saude SMART do disco",
            sistema="Linux", risco=CommandRisk.DIAGNOSTICO, requer_privilegio=True,
            impacto="Nenhum (somente leitura)",
            explicacao="Le atributos SMART e resultado do ultimo self-test.",
            comando="smartctl -a /dev/sdX",
            saida_esperada="SMART overall-health: PASSED e tabela de atributos.",
            interpretacao="Reallocated_Sector_Ct, Pending_Sector ou Media_Wearout altos indicam disco em degradacao; FAILED = substituir.",
        ),
        DiagnosticCommand(
            objetivo="Medir latencia e saturacao de I/O",
            sistema="Linux", risco=CommandRisk.LEITURA, requer_privilegio=False,
            impacto="Desprezivel",
            explicacao="Amostra estatisticas de I/O por dispositivo.",
            comando="iostat -xz 2 5",
            saida_esperada="Tabela com r/s, w/s, await, %util por dispositivo.",
            interpretacao="await alto (>20ms em SSD) e %util ~100% indicam saturacao/gargalo de I/O.",
        ),
        DiagnosticCommand(
            objetivo="Listar dispositivos de bloco e filesystems",
            sistema="Linux", risco=CommandRisk.LEITURA, requer_privilegio=False,
            impacto="Nenhum",
            explicacao="Visao geral de discos, particoes e pontos de montagem.",
            comando="lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,STATE; df -hT",
            saida_esperada="Arvore de dispositivos e uso por filesystem.",
            interpretacao="Filesystem 100% cheio ou dispositivo 'suspended' explica erros de gravacao.",
        ),
    ],
    Category.REDE.value: [
        DiagnosticCommand(
            objetivo="Testar conectividade e perda de pacotes",
            sistema="Linux/Windows", risco=CommandRisk.LEITURA, requer_privilegio=False,
            impacto="Trafego minimo de ICMP",
            explicacao="Mede perda e latencia ate o destino.",
            comando="ping -c 20 <destino>",
            saida_esperada="20 pacotes com estatisticas de perda e rtt.",
            interpretacao="Perda > 1% ou rtt instavel indica problema de rede no caminho.",
        ),
        DiagnosticCommand(
            objetivo="Rastrear caminho com perda por salto",
            sistema="Linux", risco=CommandRisk.DIAGNOSTICO, requer_privilegio=False,
            impacto="Trafego minimo",
            explicacao="Combina traceroute+ping continuo por salto.",
            comando="mtr -rw -c 50 <destino>",
            saida_esperada="Tabela de saltos com Loss% e Avg.",
            interpretacao="Perda que comeca em um salto e persiste ate o fim localiza o ponto do problema.",
        ),
        DiagnosticCommand(
            objetivo="Conferir interfaces, erros e MTU",
            sistema="Linux", risco=CommandRisk.LEITURA, requer_privilegio=False,
            impacto="Nenhum",
            explicacao="Estado das interfaces e contadores de erro.",
            comando="ip -s link; ip route; ss -s",
            saida_esperada="Interfaces UP, contadores RX/TX e tabela de rotas.",
            interpretacao="errors/dropped crescentes indicam problema fisico/driver; rota ausente explica inacessibilidade.",
        ),
    ],
    Category.VIRTUALIZACAO.value: [
        DiagnosticCommand(
            objetivo="Estado geral do cluster/nos Proxmox",
            sistema="Proxmox VE", risco=CommandRisk.LEITURA, requer_privilegio=True,
            impacto="Nenhum",
            explicacao="Estado de quorum, nos e servicos do cluster.",
            comando="pvecm status; pvesm status",
            saida_esperada="Quorum OK e storages 'active'.",
            interpretacao="Sem quorum = VMs HA podem parar; storage 'inactive' explica falha de disco de VM.",
        ),
        DiagnosticCommand(
            objetivo="Estado e configuracao de uma VM (Proxmox)",
            sistema="Proxmox VE", risco=CommandRisk.LEITURA, requer_privilegio=True,
            impacto="Nenhum",
            explicacao="Consulta status e configuracao da VM.",
            comando="qm status <vmid>; qm config <vmid>",
            saida_esperada="status: running/stopped e parametros da VM.",
            interpretacao="VM stopped com storage indisponivel aponta causa externa; conferir 'bootdisk' e 'net0'.",
        ),
        DiagnosticCommand(
            objetivo="Listar dominios e estado (KVM/libvirt)",
            sistema="KVM/libvirt", risco=CommandRisk.LEITURA, requer_privilegio=True,
            impacto="Nenhum",
            explicacao="Lista VMs e estado no hipervisor.",
            comando="virsh list --all; virsh dominfo <dominio>",
            saida_esperada="Tabela de dominios com estado running/shut off.",
            interpretacao="'paused' pode indicar falta de storage; 'crashed' pede análise de logs do QEMU.",
        ),
    ],
    Category.SISTEMA_OPERACIONAL.value: [
        DiagnosticCommand(
            objetivo="Logs de erro recentes do sistema",
            sistema="Linux (systemd)", risco=CommandRisk.LEITURA, requer_privilegio=True,
            impacto="Nenhum",
            explicacao="Filtra logs por prioridade de erro desde o ultimo boot.",
            comando="journalctl -p err..alert -b --no-pager | tail -50",
            saida_esperada="Linhas de erro ou vazio.",
            interpretacao="Erros repetidos de um mesmo servico identificam o componente com falha.",
        ),
        DiagnosticCommand(
            objetivo="Carga, memoria e processos",
            sistema="Linux", risco=CommandRisk.LEITURA, requer_privilegio=False,
            impacto="Nenhum",
            explicacao="Visao geral de recursos.",
            comando="uptime; free -h; ps aux --sort=-%cpu | head -10",
            saida_esperada="Load average, memoria livre e top de processos.",
            interpretacao="Load >> nucleos com swap em uso indica saturacao; processo isolado no topo aponta ofensor.",
        ),
        DiagnosticCommand(
            objetivo="Estado de servicos com falha",
            sistema="Linux (systemd)", risco=CommandRisk.LEITURA, requer_privilegio=False,
            impacto="Nenhum",
            explicacao="Lista units em estado failed.",
            comando="systemctl --failed",
            saida_esperada="Lista de units failed ou '0 loaded units'.",
            interpretacao="Cada unit failed deve ser investigada com 'journalctl -u <unit>'.",
        ),
    ],
    Category.OBJECT_STORAGE.value: [
        DiagnosticCommand(
            objetivo="Testar credenciais e listagem no endpoint S3",
            sistema="Linux/Windows (AWS CLI)", risco=CommandRisk.LEITURA, requer_privilegio=False,
            impacto="Nenhum",
            explicacao="Valida autenticacao e acesso ao bucket.",
            comando="aws s3 ls s3://<bucket> --endpoint-url https://<endpoint> --debug 2>&1 | tail -30",
            saida_esperada="Listagem de objetos ou erro HTTP detalhado.",
            interpretacao="403 = credencial/policy; 404 = bucket inexistente; 429/503 = rate limiting do provedor.",
        ),
        DiagnosticCommand(
            objetivo="Medir latencia das operacoes S3",
            sistema="Linux (rclone)", risco=CommandRisk.DIAGNOSTICO, requer_privilegio=False,
            impacto="Trafego de teste pequeno",
            explicacao="Lista com estatisticas para medir tempo de resposta.",
            comando="rclone lsd <remote>: --stats-one-line -v 2>&1 | tail -10",
            saida_esperada="Diretorios listados e tempo total.",
            interpretacao="Tempos altos ou erros intermitentes indicam problema no endpoint/rede, nao no cliente.",
        ),
    ],
    Category.BACKUP.value: [
        DiagnosticCommand(
            objetivo="Verificar estado do datastore PBS",
            sistema="Proxmox Backup Server", risco=CommandRisk.LEITURA, requer_privilegio=True,
            impacto="Nenhum",
            explicacao="Consulta status e tarefas recentes do datastore.",
            comando="proxmox-backup-manager datastore list; proxmox-backup-manager task list --limit 10",
            saida_esperada="Datastores com espaco e ultimas tasks com status.",
            interpretacao="Tasks 'ERROR' recorrentes no mesmo horario apontam janela conflitante ou storage cheio.",
        ),
    ],
    Category.DDOS.value: [
        DiagnosticCommand(
            objetivo="Identificar padrao de trafego anomalo",
            sistema="Linux", risco=CommandRisk.DIAGNOSTICO, requer_privilegio=True,
            impacto="Baixo (captura limitada)",
            explicacao="Amostra conexoes e trafego por origem.",
            comando="ss -ntu state established | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn | head -20",
            saida_esperada="Contagem de conexoes por IP de origem.",
            interpretacao="Poucos IPs com milhares de conexoes sugerem ataque; distribuicao ampla sugere flood volumetrico (acionar mitigacao upstream).",
        ),
    ],
    Category.PERFORMANCE.value: [
        DiagnosticCommand(
            objetivo="Coleta rapida de saturacao (CPU/mem/IO/rede)",
            sistema="Linux", risco=CommandRisk.LEITURA, requer_privilegio=False,
            impacto="Nenhum",
            explicacao="Amostras de vmstat para identificar o recurso saturado.",
            comando="vmstat 2 5; iostat -xz 2 3",
            saida_esperada="Colunas r/b, si/so, wa e %util.",
            interpretacao="'r' alto = CPU; 'si/so' > 0 = memoria; 'wa'/%util altos = disco.",
        ),
    ],
    Category.ACESSO.value: [
        DiagnosticCommand(
            objetivo="Verificar tentativas de login e bloqueios",
            sistema="Linux", risco=CommandRisk.LEITURA, requer_privilegio=True,
            impacto="Nenhum",
            explicacao="Ultimos eventos de autenticacao.",
            comando="journalctl -u sshd --since '-2 hours' --no-pager | tail -30; lastb | head -10",
            saida_esperada="Eventos de login aceitos/negados.",
            interpretacao="'Failed password' em serie do mesmo IP indica bloqueio por fail2ban ou ataque de forca bruta.",
        ),
    ],
}

_FALLBACK = [
    DiagnosticCommand(
        objetivo="Coleta basica de saude do sistema",
        sistema="Linux", risco=CommandRisk.LEITURA, requer_privilegio=False,
        impacto="Nenhum",
        explicacao="Ponto de partida generico quando a categoria nao possui catalogo especifico.",
        comando="uptime; df -h; free -h; journalctl -p err -b --no-pager | tail -20",
        saida_esperada="Resumo de carga, disco, memoria e erros recentes.",
        interpretacao="Use como triagem inicial para direcionar a investigacao.",
    ),
]


def is_destructive(command: str) -> bool:
    """Detecta se um comando contem marcador destrutivo/de alteracao."""
    lower = command.lower()
    return any(marker in lower for marker in DESTRUCTIVE_MARKERS)


def generate_commands(category: str, context: str = "") -> dict:
    """Retorna comandos seguros para a categoria + aviso de politica.

    Nunca inclui comandos destrutivos. O campo 'politica_seguranca' explica
    as condicoes obrigatorias para acoes de risco (secao 3.5).
    """
    commands = CATALOG.get(category, _FALLBACK)
    return {
        "categoria": category,
        "comandos": [c.model_dump() for c in commands],
        "politica_seguranca": (
            "Este catalogo contem apenas comandos de leitura/diagnostico. "
            "Acoes de alteracao, alto risco ou destrutivas exigem: aviso explicito, "
            "confirmacao humana, backup validado, plano de rollback e justificativa "
            "registrada. Nao execute comandos destrutivos sem estes requisitos."
        ),
    }
