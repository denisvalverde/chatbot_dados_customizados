"""Gerador de DADOS SINTETICOS de chamados de suporte em portugues.

IMPORTANTE: os dados gerados por este script sao SINTETICOS, criados a
partir de templates com variacoes aleatorias. Eles existem apenas para
permitir a execucao inicial do projeto. Substitua por dados reais em
``data/raw/`` quando disponiveis (mesmo esquema: colunas ``texto`` e
``categoria``).

Uso:
    python scripts/generate_sample_data.py --rows 3000 --output data/sample/tickets.csv
"""

from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.utils.logger import get_logger  # noqa: E402

logger = get_logger("generate_sample_data")

TEMPLATES: dict[str, list[str]] = {
    "hardware": [
        "meu {equip} nao liga desde {tempo}",
        "o {equip} esta fazendo barulho estranho e {sintoma}",
        "tela do {equip} ficou {defeito} depois da atualizacao",
        "preciso trocar o teclado do {equip}, varias teclas {sintoma}",
        "o {equip} desliga sozinho quando {contexto}",
        "solicitacao de novo {equip} pois o atual esta {defeito}",
        "impressora do setor {setor} esta {defeito} e nao imprime nada",
        "monitor {defeito}, aparecem listras na tela do {equip}",
    ],
    "software": [
        "o sistema {sistema} apresenta erro ao {acao}",
        "nao consigo instalar o {sistema} no meu computador",
        "o {sistema} trava toda vez que tento {acao}",
        "atualizacao do {sistema} falhou com mensagem de erro",
        "planilha corrompida ao salvar no {sistema}",
        "erro de licenca ao abrir o {sistema} hoje de manha",
        "o {sistema} esta muito lento para {acao} desde {tempo}",
        "preciso de uma nova versao do {sistema} para {acao}",
    ],
    "rede": [
        "internet do setor {setor} esta caindo toda hora",
        "sem conexao com a rede wifi desde {tempo}",
        "vpn nao conecta quando estou {contexto}",
        "rede muito lenta para acessar o servidor de arquivos",
        "cabo de rede da estacao {setor} parece rompido, sem acesso",
        "nao consigo acessar sites externos, so a intranet funciona",
        "queda de conexao intermitente durante videoconferencias",
        "ponto de rede novo para a sala do setor {setor}",
    ],
    "acesso": [
        "esqueci minha senha do {sistema} e nao consigo redefinir",
        "minha conta foi bloqueada apos varias tentativas de login",
        "preciso de permissao para acessar a pasta do setor {setor}",
        "nao consigo fazer login no {sistema} desde {tempo}",
        "solicitacao de criacao de usuario para novo colaborador",
        "acesso negado ao relatorio gerencial no {sistema}",
        "token de autenticacao expirado, preciso de novo acesso",
        "remover acesso de ex funcionario do setor {setor}",
    ],
    "financeiro": [
        "cobranca duplicada na fatura de {tempo}",
        "nota fiscal emitida com valor errado para o cliente",
        "pagamento nao registrado no sistema {sistema}",
        "solicitacao de reembolso de despesa do setor {setor}",
        "divergencia no fechamento contabil de {tempo}",
        "boleto vencido nao atualiza no portal financeiro",
        "erro no calculo de impostos da ultima fatura",
        "relatorio de despesas nao bate com o extrato de {tempo}",
    ],
    "outros": [
        "duvida sobre o horario de atendimento do suporte",
        "sugestao de melhoria para o portal do colaborador",
        "solicitacao de treinamento para a equipe do setor {setor}",
        "informacao sobre a politica de home office",
        "agendamento de sala de reuniao nao esta funcionando",
        "duvida sobre como abrir chamado de {tema}",
        "pedido de material de escritorio para o setor {setor}",
        "elogio ao atendimento recebido em {tempo}",
    ],
}

FILLERS: dict[str, list[str]] = {
    "equip": ["notebook", "desktop", "servidor", "monitor", "no-break", "scanner"],
    "tempo": ["ontem", "hoje cedo", "segunda-feira", "semana passada", "este mes"],
    "sintoma": ["nao respondem", "falham as vezes", "param de funcionar", "travam"],
    "defeito": ["queimado", "com defeito", "piscando", "sem imagem", "inoperante"],
    "contexto": ["em home office", "na reuniao", "rodando relatorios", "em viagem"],
    "setor": ["financeiro", "rh", "comercial", "engenharia", "juridico", "ti"],
    "sistema": ["erp", "crm", "sistema de ponto", "office", "portal interno", "e-mail"],
    "acao": ["gerar relatorio", "salvar documentos", "exportar dados", "abrir anexos"],
    "tema": ["ferias", "beneficios", "equipamentos", "reembolso"],
}

PREFIXES = ["", "bom dia, ", "boa tarde, ", "urgente: ", "por favor, ", "ola, "]
SUFFIXES = ["", " aguardo retorno", " podem verificar?", " obrigado", " com urgencia"]


def _fill(template: str, rng: random.Random) -> str:
    """Substitui os placeholders do template por valores aleatorios."""
    text = template
    for key, options in FILLERS.items():
        while "{" + key + "}" in text:
            text = text.replace("{" + key + "}", rng.choice(options), 1)
    return rng.choice(PREFIXES) + text + rng.choice(SUFFIXES)


def generate_dataset(rows: int, seed: int = 42, dirty_fraction: float = 0.02) -> pd.DataFrame:
    """Gera o dataset sintetico.

    ``dirty_fraction`` insere uma pequena fracao de duplicatas e valores
    ausentes de proposito, para exercitar o pipeline de validacao.
    """
    rng = random.Random(seed)
    categories = list(TEMPLATES.keys())
    records: list[dict[str, object]] = []
    for _ in range(rows):
        category = rng.choice(categories)
        template = rng.choice(TEMPLATES[category])
        records.append({"texto": _fill(template, rng), "categoria": category})

    df = pd.DataFrame(records)
    n_dirty = int(rows * dirty_fraction)
    if n_dirty > 0:
        duplicates = df.sample(n=n_dirty, random_state=seed)
        missing = pd.DataFrame(
            {"texto": [None] * n_dirty, "categoria": [rng.choice(categories) for _ in range(n_dirty)]}
        )
        df = pd.concat([df, duplicates, missing], ignore_index=True)
        df = df.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    return df


def main() -> None:
    """Ponto de entrada do gerador."""
    parser = argparse.ArgumentParser(description="Gera dados sinteticos de chamados.")
    parser.add_argument("--rows", type=int, default=3000, help="Numero de registros")
    parser.add_argument("--seed", type=int, default=42, help="Seed de aleatoriedade")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/sample/tickets.csv"),
        help="Arquivo CSV de saida",
    )
    args = parser.parse_args()

    df = generate_dataset(rows=args.rows, seed=args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.output, index=False)
    logger.info(
        "Dataset SINTETICO gerado: %d registros em %s (classes: %s)",
        len(df),
        args.output,
        sorted(TEMPLATES.keys()),
    )


if __name__ == "__main__":
    main()
