"""Gera uma imagem da rede neural treinada (neuronios e conexoes).

Le o modelo salvo em artifacts/models e desenha a arquitetura real
(numero de entradas, camadas ocultas e classes), salvando em
artifacts/plots/network_architecture.png.

Uso:
    python scripts/visualize_network.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from src.config import load_config  # noqa: E402
from src.inference.predictor import Predictor  # noqa: E402
from src.models.model_factory import count_parameters  # noqa: E402
from src.utils.exceptions import ModelNotFoundError  # noqa: E402
from src.utils.logger import get_logger  # noqa: E402

logger = get_logger("visualize_network")

MAX_DRAWN = {0: 16, 1: 12, 2: 9}  # bolinhas desenhadas por camada (entrada/ocultas)


def draw_network(
    input_dim: int,
    hidden_dims: list[int],
    classes: list[str],
    total_params: int,
    out_path: Path,
) -> None:
    """Desenha o diagrama de neuronios e conexoes da rede."""
    sizes = [input_dim, *hidden_dims, len(classes)]
    n_layers = len(sizes)
    xs = np.linspace(0.0, 3.3 * (n_layers - 1), n_layers)

    fig, ax = plt.subplots(figsize=(14, 9))
    fig.patch.set_facecolor("#0d1117")
    ax.set_facecolor("#0d1117")
    ax.set_xlim(xs[0] - 0.6, xs[-1] + 2.2)
    ax.set_ylim(-1.7, 9.2)
    ax.axis("off")

    coords: list[tuple[float, list[float]]] = []
    for i, (x, size) in enumerate(zip(xs, sizes)):
        ndraw = min(size, MAX_DRAWN.get(i, 9)) if i < n_layers - 1 else size
        positions = list(np.linspace(8.2, 0.0, ndraw))
        if size > ndraw:  # abre um vao no meio para as reticencias
            mid = ndraw // 2
            positions = [p + 0.35 if k < mid else p - 0.35 for k, p in enumerate(positions)]
        coords.append((x, positions))

    for (x0, ys0), (x1, ys1) in zip(coords, coords[1:]):
        for y0 in ys0:
            for y1 in ys1:
                ax.plot([x0, x1], [y0, y1], color="#3d5a80", lw=0.35, alpha=0.5, zorder=1)

    colors = ["#4fc3f7"] + ["#ce93d8"] * len(hidden_dims) + ["#81c784"]
    for (x, positions), size, color in zip(coords, sizes, colors):
        for y in positions:
            ax.scatter(x, y, s=260, color=color, edgecolors="white", linewidths=0.9, zorder=3)
        if size > len(positions):
            ax.text(x, 4.1, "...", color="white", fontsize=18, ha="center",
                    va="center", weight="bold", zorder=4)

    for name, y in zip(classes, coords[-1][1]):
        ax.text(xs[-1] + 0.35, y, name, color="#a5d6a7", fontsize=11.5,
                va="center", weight="bold")

    labels = [f"Entrada\n{input_dim} neuronios\n(vetor TF-IDF)"]
    labels += [
        f"Camada oculta {k + 1}\n{h} neuronios\nReLU + BatchNorm + Dropout"
        for k, h in enumerate(hidden_dims)
    ]
    labels += [f"Saida\n{len(classes)} neuronios\n(softmax)"]
    for (x, _), label in zip(coords, labels):
        ax.text(x, -1.0, label, color="#e6edf3", fontsize=9.8, ha="center", va="center")

    mid_x = (xs[0] + xs[-1]) / 2
    ax.text(mid_x, 9.0, "Rede neural treinada - MLPClassifier (PyTorch)",
            color="white", fontsize=16, weight="bold", ha="center")
    ax.text(mid_x, 8.55,
            f"{total_params:,} conexoes (pesos) treinadas  |  "
            "desenho mostra apenas parte dos neuronios de cada camada".replace(",", "."),
            color="#8b949e", fontsize=9.5, ha="center")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def main() -> None:
    """Carrega o modelo treinado, imprime a estrutura e gera a imagem."""
    config = load_config()
    models_dir = config.resolve_path(config.paths.models_dir)
    try:
        predictor = Predictor.from_artifacts(models_dir)
    except ModelNotFoundError as exc:
        print(f"ERRO: {exc}")
        print("Treine primeiro: python scripts/train.py --data data/sample/tickets.csv")
        sys.exit(1)

    model = predictor.model
    hidden_dims = [
        layer.out_features
        for layer in model.network
        if layer.__class__.__name__ == "Linear"
    ][:-1]

    print("\nEstrutura da rede (camada por camada):\n")
    print(model)
    total = count_parameters(model)
    print(f"\nTotal de parametros treinaveis: {total:,}".replace(",", "."))

    out_path = config.resolve_path(config.paths.plots_dir) / "network_architecture.png"
    draw_network(model.input_dim, hidden_dims, predictor.preprocessor.classes, total, out_path)
    print(f"\nImagem da rede salva em: {out_path}")
    print("Abra com: Invoke-Item artifacts\\plots\\network_architecture.png  (Windows)")
    print("      ou: xdg-open artifacts/plots/network_architecture.png      (Linux)")


if __name__ == "__main__":
    main()
