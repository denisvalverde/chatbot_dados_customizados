"""Classificacao hibrida (secao 3.2): regras + rede neural + similaridade.

Fusao: o baseline deterministico (regras) esta sempre disponivel; a rede
neural contribui quando treinada (com peso reduzido se treinada apenas com
dados sinteticos); a busca de similaridade na base historica reforca ou
enfraquece a decisao. A saida segue exatamente o contrato JSON da secao 3.2.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.domain.enums import Impact, Severity, Urgency
from app.ml.infer import get_neural_predictor
from app.services.entity_extraction import extract_entities
from app.services.rules import classify_by_rules

logger = get_logger(__name__)

_URGENCY_BY_SEVERITY = {
    Severity.CRITICA: Urgency.ALTA,
    Severity.ALTA: Urgency.ALTA,
    Severity.MEDIA: Urgency.MEDIA,
    Severity.BAIXA: Urgency.BAIXA,
}
_IMPACT_BY_SEVERITY = {
    Severity.CRITICA: Impact.ALTO,
    Severity.ALTA: Impact.ALTO,
    Severity.MEDIA: Impact.MEDIO,
    Severity.BAIXA: Impact.BAIXO,
}
_RISK_BY_SEVERITY = {
    Severity.CRITICA: "critico",
    Severity.ALTA: "alto",
    Severity.MEDIA: "medio",
    Severity.BAIXA: "baixo",
}


def classify_ticket(db: Session | None, text: str, product: str = "") -> dict[str, Any]:
    """Executa o pipeline hibrido e retorna o contrato da secao 3.2."""
    entities = extract_entities(text)
    rule = classify_by_rules(text)
    evidencias = [f"regras: termos encontrados {rule.matched_terms}"] if rule.matched_terms else []
    sources = [("regras_deterministicas", rule.category.value, rule.confidence, 1.0)]

    neural_info: dict[str, Any] | None = None
    predictor = get_neural_predictor()
    if predictor is not None:
        try:
            neural_info = predictor.predict(text)
            # peso menor quando o modelo so viu dados sinteticos
            weight = 0.5 if predictor.is_synthetic_only else 1.0
            sources.append(
                (
                    "rede_neural",
                    neural_info["categoria"]["valor"],
                    neural_info["categoria"]["confianca"],
                    weight,
                )
            )
            evidencias.append(
                f"rede_neural: categoria={neural_info['categoria']['valor']} "
                f"(conf {neural_info['categoria']['confianca']}, "
                f"{'dados sinteticos' if predictor.is_synthetic_only else 'dados reais'})"
            )
        except Exception as exc:  # rede nunca pode derrubar o fluxo
            logger.warning("Falha na rede neural; seguindo com baseline: %s", exc)

    similar_cases: list[dict[str, Any]] = []
    if db is not None:
        from app.services.rag import search_knowledge

        try:
            similar_cases = search_knowledge(db, text, limit=3)
            if similar_cases:
                top = similar_cases[0]
                if top["category"]:
                    sources.append(("base_historica", top["category"], top["similarity"], 0.6))
                    evidencias.append(
                        f"base_historica: caso similar '{top['title'][:60]}' "
                        f"(sim {top['similarity']})"
                    )
        except Exception as exc:
            logger.warning("Busca de similaridade indisponivel: %s", exc)

    # Fusao por voto ponderado
    votes: dict[str, float] = {}
    for _, category, confidence, weight in sources:
        votes[category] = votes.get(category, 0.0) + confidence * weight
    final_category = max(votes.items(), key=lambda item: item[1])[0]
    total_weight = sum(w for _, _, _, w in sources)
    agreement = votes[final_category] / (total_weight or 1.0)
    confidence = round(min(0.97, agreement), 4)

    severity = rule.severity
    subcategory = rule.subcategory
    team = rule.team.value
    if neural_info and neural_info["categoria"]["valor"] == final_category:
        if neural_info["categoria"]["confianca"] > rule.confidence:
            subcategory = neural_info["subcategoria"]["valor"]
            team = neural_info["equipe"]["valor"]

    justificativa = (
        f"Categoria '{final_category}' definida por fusao ponderada de "
        f"{len(sources)} fonte(s): "
        + "; ".join(f"{name}->{cat} ({conf:.2f})" for name, cat, conf, _ in sources)
    )

    return {
        "categoria_principal": final_category,
        "subcategoria": subcategory,
        "produto": product,
        "tecnologia": entities.tecnologias,
        "severidade": severity.value,
        "urgencia": _URGENCY_BY_SEVERITY[severity].value,
        "impacto": _IMPACT_BY_SEVERITY[severity].value,
        "risco": _RISK_BY_SEVERITY[severity],
        "equipe_recomendada": team,
        "confianca": confidence,
        "justificativa": justificativa,
        "evidencias_utilizadas": evidencias,
        "fontes": [
            {"fonte": name, "categoria": cat, "confianca": round(conf, 4)}
            for name, cat, conf, _ in sources
        ],
        "casos_similares": [
            {k: c[k] for k in ("id", "title", "similarity", "score")} for c in similar_cases
        ],
        "entidades": entities.model_dump(),
    }
