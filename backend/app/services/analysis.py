"""Motor de analise tecnica (secao 3.4) com regras anti-alucinacao (4.6).

Principios implementados:
- fato so e "confirmado" quando ha evidencia objetiva anexada (log, saida de
  comando, metrica); relato subjetivo vira sintoma/hipotese;
- causa raiz nunca e afirmada sem evidencia suficiente;
- toda hipotese carrega confianca + evidencias favoraveis/contrarias;
- dados ausentes e riscos sao sempre listados;
- escalonamento e recomendado por severidade/categoria.
"""

from __future__ import annotations

from typing import Any

from app.domain.enums import Category, EvidenceType, Severity
from app.services.commands import generate_commands
from app.services.entity_extraction import ExtractedEntities

_OBJECTIVE_EVIDENCE = {
    EvidenceType.LOG.value,
    EvidenceType.SAIDA_COMANDO.value,
    EvidenceType.METRICA.value,
    EvidenceType.ARQUIVO.value,
    EvidenceType.PRINT.value,
}

# Hipoteses tipicas por categoria: (descricao, termos_suporte, coleta_necessaria)
_HYPOTHESES: dict[str, list[tuple[str, list[str], str]]] = {
    Category.RAID.value: [
        ("Disco fisico em falha causando degradacao do array", ["degraded", "failed", "predictive"], "storcli /c0 show all"),
        ("Problema de backplane/cabo SAS afetando multiplos discos", ["backplane", "cabo", "dois discos", "multiplos"], "storcli /c0/eall show all + inspecao fisica"),
        ("Bateria/capacitor da controladora degradado (cache em writethrough)", ["bateria", "bbu", "writethrough", "cache"], "storcli /c0/bbu show"),
    ],
    Category.HARDWARE.value: [
        ("Falha de fonte/alimentacao", ["fonte", "energia", "desligou"], "ipmitool sel elist"),
        ("Superaquecimento por falha de ventilacao", ["temperatura", "ventilador", "fan", "termal"], "ipmitool sdr elist"),
        ("Modulo de memoria com erros", ["ecc", "dimm", "memoria", "mce"], "contadores EDAC + SEL"),
    ],
    Category.REDE.value: [
        ("Problema fisico de enlace (cabo/porta/switch)", ["perda", "errors", "dropped", "link"], "ip -s link + teste de cabo"),
        ("Configuracao incorreta (VLAN/MTU/rota)", ["vlan", "mtu", "rota", "gateway"], "ip route + ping com DF"),
        ("Saturacao de banda ou equipamento intermediario", ["latencia", "lentidao", "saturacao"], "mtr prolongado + graficos de trafego"),
    ],
    Category.OBJECT_STORAGE.value: [
        ("Rate limiting do endpoint (429/SlowDown)", ["429", "slowdown", "rate"], "logs do cliente S3 com timestamps"),
        ("Credencial/policy incorreta (403)", ["403", "forbidden", "acesso"], "aws s3 ls com --debug"),
        ("Instabilidade do servico no provedor (5xx)", ["500", "502", "503", "504", "timeout"], "testes de outro origin + status do provedor"),
    ],
    Category.VIRTUALIZACAO.value: [
        ("Storage da VM indisponivel no hipervisor", ["storage", "lvm", "datastore", "disco"], "pvesm status / qm config"),
        ("Falta de recursos no host (RAM/CPU)", ["memoria", "ram", "cpu", "recurso"], "free -h no host + qm status"),
        ("Problema de cluster/quorum", ["cluster", "quorum", "ha"], "pvecm status"),
    ],
    Category.DDOS.value: [
        ("Ataque volumetrico em andamento", ["gbps", "volumetrico", "flood"], "graficos de trafego + amostra de pacotes"),
        ("Ataque de exaustao de conexoes (L7)", ["conexoes", "http", "l7"], "ss -s + logs do servico"),
    ],
    Category.SISTEMA_OPERACIONAL.value: [
        ("Falha apos atualizacao (kernel/pacotes)", ["update", "kernel", "atualizacao", "upgrade"], "journalctl -b -1 + historico de pacotes"),
        ("Filesystem corrompido/somente leitura", ["read-only", "fsck", "corrompido", "filesystem"], "dmesg | grep -i ext4/xfs"),
    ],
    Category.PERFORMANCE.value: [
        ("Saturacao de CPU por processo especifico", ["cpu", "load"], "ps aux --sort=-%cpu"),
        ("Pressao de memoria com swap", ["memoria", "swap"], "free -h + vmstat"),
        ("Gargalo de I/O", ["io", "disco", "iowait", "wa"], "iostat -xz"),
    ],
    Category.BACKUP.value: [
        ("Storage de destino cheio ou inacessivel", ["espaco", "cheio", "timeout", "conectar"], "df -h no destino + task log"),
        ("Janela concorrente causando falha/lentidao", ["janela", "horario", "concorr"], "task list com horarios"),
    ],
}

_ESCALATION_CATEGORIES = {
    Category.DDOS.value: "seguranca",
    Category.NECESSIDADE_ENGENHARIA.value: "engenharia",
    Category.NECESSIDADE_INFRAESTRUTURA.value: "infraestrutura",
    Category.NECESSIDADE_DESENVOLVIMENTO.value: "desenvolvimento",
}


def _split_facts_and_symptoms(
    description: str, evidences: list[dict[str, Any]]
) -> tuple[list[str], list[str]]:
    """Fatos = sustentados por evidencia objetiva; o resto vira sintoma."""
    facts: list[str] = []
    symptoms: list[str] = []
    for evidence in evidences:
        kind = evidence.get("type", "")
        content = (evidence.get("content") or "").strip()
        if not content:
            continue
        summary = content.replace("\n", " ")[:180]
        if kind in _OBJECTIVE_EVIDENCE:
            facts.append(f"[{kind}] {summary}")
        else:
            symptoms.append(f"[{kind}] {summary}")
    if description.strip():
        symptoms.insert(0, f"[relato] {description.strip()[:200]}")
    return facts, symptoms


def _score_hypothesis(
    text_lower: str, support_terms: list[str], has_objective_evidence: bool
) -> tuple[float, list[str], list[str]]:
    matched = [t for t in support_terms if t in text_lower]
    favorable = [f"termo '{t}' presente no relato/evidencias" for t in matched]
    contrary: list[str] = []
    if not matched:
        contrary.append("nenhum termo caracteristico presente")
    if not has_objective_evidence:
        contrary.append("sem evidencia objetiva anexada (log/saida de comando/metrica)")
    base = 0.2 + 0.2 * min(len(matched), 3)
    if has_objective_evidence and matched:
        base += 0.15
    return round(min(base, 0.85), 2), favorable, contrary


def analyze(
    description: str,
    classification: dict[str, Any],
    entities: ExtractedEntities,
    evidences: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Gera a analise estruturada da secao 3.4."""
    evidences = evidences or []
    category = classification["categoria_principal"]
    severity = classification["severidade"]
    text_lower = (
        description + " " + " ".join(e.get("content", "") for e in evidences)
    ).lower()

    facts, symptoms = _split_facts_and_symptoms(description, evidences)
    has_objective = bool(facts)

    hypotheses: list[dict[str, Any]] = []
    for desc, terms, collection in _HYPOTHESES.get(category, []):
        confidence, favorable, contrary = _score_hypothesis(text_lower, terms, has_objective)
        if confidence > 0.2 or favorable:
            hypotheses.append(
                {
                    "descricao": desc,
                    "confianca": confidence,
                    "evidencias_favoraveis": favorable,
                    "evidencias_contrarias": contrary,
                    "coleta_recomendada": collection,
                }
            )
    hypotheses.sort(key=lambda h: h["confianca"], reverse=True)

    missing: list[str] = []
    if not has_objective:
        missing.append("Evidencia objetiva (logs, saida de comandos ou metricas) do momento da falha")
    if not entities.hostnames and not entities.ips:
        missing.append("Identificacao do servidor afetado (hostname ou IP)")
    if not entities.datas and not entities.horarios:
        missing.append("Data/horario de inicio do problema")
    if category in {Category.OBJECT_STORAGE.value} and not entities.buckets:
        missing.append("Nome do bucket e endpoint utilizados")
    if category in {Category.RAID.value, Category.STORAGE.value} and not entities.discos:
        missing.append("Identificacao dos discos/slots afetados (ex.: /dev/sdb, slot 3)")
    if not evidences:
        missing.append("Acoes ja executadas e seus resultados")

    risks: list[str] = []
    if severity in {"critica", "alta"}:
        risks.append("Risco de indisponibilidade prolongada enquanto a causa nao e isolada")
    if category == Category.RAID.value:
        risks.append("Array degradado: falha de mais um disco pode causar perda de dados — nao remover discos sem orientacao")
        risks.append("Rebuild sob carga intensa pode degradar performance da aplicacao")
    if category == Category.BACKUP.value:
        risks.append("Janela sem backup valido aumenta exposicao a perda de dados")
    if category == Category.DDOS.value:
        risks.append("Mitigacao agressiva pode bloquear trafego legitimo — validar com o cliente")
    if category in {Category.HARDWARE.value, Category.STORAGE.value}:
        risks.append("Intervencao fisica requer janela e backup previamente validados")

    commands = generate_commands(category, description)
    recommendations: list[str] = []
    for i, hyp in enumerate(hypotheses[:3], 1):
        recommendations.append(
            f"{i}. Validar hipotese '{hyp['descricao']}' coletando: {hyp['coleta_recomendada']}"
        )
    if missing:
        recommendations.append(f"{len(recommendations) + 1}. Solicitar ao cliente: {'; '.join(missing[:3])}")
    recommendations.append(
        f"{len(recommendations) + 1}. Executar comandos de diagnostico do catalogo (somente leitura) e anexar as saidas ao chamado"
    )

    needs_escalation = (
        severity == Severity.CRITICA.value
        or category in _ESCALATION_CATEGORIES
        or (severity == Severity.ALTA.value and not has_objective)
    )
    suggested_team = _ESCALATION_CATEGORIES.get(
        category, classification.get("equipe_recomendada", "suporte_n2")
    )

    # Confianca global: reduzida sem evidencias, ancorada na classificacao
    global_confidence = classification.get("confianca", 0.5)
    if not has_objective:
        global_confidence = min(global_confidence, 0.55)
    if missing:
        global_confidence = max(0.1, global_confidence - 0.05 * len(missing))

    top = hypotheses[0]["descricao"] if hypotheses else "em investigacao"
    summary = (
        f"Chamado classificado como '{category}' (severidade {severity}). "
        + (
            f"{len(facts)} fato(s) com evidencia objetiva e {len(hypotheses)} hipotese(s) em avaliacao; "
            if facts
            else "Sem evidencias objetivas anexadas ate o momento — analise baseada em relato; "
        )
        + f"hipotese mais provavel: {top}. "
        + ("Causa raiz NAO confirmada — pendente de evidencias." if not facts else
           "Causa raiz sera confirmada apos validacao das hipoteses com as evidencias coletadas.")
    )

    return {
        "resumo_executivo": summary,
        "sintomas": symptoms,
        "fatos_confirmados": facts,
        "hipoteses": hypotheses,
        "informacoes_ausentes": missing,
        "riscos": risks,
        "acoes_recomendadas": recommendations,
        "comandos_diagnostico": commands,
        "criterios_de_sucesso": [
            "Servico/recurso operando normalmente, validado com o cliente",
            "Evidencias da correcao anexadas ao chamado",
            "Monitoramento estavel por periodo acordado apos a correcao",
        ],
        "necessita_escalonamento": needs_escalation,
        "equipe_sugerida": suggested_team,
        "confianca_global": round(global_confidence, 4),
        "salvaguardas": [
            "Nenhuma causa raiz e afirmada sem evidencia objetiva",
            "Comandos sugeridos sao somente leitura/diagnostico",
            "Acoes de risco exigem backup, janela e rollback (ver politica no catalogo de comandos)",
        ],
    }
