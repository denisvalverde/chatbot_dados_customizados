"""Script de treinamento ponta a ponta.

Uso:
    python scripts/train.py --data data/sample/tickets.csv
    python scripts/train.py --data data/sample/tickets.csv --epochs 5
    python scripts/train.py --data data/sample/tickets.csv --resume
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import AppConfig, load_config  # noqa: E402
from src.data.loader import build_dataloader, load_dataset, save_splits, split_dataset  # noqa: E402
from src.data.preprocessing import TextPreprocessor  # noqa: E402
from src.data.validation import clean_dataframe  # noqa: E402
from src.models.model_factory import build_model  # noqa: E402
from src.training.callbacks import ModelCheckpoint  # noqa: E402
from src.training.evaluator import (  # noqa: E402
    collect_predictions,
    compute_metrics,
    plot_confusion_matrix,
    plot_training_curves,
    save_metrics,
)
from src.training.trainer import Trainer, detect_device  # noqa: E402
from src.utils.logger import get_logger  # noqa: E402
from src.utils.seed import set_seed  # noqa: E402

logger = get_logger("train")


def _maybe_start_mlflow(config: AppConfig) -> object | None:
    """Inicia um run do MLflow se habilitado e instalado (extra opcional)."""
    if not config.mlflow.enabled:
        return None
    try:
        import mlflow
    except ImportError:
        logger.warning("mlflow.enabled=true, mas o pacote mlflow nao esta instalado.")
        return None
    mlflow.set_tracking_uri(config.mlflow.tracking_uri)
    mlflow.set_experiment(config.mlflow.experiment_name)
    run = mlflow.start_run()
    mlflow.log_params(
        {
            "hidden_dims": config.model.hidden_dims,
            "dropout": config.model.dropout,
            "learning_rate": config.training.learning_rate,
            "batch_size": config.training.batch_size,
            "epochs": config.training.epochs,
            "max_features": config.features.max_features,
        }
    )
    return run


def run_training(config: AppConfig, data_path: Path, resume: bool = False) -> dict[str, float]:
    """Executa o pipeline completo: validacao, split, fit, treino e avaliacao."""
    set_seed(config.seed)
    device = detect_device()

    # 1. Carga e validacao
    df = load_dataset(data_path)
    df, report = clean_dataframe(df, config.data)

    # 2. Split ANTES de qualquer fit (evita data leakage)
    splits = split_dataset(df, config.data, seed=config.seed)
    processed_dir = config.resolve_path(config.paths.data_processed)
    save_splits(splits, processed_dir)

    # 3. Pre-processamento ajustado apenas no treino
    text_col, label_col = config.data.text_column, config.data.label_column
    preprocessor = TextPreprocessor(config.features)
    preprocessor.fit(splits.train[text_col], splits.train[label_col])

    x_train = preprocessor.transform_texts(splits.train[text_col])
    y_train = preprocessor.transform_labels(splits.train[label_col])
    x_val = preprocessor.transform_texts(splits.val[text_col])
    y_val = preprocessor.transform_labels(splits.val[label_col])
    x_test = preprocessor.transform_texts(splits.test[text_col])
    y_test = preprocessor.transform_labels(splits.test[label_col])

    train_cfg = config.training
    train_loader = build_dataloader(
        x_train, y_train, train_cfg.batch_size, shuffle=True, num_workers=train_cfg.num_workers
    )
    val_loader = build_dataloader(x_val, y_val, train_cfg.batch_size)
    test_loader = build_dataloader(x_test, y_test, train_cfg.batch_size)

    # 4. Modelo e treinamento
    model = build_model(config.model, preprocessor.input_dim, len(preprocessor.classes))
    models_dir = config.resolve_path(config.paths.models_dir)
    checkpoint = ModelCheckpoint(models_dir)
    checkpoint_extra = {
        "input_dim": preprocessor.input_dim,
        "num_classes": len(preprocessor.classes),
        "hidden_dims": list(config.model.hidden_dims),
        "dropout": config.model.dropout,
        "batch_norm": config.model.batch_norm,
        "classes": preprocessor.classes,
    }
    trainer = Trainer(model, config, checkpoint, device=device, checkpoint_extra=checkpoint_extra)
    if resume:
        trainer.resume()

    mlflow_run = _maybe_start_mlflow(config)
    try:
        history = trainer.fit(train_loader, val_loader)
    finally:
        if mlflow_run is not None:
            import mlflow

            mlflow.end_run()

    # 5. Persistencia do pre-processador (mesmo pipeline na inferencia)
    preprocessor.save(models_dir / "preprocessor.joblib")

    # 6. Avaliacao no teste com o MELHOR modelo
    best_state = checkpoint.load(best=True, map_location=str(device))
    model.load_state_dict(best_state["model_state_dict"])
    y_true, y_pred, y_proba = collect_predictions(model, test_loader, device)
    metrics = compute_metrics(y_true, y_pred, y_proba)
    metrics["validation_report"] = report.as_dict()
    metrics["preprocessing"] = preprocessor.metadata()

    metrics_dir = config.resolve_path(config.paths.metrics_dir)
    plots_dir = config.resolve_path(config.paths.plots_dir)
    save_metrics(metrics, metrics_dir / "test_metrics.json")
    plot_training_curves(history, plots_dir / "training_curves.png")
    plot_confusion_matrix(
        metrics["confusion_matrix"], preprocessor.classes, plots_dir / "confusion_matrix.png"
    )

    logger.info(
        "Treinamento concluido | accuracy=%.4f | f1_macro=%.4f",
        metrics["accuracy"],
        metrics["f1_macro"],
    )
    return {
        "accuracy": metrics["accuracy"],
        "f1_macro": metrics["f1_macro"],
        "precision_macro": metrics["precision_macro"],
        "recall_macro": metrics["recall_macro"],
    }


def main() -> None:
    """Ponto de entrada do treinamento via linha de comando."""
    parser = argparse.ArgumentParser(description="Treina o classificador de chamados.")
    parser.add_argument("--config", type=Path, default=None, help="Caminho do config.yaml")
    parser.add_argument(
        "--data", type=Path, default=Path("data/sample/tickets.csv"), help="CSV de entrada"
    )
    parser.add_argument("--epochs", type=int, default=None, help="Sobrescreve epochs do config")
    parser.add_argument("--resume", action="store_true", help="Retoma do ultimo checkpoint")
    args = parser.parse_args()

    config = load_config(args.config)
    if args.epochs is not None:
        config.training.epochs = args.epochs

    summary = run_training(config, args.data, resume=args.resume)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
