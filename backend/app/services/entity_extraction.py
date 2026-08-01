"""Extracao estruturada de entidades tecnicas (secao 3.3), validada com Pydantic."""

from __future__ import annotations

import re

from pydantic import BaseModel, Field

from app.domain.enums import TECHNOLOGIES


class ExtractedEntities(BaseModel):
    """Entidades tecnicas extraidas do texto do chamado."""

    numeros_chamado: list[str] = Field(default_factory=list)
    hostnames: list[str] = Field(default_factory=list)
    ips: list[str] = Field(default_factory=list)
    blocos_ip: list[str] = Field(default_factory=list)
    vlans: list[str] = Field(default_factory=list)
    portas: list[int] = Field(default_factory=list)
    erros_http: list[int] = Field(default_factory=list)
    datas: list[str] = Field(default_factory=list)
    horarios: list[str] = Field(default_factory=list)
    comandos: list[str] = Field(default_factory=list)
    mensagens_erro: list[str] = Field(default_factory=list)
    discos: list[str] = Field(default_factory=list)
    raids: list[str] = Field(default_factory=list)
    buckets: list[str] = Field(default_factory=list)
    endpoints: list[str] = Field(default_factory=list)
    vms: list[str] = Field(default_factory=list)
    seriais: list[str] = Field(default_factory=list)
    fabricantes: list[str] = Field(default_factory=list)
    capacidades: list[str] = Field(default_factory=list)
    tecnologias: list[str] = Field(default_factory=list)
    gmuds: list[str] = Field(default_factory=list)
    tickets_relacionados: list[str] = Field(default_factory=list)


_RE = {
    "ticket": re.compile(r"\b(?:chamado|ticket|inc|req|case)[\s#:-]*(\d{4,10})\b", re.I),
    "gmud": re.compile(r"\bgmud[\s#:-]*([A-Z0-9-]{3,15})\b", re.I),
    "ip": re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
    "cidr": re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}/\d{1,2}\b"),
    "vlan": re.compile(r"\bvlan[\s#:-]*(\d{1,4})\b", re.I),
    "porta": re.compile(r"\bporta[\s#:-]*(\d{1,5})\b", re.I),
    "http": re.compile(r"\b(?:http|erro|error|status)[\s:]*([45]\d{2})\b", re.I),
    "hostname": re.compile(
        r"\b(?:host(?:name)?|servidor|server)[\s#:-]*([a-zA-Z][\w-]{2,40}(?:\.[\w-]+)*)", re.I
    ),
    "fqdn": re.compile(r"\b([a-z][\w-]{2,30}\.(?:[\w-]+\.)+(?:com|net|org|br|io|cloud|local|lan))\b", re.I),
    "data": re.compile(r"\b(\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2})\b"),
    "hora": re.compile(r"\b(\d{1,2}:\d{2}(?::\d{2})?)\b"),
    "disco": re.compile(r"\b(/dev/(?:sd[a-z]+\d*|nvme\d+n\d+(?:p\d+)?|vd[a-z]+\d*)|slot\s*\d+)\b", re.I),
    "raid": re.compile(r"\braid[\s-]*(0|1|5|6|10|50|60)\b", re.I),
    "bucket": re.compile(r"\bbucket[\s#:-]*([a-z0-9][a-z0-9.-]{2,62})\b", re.I),
    "endpoint": re.compile(r"\bhttps?://[\w.-]+(?::\d+)?(?:/[\w./-]*)?\b", re.I),
    "vm": re.compile(r"\bvm[\s#:-]*(\d{2,6}|[a-zA-Z][\w-]{2,30})\b"),
    "serial": re.compile(r"\b(?:serial|s/?n)[\s#:-]*([A-Z0-9]{6,20})\b", re.I),
    "capacidade": re.compile(r"\b(\d+(?:[.,]\d+)?\s?(?:TB|GB|MB|TiB|GiB|MiB))\b", re.I),
    "erro_msg": re.compile(
        r"((?:error|erro|failed|failure|panic|fatal|critical|timeout|denied|refused)[^\n.;]{0,120})",
        re.I,
    ),
}

_COMMAND_HINTS = re.compile(
    r"^\s*(?:\$|#|>)?\s*((?:sudo\s+)?(?:smartctl|megacli|storcli|perccli|dmesg|journalctl|"
    r"systemctl|df|du|free|top|htop|iostat|vmstat|sar|ping|traceroute|mtr|ip|ss|netstat|"
    r"ethtool|qm|pct|pvesm|pvecm|virsh|lsblk|fdisk|mdadm|zpool|zfs|aws|rclone|s3cmd|"
    r"proxmox-backup-client|ipmitool|racadm|hponcfg|curl|dig|nslookup|uptime|lscpu|"
    r"lsmem|lspci|badblocks|fio|nc|tcpdump)\b[^\n]{0,200})",
    re.I | re.M,
)

_VENDORS = {
    "hpe": "HPE", "proliant": "HPE", "dell": "Dell", "poweredge": "Dell",
    "huawei": "Huawei", "supermicro": "Supermicro", "lenovo": "Lenovo",
}


def extract_entities(text: str) -> ExtractedEntities:
    """Extrai todas as entidades reconhecidas do texto."""
    def uniq(values: list[str]) -> list[str]:
        seen: dict[str, None] = {}
        for v in values:
            seen.setdefault(v.strip(), None)
        return [v for v in seen if v]

    cidrs = _RE["cidr"].findall(text)
    ips = [ip for ip in _RE["ip"].findall(text) if not any(ip in c for c in cidrs)]
    lower = text.lower()

    entities = ExtractedEntities(
        numeros_chamado=uniq(_RE["ticket"].findall(text)),
        gmuds=uniq(_RE["gmud"].findall(text)),
        ips=uniq(ips),
        blocos_ip=uniq(cidrs),
        vlans=uniq(_RE["vlan"].findall(text)),
        portas=[int(p) for p in uniq(_RE["porta"].findall(text)) if 0 < int(p) < 65536],
        erros_http=[int(e) for e in uniq(_RE["http"].findall(text))],
        hostnames=uniq(_RE["hostname"].findall(text) + _RE["fqdn"].findall(text)),
        datas=uniq(_RE["data"].findall(text)),
        horarios=uniq(_RE["hora"].findall(text)),
        discos=uniq(_RE["disco"].findall(text)),
        raids=uniq([f"RAID {r}" for r in _RE["raid"].findall(text)]),
        buckets=uniq(_RE["bucket"].findall(text)),
        endpoints=uniq(_RE["endpoint"].findall(text)),
        vms=uniq(_RE["vm"].findall(text)),
        seriais=uniq(_RE["serial"].findall(text)),
        capacidades=uniq(_RE["capacidade"].findall(text)),
        comandos=uniq(_COMMAND_HINTS.findall(text)),
        mensagens_erro=uniq(_RE["erro_msg"].findall(text))[:10],
        fabricantes=uniq([label for key, label in _VENDORS.items() if key in lower]),
        tecnologias=[t for t in TECHNOLOGIES if t.replace("_", " ") in lower or t in lower],
    )
    entities.tickets_relacionados = entities.numeros_chamado[1:]
    return entities
