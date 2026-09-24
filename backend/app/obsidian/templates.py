"""Templates Jinja2 para cada tipo de nota do vault (secao 2.2 do prompt).

Cada nota carrega frontmatter YAML (id, tipo, tags) e wikilinks Markdown
([[Nota]]) para as entidades relacionadas — sao esses links que fazem o
Graph View do Obsidian mostrar uma teia de conexoes real, nao decorativa.
"""

from __future__ import annotations

from typing import Any

from jinja2 import Environment

from app.obsidian.vault import slugify

_env = Environment(trim_blocks=True, lstrip_blocks=True, autoescape=False)


def wikilink(name: str) -> str:
    """Formata um wikilink do Obsidian a partir de um rotulo livre."""
    clean = (name or "").strip()
    return f"[[{clean}]]" if clean else ""


def note_path(folder: str, note_id: str, title: str) -> str:
    """Caminho relativo estavel: pasta/Id-titulo-sanitizado.md."""
    return f"{folder}/{note_id}-{slugify(title)}.md"


def _frontmatter(fields: dict[str, Any]) -> str:
    lines = ["---"]
    for key, value in fields.items():
        if isinstance(value, list):
            if not value:
                lines.append(f"{key}: []")
            else:
                lines.append(f"{key}:")
                lines.extend(f"  - {item}" for item in value)
        elif isinstance(value, bool):
            lines.append(f"{key}: {str(value).lower()}")
        else:
            text = str(value).replace('"', "'")
            lines.append(f'{key}: "{text}"')
    lines.append("---")
    return "\n".join(lines)


_TICKET_TEMPLATE = _env.from_string(
    """{{ frontmatter }}

# {{ title }}

{{ description }}

## Classificacao
- Categoria: {{ categoria_link }}
- Subcategoria: {{ subcategoria }}
- Severidade: **{{ severidade }}** | Urgencia: {{ urgencia }} | Impacto: {{ impacto }}
- Equipe responsavel: {{ equipe_link }}
- Status: {{ status }}
{% if tecnologia_links %}
## Tecnologias
{% for link in tecnologia_links %}- {{ link }}
{% endfor %}
{% endif %}
{% if analise_links %}
## Analises relacionadas
{% for link in analise_links %}- {{ link }}
{% endfor %}
{% endif %}

---
*Chamado #{{ id }} — atualizado em {{ atualizado_em }}*
"""
)

_ANALYSIS_TEMPLATE = _env.from_string(
    """{{ frontmatter }}

# Analise #{{ id }}
{% if ticket_link %}
Chamado: {{ ticket_link }}
{% endif %}

## Resumo executivo
{{ summary }}

Confianca global: **{{ confidence_pct }}%**

## Fatos confirmados
{% if facts %}
{% for f in facts %}- {{ f }}
{% endfor %}
{% else %}
*Nenhum fato com evidencia objetiva ate o momento.*
{% endif %}

## Hipoteses (nao confirmadas)
{% if hypotheses %}
{% for h in hypotheses %}- **{{ h.descricao }}** (confianca {{ (h.confianca * 100) | round | int }}%)
{% endfor %}
{% else %}
*Nenhuma hipotese registrada.*
{% endif %}

## Informacoes ausentes
{% if missing %}
{% for m in missing %}- {{ m }}
{% endfor %}
{% else %}
*Nenhuma.*
{% endif %}

## Riscos
{% if risks %}
{% for r in risks %}- {{ r }}
{% endfor %}
{% else %}
*Nenhum risco relevante mapeado.*
{% endif %}

## Categoria e tecnologias
- Categoria: {{ categoria_link }}
{% for link in tecnologia_links %}- {{ link }}
{% endfor %}

{% if similar_links %}
## Casos e documentos relacionados
{% for link in similar_links %}- {{ link }}
{% endfor %}
{% endif %}

---
*Gerada em {{ criado_em }} | modelo: {{ model_version }}*
"""
)

_KNOWLEDGE_TEMPLATE = _env.from_string(
    """{{ frontmatter }}

# {{ title }}

{{ content }}

## Metadados
- Categoria: {{ categoria_link }}
{% for link in tecnologia_links %}- {{ link }}
{% endfor %}
- Aprovado: {{ "sim" if approved else "nao" }}
- Taxa de sucesso registrada: {{ (success_score * 100) | round | int }}%

---
*Documento #{{ id }} ({{ document_type }}) | fonte: {{ source or "n/a" }}*
"""
)

_HUB_TEMPLATE = _env.from_string(
    """{{ frontmatter }}

# {{ title }}

{% if description %}{{ description }}

{% endif %}
{% if ticket_links %}
## Chamados
{% for link in ticket_links %}- {{ link }}
{% endfor %}
{% endif %}
{% if knowledge_links %}
## Documentos de conhecimento
{% for link in knowledge_links %}- {{ link }}
{% endfor %}
{% endif %}
"""
)

_MODEL_VERSION_TEMPLATE = _env.from_string(
    """{{ frontmatter }}

# Versao de modelo #{{ id }} — {{ name }}

- Status: **{{ status }}**
- Treinado em: {{ criado_em }}
- Pronto para producao: {{ "sim" if production_ready else "NAO (dados sinteticos)" }}

## Metricas
```json
{{ metrics_json }}
```

Ver arquitetura da rede: [[Arquitetura-Rede-Neural]]
"""
)


def render_ticket_note(ticket: dict[str, Any], analysis_ids: list[int]) -> tuple[str, str]:
    """Renderiza a nota de um Ticket. Retorna (caminho_relativo, conteudo)."""
    note_id = f"Chamado-{ticket['id']}"
    front = _frontmatter(
        {
            "id": ticket["id"],
            "tipo": "chamado",
            "categoria": ticket.get("category", ""),
            "severidade": ticket.get("severity", ""),
            "status": ticket.get("status", ""),
            "tags": ["chamado", ticket.get("category", "sem-categoria")],
        }
    )
    content = _TICKET_TEMPLATE.render(
        frontmatter=front,
        id=ticket["id"],
        title=ticket.get("title", f"Chamado {ticket['id']}"),
        description=ticket.get("description", "").strip() or "*Sem descricao.*",
        categoria_link=wikilink(ticket.get("category", "") or "Sem categoria"),
        subcategoria=ticket.get("subcategory", "") or "outro",
        severidade=ticket.get("severity", ""),
        urgencia=ticket.get("urgency", ""),
        impacto=ticket.get("impact", ""),
        equipe_link=wikilink(ticket.get("assigned_team", "") or "A definir"),
        status=ticket.get("status", ""),
        tecnologia_links=[wikilink(t) for t in ticket.get("technology", [])],
        analise_links=[wikilink(f"Analise-{aid}") for aid in analysis_ids],
        atualizado_em=str(ticket.get("updated_at", "")),
    )
    return note_path("01-Chamados", note_id, ticket.get("title", str(ticket["id"]))), content


def render_analysis_note(analysis: dict[str, Any]) -> tuple[str, str]:
    """Renderiza a nota de uma Analysis. Retorna (caminho_relativo, conteudo)."""
    note_id = f"Analise-{analysis['id']}"
    classification = analysis.get("classification") or {}
    category = classification.get("categoria_principal", "")
    technologies = classification.get("tecnologia", []) or []
    similar = classification.get("casos_similares", []) or []
    ticket_id = analysis.get("ticket_id")

    front = _frontmatter(
        {
            "id": analysis["id"],
            "tipo": "analise",
            "categoria": category,
            "confianca": analysis.get("confidence", 0.0),
            "tags": ["analise", category or "sem-categoria"],
        }
    )
    content = _ANALYSIS_TEMPLATE.render(
        frontmatter=front,
        id=analysis["id"],
        ticket_link=wikilink(f"Chamado-{ticket_id}") if ticket_id else "",
        summary=analysis.get("summary", ""),
        confidence_pct=round((analysis.get("confidence") or 0.0) * 100),
        facts=analysis.get("facts", []),
        hypotheses=analysis.get("hypotheses", []),
        missing=analysis.get("missing_information", []),
        risks=analysis.get("risks", []),
        categoria_link=wikilink(category or "Sem categoria"),
        tecnologia_links=[wikilink(t) for t in technologies],
        similar_links=[wikilink(s.get("title", "")) for s in similar if s.get("title")],
        criado_em=str(analysis.get("created_at", "")),
        model_version=analysis.get("model_version", ""),
    )
    return note_path("02-Analises", note_id, f"analise-{analysis['id']}"), content


def render_knowledge_note(doc: dict[str, Any]) -> tuple[str, str]:
    """Renderiza a nota de um KnowledgeDocument. Retorna (caminho_relativo, conteudo)."""
    note_id = f"Documento-{doc['id']}"
    subfolder = {
        "rca": "RCA", "gmud": "GMUD", "procedimento": "Procedimentos",
        "solucao": "Solucoes", "chamado_resolvido": "Solucoes",
    }.get(doc.get("document_type", ""), "Solucoes")

    front = _frontmatter(
        {
            "id": doc["id"],
            "tipo": doc.get("document_type", ""),
            "categoria": doc.get("category", ""),
            "aprovado": bool(doc.get("approved", False)),
            "tags": ["conhecimento", doc.get("document_type", ""), doc.get("category", "")],
        }
    )
    content = _KNOWLEDGE_TEMPLATE.render(
        frontmatter=front,
        id=doc["id"],
        title=doc.get("title", f"Documento {doc['id']}"),
        content=doc.get("content", ""),
        categoria_link=wikilink(doc.get("category", "") or "Sem categoria"),
        tecnologia_links=[wikilink(t) for t in doc.get("technology", [])],
        approved=bool(doc.get("approved", False)),
        success_score=float(doc.get("success_score", 0.0)),
        document_type=doc.get("document_type", ""),
        source=doc.get("source", ""),
    )
    return (
        note_path(f"03-Base-de-Conhecimento/{subfolder}", note_id, doc.get("title", str(doc["id"]))),
        content,
    )


def render_hub_note(
    kind: str,
    name: str,
    ticket_titles: list[tuple[int, str]],
    knowledge_titles: list[tuple[int, str]],
) -> tuple[str, str]:
    """Nota-hub de Categoria ou Tecnologia, agregando o que ja foi exportado."""
    folder = "04-Categorias" if kind == "categoria" else "05-Tecnologias"
    front = _frontmatter({"tipo": f"hub-{kind}", "tags": [kind, "hub"]})
    content = _HUB_TEMPLATE.render(
        frontmatter=front,
        title=name,
        description=f"Nota central de {kind}: {name}.",
        ticket_links=[wikilink(f"Chamado-{tid}") for tid, _ in ticket_titles],
        knowledge_links=[wikilink(f"Documento-{did}") for did, _ in knowledge_titles],
    )
    return f"{folder}/{name}.md", content


def render_model_version_note(version: dict[str, Any]) -> tuple[str, str]:
    """Nota de uma ModelVersion treinada, linkando para a arquitetura."""
    import json as _json

    note_id = f"Modelo-{version['id']}"
    metrics = version.get("metrics") or {}
    front = _frontmatter({"id": version["id"], "tipo": "modelo-ml", "status": version.get("status", "")})
    content = _MODEL_VERSION_TEMPLATE.render(
        frontmatter=front,
        id=version["id"],
        name=version.get("name", ""),
        status=version.get("status", ""),
        criado_em=str(version.get("created_at", "")),
        production_ready=bool(metrics.get("is_production_ready", False)),
        metrics_json=_json.dumps(metrics, indent=2, ensure_ascii=False),
    )
    return note_path("06-Machine-Learning/Versoes-de-Modelo", note_id, version.get("name", "modelo")), content
