from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven configuration. No secrets live in code — see .env.example."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./climatrix.db"
    frontend_origin: str = "http://localhost:5181"

    nasa_power_base_url: str = "https://power.larc.nasa.gov/api/temporal/daily/point"
    open_meteo_archive_url: str = "https://archive-api.open-meteo.com/v1/archive"
    open_meteo_flood_url: str = "https://flood-api.open-meteo.com/v1/flood"

    tomorrow_io_api_key: str = ""
    tomorrow_io_base_url: str = "https://api.tomorrow.io/v4"

    newsapi_key: str = ""
    newsapi_base_url: str = "https://newsapi.org/v2"

    gnews_api_key: str = ""
    gnews_base_url: str = "https://gnews.io/api/v4"

    alphai_api_key: str = ""
    alphai_base_url: str = "https://api.alphai.io/api"

    # Powers the AI Copilot's genuine language understanding (intent,
    # entity extraction, multi-step/compound questions) — see
    # app/api/copilot.py. The Copilot's NUMBERS never come from this model;
    # it only decides which deterministic frontend tool to call and phrases
    # the result. Unset -> the Copilot falls back to its rule-based parser.
    anthropic_api_key: str = ""
    anthropic_base_url: str = "https://api.anthropic.com/v1/messages"
    anthropic_model: str = "claude-sonnet-4-5-20250929"


settings = Settings()
