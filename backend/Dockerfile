# Imagem unica: API, treino e seed rodam a partir dela (comando definido no compose)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# PyTorch CPU: evita puxar dependencias CUDA (~4GB) desnecessarias em produção.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch \
    && pip install -r requirements.txt

COPY alembic.ini .
COPY migrations/ migrations/
COPY app/ app/
COPY scripts/ scripts/

RUN mkdir -p data datasets app/ml/artifacts \
    && useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -sf http://localhost:8000/health || exit 1

CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120"]
