"""Environment-backed configuration. Never commit production secrets."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Small, explicit settings surface shared by the API and migration runner."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://pulse:pulse@localhost:5432/pulse"
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    jwt_secret: str = ""
    cron_secret: str = ""
    salt_secret: str = ""
    llm_api_key: str = ""

    @property
    def cors_origins(self) -> list[str]:
        """Split the comma-delimited dashboard origin allowlist."""
        return [
            origin.strip().rstrip("/")
            for origin in self.allowed_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    """Read configuration once per service process."""
    return Settings()
