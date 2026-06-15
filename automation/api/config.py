from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    claude_model: str = "claude-3-5-sonnet-20241022"
    automation_api_key: str = "dev-automation-key"
    redis_url: str = "redis://localhost:6379/0"
    upload_dir: str = "/tmp/automation-uploads"
    max_upload_mb: int = 10
    job_ttl_seconds: int = 86400
    job_poll_timeout_seconds: int = 300
    cors_origins: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
