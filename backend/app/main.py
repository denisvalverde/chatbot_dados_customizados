"""Aplicacao FastAPI: middleware, observabilidade, rotas e ciclo de vida."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Histogram,
    generate_latest,
)

from app import __version__
from app.core.config import get_settings
from app.core.exceptions import PlatformError, RateLimitedError
from app.core.logging import (
    configure_logging,
    correlation_id_var,
    get_logger,
    new_request_id,
    request_id_var,
)
from app.infrastructure.database import engine, init_db

logger = get_logger(__name__)

REQUEST_COUNT = Counter(
    "http_requests_total", "Total de requisicoes HTTP", ["method", "path", "status"]
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds", "Duracao das requisicoes", ["method", "path"]
)

# Rate limiting: janela deslizante em memoria por IP (por processo).
_hits: dict[str, deque[float]] = defaultdict(deque)


def _rate_limited(ip: str) -> bool:
    settings = get_settings()
    now = time.monotonic()
    window = _hits[ip]
    cutoff = now - settings.rate_limit_window_seconds
    while window and window[0] < cutoff:
        window.popleft()
    if len(window) >= settings.rate_limit_requests:
        return True
    window.append(now)
    return False


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    init_db()
    logger.info(
        "Aplicacao iniciada",
        extra={"extra_fields": {"env": settings.environment, "version": __version__}},
    )
    yield


app = FastAPI(
    title="Plataforma IA Suporte/SRE",
    description=(
        "Plataforma de inteligencia artificial para suporte tecnico, SRE e "
        "infraestrutura: classificacao hibrida, extracao de entidades, analise "
        "anti-alucinacao, RAG, geracao de comunicacao e MLOps."
    ),
    version=__version__,
    lifespan=lifespan,
)


@app.middleware("http")
async def observability_middleware(request: Request, call_next):
    """Request-id, correlation-id, rate limit, metricas e log de acesso."""
    request_id_var.set(new_request_id())
    correlation_id_var.set(request.headers.get("x-correlation-id", "-"))

    path = request.url.path
    if path.startswith("/api/"):
        ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
            request.client.host if request.client else "unknown"
        )
        if _rate_limited(ip):
            exc = RateLimitedError()
            return JSONResponse(
                status_code=exc.status_code, content={"detail": exc.detail}
            )

    start = time.perf_counter()
    response: Response = await call_next(request)
    elapsed = time.perf_counter() - start

    route = request.scope.get("route")
    template = getattr(route, "path", path)
    REQUEST_COUNT.labels(request.method, template, str(response.status_code)).inc()
    REQUEST_LATENCY.labels(request.method, template).observe(elapsed)
    response.headers["x-request-id"] = request_id_var.get()
    logger.info(
        "%s %s -> %d (%.3fs)", request.method, path, response.status_code, elapsed
    )
    return response


@app.exception_handler(PlatformError)
async def platform_error_handler(_: Request, exc: PlatformError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def unhandled_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Erro nao tratado")
    return JSONResponse(status_code=500, content={"detail": "Erro interno."})


@app.get("/health", tags=["infra"])
def health() -> dict:
    """Liveness: processo no ar."""
    return {"status": "ok", "version": __version__}


@app.get("/ready", tags=["infra"])
def ready() -> dict:
    """Readiness: banco acessivel."""
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("SELECT 1")
        database = "ok"
    except Exception as exc:  # pragma: no cover
        logger.error("Banco indisponivel: %s", exc)
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "error"})  # type: ignore[return-value]
    return {"status": "ready", "database": database}


@app.get("/metrics", tags=["infra"])
def metrics() -> Response:
    """Metricas Prometheus."""
    if not get_settings().metrics_enabled:
        return Response(status_code=404)
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


from app.api.v1.router import api_router  # noqa: E402  (apos app para clareza)

app.include_router(api_router, prefix=get_settings().api_v1_prefix)

# UI estatica (SPA leve, sem mocks — consome a API real)
from pathlib import Path  # noqa: E402

_static_dir = Path(__file__).resolve().parent / "static"
if _static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")

    @app.get("/", include_in_schema=False)
    def index() -> FileResponse:
        return FileResponse(_static_dir / "index.html")
