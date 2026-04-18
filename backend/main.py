"""
main.py
-------
GreenChain JSON API — pure request/response. No SSE, no streaming.

Endpoints:
  POST /search             — run Dedalus agents + ML scoring, return full JSON
  POST /rescore-transport  — reprice transport mode server-side
  POST /score              — score pre-collected candidates (skip the agent)
  GET  /health             — liveness probe

Run:
  uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).parent / ".env")

from .agents import run_supply_chain_research
from .db import audit_search, init_db
from .ml_scorer import compute_composite_scores
from .transport import rescore_transport


app = FastAPI(
    title="GreenChain API",
    version="0.1.0",
    description=(
        "Environmental supply chain comparator. Submit a product + source "
        "countries + transport mode; get a ranked list of real manufacturers "
        "scored across 5 environmental dimensions."
    ),
)

# CORS open for hackathon — tighten for prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()
    # Prime the XGBoost models so the first /search doesn't pay the joblib load.
    try:
        from .ml_bridge import get_emissions_model
        get_emissions_model()
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] EmissionsModel preload failed: {exc}")


# ---------------------------------------------------------------------------
#  Request / response models
# ---------------------------------------------------------------------------


class SearchRequest(BaseModel):
    product: str = Field(..., description="Product name, e.g. 'cotton t-shirts'")
    quantity: int = Field(..., ge=1, description="Unit count")
    destination: str = Field(..., description="ISO country code of final destination")
    countries: list[str] = Field(
        default_factory=list,
        description=(
            "ISO country codes to source from. Leave empty for a GLOBAL search "
            "where the agent picks the best countries itself."
        ),
    )
    transport_mode: str = Field("sea", description="sea | air | rail | road")
    require_certifications: list[str] = Field(
        default_factory=list,
        description="Optional filter: require at least one of these certs",
    )
    target_count: int | None = Field(
        None,
        ge=1,
        le=30,
        description=(
            "Optional manufacturer count. In per-country mode, splits across "
            "the country list (min 1 each). In global mode, total worldwide. "
            "Defaults: 5/country (per-country), 6 (global)."
        ),
    )
    weights: dict[str, float] | None = Field(
        None,
        description=(
            "Optional override for dimension weights "
            "(manufacturing, transport, grid_carbon, certifications, climate_risk). "
            "Must sum to ~1.0."
        ),
    )


class SearchResponse(BaseModel):
    product: str
    destination: str
    transport_mode: str
    countries: list[str]
    duration_seconds: float
    count: int
    results: list[dict[str, Any]]


class RescoreRequest(BaseModel):
    manufacturers: list[dict[str, Any]]
    mode: str


class ScoreRequest(BaseModel):
    """Run ML scoring on candidates you've already collected elsewhere."""
    manufacturers: list[dict[str, Any]]
    transport_mode: str = "sea"
    weights: dict[str, float] | None = None


# ---------------------------------------------------------------------------
#  Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest) -> SearchResponse:
    """Run the Dedalus agent + ML scoring pipeline and return the full result."""
    start = time.monotonic()

    try:
        raw_output = await run_supply_chain_research(
            product=req.product,
            quantity=req.quantity,
            countries=req.countries,
            destination=req.destination,
            transport_mode=req.transport_mode,
            require_certifications=req.require_certifications or None,
            target_count=req.target_count,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Agent call failed: {type(exc).__name__}: {exc}",
        )

    try:
        scored = compute_composite_scores(
            raw_output,
            transport_mode=req.transport_mode,
            weights=req.weights,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Scoring failed: {type(exc).__name__}: {exc}",
        )

    duration = round(time.monotonic() - start, 2)

    try:
        audit_search(
            product=req.product,
            countries=req.countries,
            transport_mode=req.transport_mode,
            destination=req.destination,
            duration_seconds=duration,
            result_count=len(scored),
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[audit_search] non-fatal failure: {exc}")

    return SearchResponse(
        product=req.product,
        destination=req.destination,
        transport_mode=req.transport_mode,
        countries=req.countries,
        duration_seconds=duration,
        count=len(scored),
        results=scored,
    )


@app.post("/score")
async def score(req: ScoreRequest) -> dict[str, Any]:
    """
    Score a pre-collected candidate list — useful for testing the ML layer
    without paying for an agent call.

    Each candidate must carry at minimum `name`, `country`, `certifications`,
    `emission_factor`, and `transport`. See /search response for the full shape.
    """
    try:
        scored = compute_composite_scores(
            req.manufacturers,
            transport_mode=req.transport_mode,
            weights=req.weights,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Scoring failed: {type(exc).__name__}: {exc}",
        )
    return {"count": len(scored), "results": scored}


@app.post("/rescore-transport")
async def rescore_transport_endpoint(req: RescoreRequest) -> dict[str, Any]:
    """Recompute transport emissions for the given manufacturers under a new mode."""
    rescored = rescore_transport(req.manufacturers, req.mode)
    rescored.sort(key=lambda x: x.get("scores", {}).get("total_tco2e", float("inf")))
    for i, m in enumerate(rescored, 1):
        m["rank"] = i
    return {"count": len(rescored), "mode": req.mode, "results": rescored}
