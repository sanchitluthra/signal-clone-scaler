import os
import tempfile

import pytest

# Point the app at a throwaway database *before* it is imported.
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["UPLOAD_DIR"] = f"{_tmp}/uploads"
os.environ["SEED_ON_STARTUP"] = "false"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as c:  # runs the lifespan (creates tables)
        yield c


@pytest.fixture()
def register(client):
    """register("+15551112222", "Name") -> {"id": ..., "headers": {...auth...}} for a fresh user."""

    def _register(phone: str, name: str) -> dict:
        res = client.post("/api/auth/verify-otp", json={"phone": phone, "code": "123456"})
        assert res.status_code == 200
        headers = {"Authorization": f"Bearer {res.json()['token']}"}
        client.patch("/api/users/me", json={"display_name": name}, headers=headers)
        return {"id": res.json()["user"]["id"], "headers": headers, "token": res.json()["token"]}

    return _register
