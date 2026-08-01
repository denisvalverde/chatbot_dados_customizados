"""Chat interativo com a rede neural no terminal.

Digite um chamado de suporte e veja a classificacao ao vivo, com a
confianca e a probabilidade de cada categoria. Digite 'sair' para encerrar.

Uso:
    python scripts/chat.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import load_config  # noqa: E402
from src.inference.predictor import Predictor  # noqa: E402
from src.utils.exceptions import ModelNotFoundError  # noqa: E402

BAR_WIDTH = 30


def _print_prediction(predictor: Predictor, text: str) -> None:
    """Classifica o texto e imprime o resultado com barras de probabilidade."""
    result = predictor.predict(text)
    print(f"\n  Categoria: {result.label.upper()}  (confianca: {result.confidence:.2%})\n")
    ranked = sorted(result.probabilities.items(), key=lambda item: item[1], reverse=True)
    for name, prob in ranked:
        bar = "#" * max(1, round(prob * BAR_WIDTH)) if prob >= 0.005 else ""
        print(f"  {name:<12} {prob:7.2%}  {bar}")
    print()


def main() -> None:
    """Carrega o modelo e entra no laco de conversa."""
    config = load_config()
    models_dir = config.resolve_path(config.paths.models_dir)
    print("Carregando a rede neural (aguarde alguns segundos)...")
    try:
        predictor = Predictor.from_artifacts(models_dir)
    except ModelNotFoundError as exc:
        print(f"\nERRO: {exc}")
        print("Treine primeiro: python scripts/train.py --data data/sample/tickets.csv")
        sys.exit(1)

    info = predictor.info()
    print(
        f"\nRede carregada (versao {info['model_version']}, "
        f"{info['num_classes']} categorias: {', '.join(info['classes'])})."
    )
    print("Digite um chamado de suporte e pressione Enter. Digite 'sair' para encerrar.\n")

    while True:
        try:
            text = input("Voce> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nAte mais!")
            break
        if not text:
            continue
        if text.lower() in {"sair", "exit", "quit"}:
            print("Ate mais!")
            break
        if len(text) < 5:
            print("  (texto muito curto - escreva ao menos 5 caracteres)\n")
            continue
        _print_prediction(predictor, text)


if __name__ == "__main__":
    main()
