.PHONY: install dev test lint format migrate seed ingest train evaluate export-onnx docker-up docker-down

VENV := .venv/bin

install:
	python3 -m venv .venv
	$(VENV)/pip install --upgrade pip
	$(VENV)/pip install torch
	$(VENV)/pip install -r requirements.txt

dev:
	$(VENV)/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	$(VENV)/python -m pytest tests/ -v

lint:
	$(VENV)/python -m ruff check app scripts tests

format:
	$(VENV)/python -m ruff check app scripts tests --fix

migrate:
	$(VENV)/alembic upgrade head

seed:
	$(VENV)/python scripts/seed.py --demo

ingest:
	$(VENV)/python scripts/import_dataset.py $(FILE) --output datasets/tickets_real.jsonl

train:
	$(VENV)/python scripts/build_dataset.py --rows 1500
	$(VENV)/python scripts/train_nn.py --epochs 20

evaluate:
	$(VENV)/python -c "import json; from pathlib import Path; print(json.dumps(json.loads(Path('app/ml/artifacts/metrics.json').read_text()), indent=2, ensure_ascii=False))"

export-onnx:
	$(VENV)/python -c "from app.ml.infer import get_neural_predictor; from app.ml.train import export_onnx; p = get_neural_predictor(); export_onnx(p.model, p.model.input_dim, 'app/ml/artifacts/multihead.onnx') if p else print('Treine o modelo primeiro: make train')"

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down
