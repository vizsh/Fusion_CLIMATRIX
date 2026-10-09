"""AI Copilot proxy — a thin, stateless forward to Anthropic's Messages API.

Why a proxy and not a full backend agent loop: the Copilot's "tools" (regional
exposure, protection gap, multi-scenario ranking, portfolio overview...) are
the exact same TypeScript functions the rest of the dashboard already calls
(frontend/src/lib/copilot/engine.ts and friends). Reimplementing that
financial/graph engine in Python here would create a second source of truth
that can silently drift from what the dashboard shows — precisely the
failure mode this product's evidence-integrity design exists to prevent (see
root README's "Architecture" section).

So the model's tool-use loop is driven from the browser: the frontend sends
the running conversation + tool schemas here, this endpoint forwards it to
Anthropic unmodified and returns the raw response, the frontend executes
whichever local tool the model asked for using the real engine, and the
result is sent back on the next call. This endpoint never sees — and could
not fabricate — a financial figure; it only ever relays model text and tool
*requests*, never tool *results*."""

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/api/copilot", tags=["copilot"])


class CopilotChatRequest(BaseModel):
    system: str
    messages: list[dict]
    tools: list[dict] = []
    max_tokens: int = 1536


@router.get("/status")
def copilot_status():
    """Lets the frontend know whether to attempt the LLM path at all,
    instead of discovering it via a failed POST on every message."""
    return {"configured": bool(settings.anthropic_api_key)}


@router.post("/chat")
async def copilot_chat(body: CopilotChatRequest):
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY is not set on the backend — the Copilot is running in rule-based fallback mode.",
        )

    payload = {
        "model": settings.anthropic_model,
        "max_tokens": body.max_tokens,
        "system": body.system,
        "messages": body.messages,
    }
    if body.tools:
        payload["tools"] = body.tools

    headers = {
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(settings.anthropic_base_url, json=payload, headers=headers)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Anthropic API request timed out.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API request failed: {e}")

    if resp.status_code != 200:
        # Relay the provider's own error text (never silently invent a
        # response) so the frontend can fall back honestly.
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    return resp.json()
