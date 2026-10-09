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


settings = Settings()
