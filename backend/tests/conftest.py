"""Fixtures: app isolada com banco temporario e usuarios de teste."""

from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("JWT_SECRET_KEY", "chave-de-teste-com-tamanho-suficiente-1234")
os.environ.setdefault("RATE_LIMIT_REQUESTS", "10000")
_tmpdir = tempfile.mkdtemp(prefix="platform-test-")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_tmpdir}/test.db")
os.environ.setdefault("ML_ARTIFACTS_DIR", f"{_tmpdir}/artifacts")
os.environ.setdefault("ML_DATASET_PATH", f"{_tmpdir}/dataset.jsonl")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.infrastructure.database import SessionLocal, init_db  # noqa: E402
from app.infrastructure.repositories import UserRepository  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def tmp_workdir() -> Path:
    return Path(_tmpdir)


@pytest.fixture(scope="session", autouse=True)
def _setup_db() -> Iterator[None]:
    init_db()
    db = SessionLocal()
    users = UserRepository(db)
    if users.get_by_email("admin@example.com") is None:
        users.create("admin@example.com", hash_password("admin-secret"), "admin")
        users.create("viewer@example.com", hash_password("viewer-secret"), "viewer")
    db.close()
    yield


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture(scope="session")
def admin_headers(client: TestClient) -> dict[str, str]:
    return _login(client, "admin@example.com", "admin-secret")


@pytest.fixture(scope="session")
def viewer_headers(client: TestClient) -> dict[str, str]:
    return _login(client, "viewer@example.com", "viewer-secret")
