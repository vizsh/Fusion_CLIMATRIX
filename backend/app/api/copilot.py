"""AI Copilot's local-model fallback — a thin proxy to a LOCAL Ollama
instance, used for exactly one thing: picking a single intent from a
closed list when the Copilot's regex rules (frontend/src/lib/copilot/
respond.ts) don't confidently match a message.

Design (mirrors the reference pattern in vizsh/Jarvis_Hedge_Fund's
backend/assistant.py + agents/llm.py): precise rules run first and
resolve most messages for free, with zero model call and zero tokens.
Only the unmatched minority reaches this endpoint, and even then the
model is asked to output a tiny JSON object — an intent name, optional
region, and a confidence — via Ollama's structured `format` (JSON
schema) parameter, never free-form prose. It NEVER computes or returns a
financial figure; every number the Copilot ever shows still comes from
the same deterministic engine the dashboard uses. This keeps the token
footprint close to the floor: at most ~60 output tokens, only when the
rules genuinely need help, never for every message, never with
conversation history attached.

No API key, no cloud account — this only talks to http://localhost:11434
(or OLLAMA_BASE_URL), so it costs nothing and sends nothing offsite."""

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from app.config import settings

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


@router.get("/status")
async def copilot_status():
    """Lets the frontend know whether Ollama is reachable and which model
    to ask for, instead of discovering it via a failed POST on every
    message. Never raises — an unreachable Ollama is a normal, expected
    state (the Copilot still works via rules alone)."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            resp.raise_for_status()
            tags = [m["name"] for m in resp.json().get("models", [])]
    except Exception:
        return {"available": False, "model": None, "models": []}

    # Prefer the configured model; fall back to any pulled model (match on
    # the name before ":" so "llama3.1" matches a pulled "llama3.1:8b").
    model = None
    if any(t == settings.ollama_model or t.split(":")[0] == settings.ollama_model for t in tags):
        model = settings.ollama_model if settings.ollama_model in tags else next(
            t for t in tags if t.split(":")[0] == settings.ollama_model
        )
    elif tags:
        model = tags[0]

    return {"available": model is not None, "model": model, "models": tags}


class ClassifyRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    model: str
    prompt: str
    schema_: dict = Field(alias="schema")  # `schema` shadows a BaseModel attribute
    max_tokens: int = 60


@router.post("/classify")
async def copilot_classify(body: ClassifyRequest):
    """One structured, single-turn call: no system prompt, no history, a
    tiny output budget. `schema_` is a JSON-schema object passed straight
    through to Ollama's `format` parameter, which constrains the model to
    emit exactly that shape — see https://ollama.com/blog/structured-outputs."""
    payload = {
        "model": body.model,
        "messages": [{"role": "user", "content": body.prompt}],
        "format": body.schema_,
        "stream": False,
        "keep_alive": "10m",
        "options": {"temperature": 0.0, "num_predict": body.max_tokens},
    }
    try:
        # Generous timeout: a cold local model can take 30-60s to load on a
        # CPU-only box the first time; CopilotPanel fires a background
        # warm-up call on mount so real questions usually hit a warm model
        # (~1-4s) well within this ceiling.
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(f"{settings.ollama_base_url}/api/chat", json=payload)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        # Relay failure honestly — the frontend falls back to the rules'
        # own best guess rather than hang or fabricate a classification.
        return {"error": str(e)}
