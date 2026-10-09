import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Point the app at a fresh temp SQLite file BEFORE importing app modules,
# so engine/session creation picks up the test database, not climatrix.db.
_tmp_dir = tempfile.mkdtemp()
_tmp_db_path = os.path.join(_tmp_dir, "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db_path}"
# Never let the background anomaly sweep (app/services/scheduler.py) make
# live network calls when TestClient triggers app startup.
os.environ["ANOMALY_SWEEP_ENABLED"] = "false"

from app.db.session import Base  # noqa: E402
from app.main import app  # noqa: E402

test_engine = create_engine(f"sqlite:///{_tmp_db_path}", connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def _setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
