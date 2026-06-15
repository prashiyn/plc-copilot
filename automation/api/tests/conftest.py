import pytest
import fakeredis.aioredis
from fastapi.testclient import TestClient

from api.dependencies import get_redis
from api.main import create_app


@pytest.fixture
async def redis():
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield client
    await client.aclose()


@pytest.fixture
def app(redis):
    application = create_app()
    application.dependency_overrides[get_redis] = lambda: redis
    return application


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer dev-automation-key"}
