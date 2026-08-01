"""Exporta o modelo treinado para ONNX (para visualizacao no Netron e deploy).

Gera artifacts/models/model.onnx a partir do best_model.pt. O arquivo pode
ser aberto de forma interativa em https://netron.app (arraste e solte) ou
com o Netron instalado localmente (pip install netron).

Uso:
    python scripts/export_onnx.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import torch  # noqa: E402

from src.config import load_config  # noqa: E402
from src.inference.predictor import Predictor  # noqa: E402
from src.utils.exceptions import ModelNotFoundError  # noqa: E402
from src.utils.logger import get_logger  # noqa: E402

logger = get_logger("export_onnx")


def main() -> None:
    """Carrega o melhor modelo e o exporta para ONNX."""
    config = load_config()
    models_dir = config.resolve_path(config.paths.models_dir)
    try:
        predictor = Predictor.from_artifacts(models_dir)
    except ModelNotFoundError as exc:
        print(f"ERRO: {exc}")
        print("Treine primeiro: python scripts/train.py --data data/sample/tickets.csv")
        sys.exit(1)

    model = predictor.model
    model.eval()
    dummy = torch.zeros(1, model.input_dim, dtype=torch.float32)
    out_path = models_dir / "model.onnx"

    torch.onnx.export(
        model,
        (dummy,),
        str(out_path),
        input_names=["tfidf_vector"],
        output_names=["logits"],
        dynamic_axes={"tfidf_vector": {0: "batch"}, "logits": {0: "batch"}},
        dynamo=False,
    )

    size_kb = out_path.stat().st_size / 1024
    logger.info("Modelo exportado para %s (%.0f KB)", out_path, size_kb)
    print(f"\nModelo ONNX salvo em: {out_path}")
    print("\nPara visualizar de forma interativa:")
    print("  1) Abra https://netron.app no navegador e arraste o arquivo model.onnx; ou")
    print("  2) pip install netron   e depois:   netron artifacts/models/model.onnx")


if __name__ == "__main__":
    main()
