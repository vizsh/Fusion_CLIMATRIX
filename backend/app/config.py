from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven configuration. No secrets live in code — see .env.example."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./climatrix.db"
    frontend_origin: str = "http://localhost:5181"
    nasa_power_base_url: str = "https://power.larc.nasa.gov/api/temporal/daily/point"


settings = Settings()
