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

    # Powers the AI Copilot's fallback language understanding — a single,
    # tiny, structured-output call to a LOCAL Ollama model that picks ONE
    # intent from a closed list (see app/api/copilot.py and
    # frontend/src/lib/copilot/ollamaClient.ts). It never writes the
    # answer text and never sees or returns a financial figure; the
    # precise regex rules in respond.ts run first and handle most
    # messages for free, with zero model call at all. No API key needed —
    # Ollama runs locally. Unreachable Ollama -> the Copilot still works,
    # just with the rules' own (smaller) understanding.
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"

    # Background anomaly sweep (app/services/scheduler.py) — periodically
    # re-runs the ML weather anomaly detector for each region's hazard
    # coordinates instead of only on-demand per request. Off by default in
    # tests (conftest.py sets this false) so the test suite never makes
    # live network calls on app startup.
    anomaly_sweep_enabled: bool = True
    anomaly_sweep_interval_hours: float = 6.0


settings = Settings()
