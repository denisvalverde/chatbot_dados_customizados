"""Geracao de comunicacao profissional por tipo e publico (secao 3.6).

Gerador local baseado em templates estruturados (fallback sem LLM). Quando um
LLM externo esta configurado, o texto destes templates serve de rascunho
para enriquecimento — nunca para inventar fatos.
"""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import BaseModel, Field

from app.domain.enums import Audience, MessageKind


class CommunicationRequest(BaseModel):
    """Entrada para geracao de comunicacao."""

    kind: MessageKind
    audience: Audience = Audience.CLIENTE_TECNICO
    ticket_ref: str = ""
    customer: str = ""
    subject: str = ""
    summary: str = ""
    facts: list[str] = Field(default_factory=list)
    hypotheses: list[str] = Field(default_factory=list)
    actions_taken: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    missing_info: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    timeline: list[dict] = Field(default_factory=list)  # [{"quando": "", "o_que": ""}]
    team: str = ""


def _greeting(audience: Audience, customer: str) -> str:
    name = customer or "cliente"
    if audience in {Audience.CLIENTE_TECNICO, Audience.CLIENTE_NAO_TECNICO}:
        return f"Prezado(a) {name},"
    if audience in {Audience.DIRETORIA, Audience.EXECUTIVO, Audience.GESTAO}:
        return "Prezados,"
    return f"Equipe {audience.value.replace('_', ' ')},"


def _closing(audience: Audience) -> str:
    if audience in {Audience.CLIENTE_TECNICO, Audience.CLIENTE_NAO_TECNICO}:
        return "Permanecemos a disposicao.\n\nAtenciosamente,\nEquipe de Suporte Tecnico"
    return "Atenciosamente,\nEquipe de Suporte Tecnico"


def _bullets(items: list[str], empty: str = "") -> str:
    if not items:
        return empty
    return "\n".join(f"- {item}" for item in items)


def _simplify_for_audience(text: str, audience: Audience) -> str:
    """Para publicos nao tecnicos, evita jargao pesado nas frases padrao."""
    if audience in {Audience.CLIENTE_NAO_TECNICO, Audience.DIRETORIA, Audience.FINANCEIRO}:
        replacements = {
            "rebuild": "reconstrucao do espelhamento de discos",
            "datastore": "area de armazenamento",
            "failover": "acionamento do ambiente reserva",
        }
        for term, plain in replacements.items():
            text = text.replace(term, plain)
    return text


def generate_message(req: CommunicationRequest) -> dict:
    """Gera a comunicacao solicitada. Retorna corpo + metadados."""
    ref = f" [{req.ticket_ref}]" if req.ticket_ref else ""
    now = datetime.now(UTC).strftime("%d/%m/%Y %H:%M UTC")
    g = _greeting(req.audience, req.customer)
    c = _closing(req.audience)
    body: str

    if req.kind == MessageKind.RESPOSTA_INICIAL:
        body = (
            f"{g}\n\nConfirmamos o recebimento do chamado{ref} referente a: {req.subject or req.summary}.\n\n"
            f"Nossa equipe iniciou a analise. Situacao atual:\n{_bullets(req.facts, '- Em levantamento inicial de informacoes.')}\n\n"
            + (f"Para agilizar o diagnostico, solicitamos:\n{_bullets(req.missing_info)}\n\n" if req.missing_info else "")
            + f"Manteremos este chamado atualizado a cada avanco relevante.\n\n{c}"
        )
    elif req.kind == MessageKind.ATUALIZACAO_PARCIAL:
        body = (
            f"{g}\n\nSegue atualizacao do chamado{ref}.\n\n"
            f"O que foi verificado ate o momento:\n{_bullets(req.actions_taken, '- Analise em andamento.')}\n\n"
            f"Fatos confirmados:\n{_bullets(req.facts, '- Nenhum fato adicional confirmado nesta janela.')}\n\n"
            f"Proximos passos:\n{_bullets(req.next_steps, '- Continuidade da investigacao.')}\n\n{c}"
        )
    elif req.kind == MessageKind.SOLICITACAO_EVIDENCIAS:
        body = (
            f"{g}\n\nPara dar continuidade ao diagnostico do chamado{ref}, precisamos das seguintes informacoes/evidencias:\n\n"
            f"{_bullets(req.missing_info, '- Detalhes adicionais do cenario.')}\n\n"
            f"Assim que recebermos os itens acima, seguiremos imediatamente com a analise.\n\n{c}"
        )
    elif req.kind == MessageKind.SOLICITACAO_JANELA:
        body = (
            f"{g}\n\nPara executar a proxima etapa do chamado{ref} com seguranca, solicitamos a definicao de uma "
            f"janela de manutencao.\n\nAtividade prevista:\n{_bullets(req.next_steps, '- Intervencao tecnica planejada.')}\n\n"
            f"Riscos mapeados e mitigacoes:\n{_bullets(req.risks, '- Riscos baixos; plano de rollback preparado.')}\n\n"
            f"Por favor, indiquem data e horario de menor impacto para a operacao.\n\n{c}"
        )
    elif req.kind == MessageKind.SOLICITACAO_BACKUP:
        body = (
            f"{g}\n\nAntes de prosseguir com as acoes do chamado{ref}, e obrigatorio garantir backup atualizado e validado.\n\n"
            f"Itens a proteger:\n{_bullets(req.next_steps, '- Dados do ambiente afetado.')}\n\n"
            f"Por favor, confirmem a existencia de backup recente ou autorizem a execucao de um novo backup antes da intervencao.\n\n{c}"
        )
    elif req.kind == MessageKind.ESCALONAMENTO:
        body = (
            f"{g}\n\nO chamado{ref} esta sendo escalonado para a equipe {req.team or 'especializada'}.\n\n"
            f"Resumo do cenario:\n{req.summary}\n\n"
            f"Fatos confirmados:\n{_bullets(req.facts, '- Ver detalhes no chamado.')}\n\n"
            f"Hipoteses em aberto:\n{_bullets(req.hypotheses, '- Nenhuma hipotese descartada ate o momento.')}\n\n"
            f"Acoes ja executadas:\n{_bullets(req.actions_taken, '- Triagem inicial.')}\n\n"
            f"Pendencias/informacoes ausentes:\n{_bullets(req.missing_info, '- Nenhuma.')}\n\n{c}"
        )
    elif req.kind == MessageKind.DEVOLUTIVA_TECNICA:
        body = (
            f"{g}\n\nSegue devolutiva tecnica do chamado{ref}.\n\n"
            f"Resumo: {req.summary}\n\n"
            f"Fatos confirmados (com evidencias):\n{_bullets(req.facts, '- Nenhum fato confirmado ate o momento.')}\n\n"
            f"Hipoteses (nao confirmadas):\n{_bullets(req.hypotheses, '- Nenhuma.')}\n\n"
            f"Recomendacoes:\n{_bullets(req.next_steps, '- Aguardando novas evidencias.')}\n\n{c}"
        )
    elif req.kind == MessageKind.ENCERRAMENTO:
        body = (
            f"{g}\n\nInformamos a conclusao do chamado{ref}.\n\n"
            f"Resumo do atendimento: {req.summary}\n\n"
            f"Acoes realizadas:\n{_bullets(req.actions_taken, '- Ver historico do chamado.')}\n\n"
            f"Validacao: a solucao foi verificada conforme os criterios registrados no chamado. "
            f"Caso o comportamento se repita, basta reabrir este chamado ou abrir um novo referenciando{ref or ' o numero original'}.\n\n{c}"
        )
    elif req.kind == MessageKind.CONVITE_AVALIACAO:
        body = (
            f"{g}\n\nSeu chamado{ref} foi concluido. Sua opiniao e muito importante para melhorarmos continuamente: "
            f"por favor, dedique um minuto para avaliar o atendimento recebido.\n\n{c}"
        )
    elif req.kind == MessageKind.PLANO_DE_ACAO:
        steps = req.next_steps or ["Definir acoes com a equipe responsavel."]
        numbered = "\n".join(
            f"{i}. {s} | Responsavel: {req.team or 'a definir'} | Prazo: a definir"
            for i, s in enumerate(steps, 1)
        )
        body = (
            f"PLANO DE ACAO — Chamado{ref}\nData: {now}\n\n"
            f"Objetivo: {req.summary or req.subject}\n\n"
            f"Acoes:\n{numbered}\n\n"
            f"Riscos e mitigacoes:\n{_bullets(req.risks, '- Nenhum risco relevante mapeado.')}\n\n"
            f"Criterios de sucesso:\n{_bullets(req.facts, '- Restabelecimento validado pelo cliente.')}"
        )
    elif req.kind == MessageKind.CRONOLOGIA:
        lines = [
            f"- {item.get('quando', 's/ data')}: {item.get('o_que', '')}" for item in req.timeline
        ] or ["- Sem eventos registrados."]
        body = f"CRONOLOGIA — Chamado{ref}\nGerada em: {now}\n\n" + "\n".join(lines)
    elif req.kind == MessageKind.GMUD:
        body = (
            f"GMUD — {req.subject or req.summary}\nReferencia: {req.ticket_ref or 'N/A'} | Data de emissao: {now}\n\n"
            f"1. OBJETIVO\n{req.summary}\n\n"
            f"2. JUSTIFICATIVA\n{_bullets(req.facts, '- Ver analise tecnica do chamado.')}\n\n"
            f"3. ATIVIDADES PLANEJADAS\n{_bullets(req.next_steps, '- A detalhar.')}\n\n"
            f"4. RISCOS E MITIGACOES\n{_bullets(req.risks, '- Riscos baixos.')}\n\n"
            f"5. PLANO DE ROLLBACK\n- Interromper a atividade e restaurar o estado anterior a partir do backup validado.\n"
            f"- Registrar o motivo do rollback e comunicar as partes interessadas.\n\n"
            f"6. PRE-REQUISITOS\n- Backup validado.\n- Janela de manutencao aprovada.\n- Comunicacao previa ao cliente.\n\n"
            f"7. CRITERIOS DE SUCESSO\n- Servico operando normalmente apos a mudanca, validado com o cliente."
        )
    elif req.kind == MessageKind.RCA:
        body = (
            f"ANALISE DE CAUSA RAIZ (RCA) — Chamado{ref}\nData: {now}\n\n"
            f"1. RESUMO DO INCIDENTE\n{req.summary}\n\n"
            f"2. LINHA DO TEMPO\n" + (
                "\n".join(f"- {i.get('quando', '')}: {i.get('o_que', '')}" for i in req.timeline)
                or "- A consolidar."
            ) + "\n\n"
            f"3. FATOS CONFIRMADOS (com evidencias)\n{_bullets(req.facts, '- A consolidar.')}\n\n"
            f"4. HIPOTESES AVALIADAS\n{_bullets(req.hypotheses, '- A consolidar.')}\n\n"
            f"5. CAUSA RAIZ\n"
            + (
                "- Indeterminada ate a conclusao da coleta de evidencias. "
                "Este documento NAO afirma causa raiz sem evidencia suficiente.\n\n"
                if not req.facts
                else "- Conforme fatos confirmados acima, sustentada pelas evidencias anexadas ao chamado.\n\n"
            )
            + f"6. ACOES CORRETIVAS E PREVENTIVAS\n{_bullets(req.next_steps, '- A definir.')}\n\n"
            f"7. LICOES APRENDIDAS\n- A consolidar com as equipes envolvidas."
        )
    elif req.kind == MessageKind.RELATORIO_EXECUTIVO:
        body = (
            f"RELATORIO EXECUTIVO — {req.subject or 'Incidente'}{ref}\nData: {now}\n\n"
            f"SITUACAO: {req.summary}\n\n"
            f"IMPACTO PARA O NEGOCIO:\n{_bullets(req.risks, '- Em avaliacao.')}\n\n"
            f"ACOES EM ANDAMENTO:\n{_bullets(req.next_steps, '- Investigacao tecnica em curso.')}\n\n"
            f"PROXIMA ATUALIZACAO: em ate 2 horas ou mediante fato novo relevante."
        )
    else:  # RELATORIO_TECNICO
        body = (
            f"RELATORIO TECNICO — Chamado{ref}\nData: {now}\n\n"
            f"1. CONTEXTO\n{req.summary}\n\n"
            f"2. FATOS CONFIRMADOS\n{_bullets(req.facts, '- Nenhum.')}\n\n"
            f"3. HIPOTESES\n{_bullets(req.hypotheses, '- Nenhuma.')}\n\n"
            f"4. ACOES EXECUTADAS\n{_bullets(req.actions_taken, '- Nenhuma.')}\n\n"
            f"5. RISCOS\n{_bullets(req.risks, '- Nenhum mapeado.')}\n\n"
            f"6. RECOMENDACOES\n{_bullets(req.next_steps, '- Nenhuma.')}"
        )

    body = _simplify_for_audience(body, req.audience)
    return {
        "tipo": req.kind.value,
        "publico": req.audience.value,
        "corpo": body,
        "gerado_em": now,
        "gerador": "local_templates",
    }
