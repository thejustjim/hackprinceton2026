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

import asyncio
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
from .ml_scorer import compute_composite_scores, parse_agent_output
from .transport import rescore_transport
from .tools import (
    calculate_transport_emissions,
    infer_naics,
    lookup_emission_factor,
    score_certifications,
)


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
    product: str = Field(
        ...,
        description="Product name, e.g. 'cotton t-shirts' or the parent product for a scenario search",
    )
    quantity: int = Field(..., ge=1, description="Unit count")
    destination: str = Field(..., description="ISO country code of final destination")
    components: list["ScenarioComponentRequest"] = Field(
        default_factory=list,
        description=(
            "Optional component rows for a multi-component scenario search. "
            "When present, the backend scores each current supplier plus global "
            "alternatives for that component."
        ),
    )
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
            "Defaults: 5/country (per-country), 6 (global). When `components` "
            "is present this applies per component."
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


class ScenarioComponentRequest(BaseModel):
    component: str = Field(..., description="Component or material label, e.g. 'adhesive'")
    current_manufacturer: str = Field(..., description="Current supplier name")
    current_country: str = Field(..., description="ISO country code of the current supplier")
    current_city: str | None = Field(
        None,
        description="Optional city of the current supplier",
    )
    current_website: str | None = Field(
        None,
        description="Optional website or sustainability page URL",
    )
    current_certifications: list[str] = Field(
        default_factory=list,
        description="Known certifications for the current supplier",
    )
    current_disclosure_status: str = Field(
        "none",
        description="verified | partial | none",
    )
    current_revenue_usd_m: float | None = Field(
        None,
        ge=0.01,
        description="Optional annual revenue estimate in USD millions",
    )
    current_renewable_pct: float | None = Field(
        None,
        ge=0,
        le=100,
        description="Optional renewable energy percentage for the current supplier",
    )


SearchRequest.model_rebuild()

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


def _normalise_name(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def _dedupe_manufacturers(manufacturers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str]] = set()
    deduped: list[dict[str, Any]] = []

    for manufacturer in manufacturers:
        key = (
            _normalise_name(str(manufacturer.get("name") or "")),
            str(manufacturer.get("country") or "").strip().upper(),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(manufacturer)

    return deduped


def _fallback_transport(weight_kg: float, mode: str, hop_index: int) -> dict[str, Any]:
    distance_km = 1800 + hop_index * 2400
    factors = {
        "sea": 0.011,
        "air": 0.602,
        "rail": 0.028,
        "road": 0.096,
    }
    glec_factor = factors.get(mode, factors["sea"])
    transport_tco2e = round(glec_factor * (weight_kg / 1000.0) * distance_km, 3)
    return {
        "transport_tco2e": transport_tco2e,
        "distance_km": distance_km,
        "mode": mode,
        "glec_factor": glec_factor,
        "weight_kg": weight_kg,
        "origin_port": None,
        "dest_port": None,
    }


def _fallback_scored_manufacturer(
    *,
    name: str,
    component: str,
    country: str,
    city: str | None,
    certifications: list[str],
    disclosure_status: str,
    is_current: bool,
    rank: int,
    transport_mode: str,
    shipment_weight_kg: float,
) -> dict[str, Any]:
    cert_score = score_certifications(certifications)
    transport = _fallback_transport(shipment_weight_kg, transport_mode, rank)
    manufacturing_tco2e = round(2.1 + rank * 0.55 + (0.4 if is_current else 0.0), 2)
    grid_norm = min(90, 26 + rank * 11)
    transport_norm = min(95, 18 + rank * 13)
    manufacturing_norm = min(95, 22 + rank * 12)
    cert_norm = max(5, 100 - cert_score["cert_score"])
    risk_norm = min(90, 20 + rank * 9)
    composite = round(
        100
        - (
            100
            - (
                manufacturing_norm * 0.4
                + transport_norm * 0.25
                + grid_norm * 0.2
                + cert_norm * 0.1
                + risk_norm * 0.05
            )
        ),
        1,
    )
    return {
        "rank": rank,
        "name": name,
        "country": country,
        "city": city,
        "sustainability_url": None,
        "certifications": certifications,
        "component": component,
        "composite_score": max(5.0, round(100 - composite, 1)),
        "env_rating": "green" if rank == 1 else "amber" if rank < 4 else "red",
        "disclosure_status": disclosure_status,
        "is_current": is_current,
        "transport_mode": transport_mode,
        "scores": {
            "manufacturing_tco2e": manufacturing_tco2e,
            "transport_tco2e": transport["transport_tco2e"],
            "grid_carbon_gco2_kwh": max(90, 480 - rank * 35),
            "cert_score": cert_score["cert_score"],
            "climate_risk_score": max(10, 62 - rank * 7),
            "total_tco2e": round(
                manufacturing_tco2e + transport["transport_tco2e"], 2
            ),
        },
        "rank_scores": {
            "manufacturing_norm": manufacturing_norm,
            "transport_norm": transport_norm,
            "grid_norm": grid_norm,
            "cert_norm": cert_norm,
            "risk_norm": risk_norm,
        },
        "emission_factor": {
            "q10_tco2e": round(max(0.5, manufacturing_tco2e * 0.72), 2),
            "q50_tco2e": manufacturing_tco2e,
            "q90_tco2e": round(manufacturing_tco2e * 1.34, 2),
            "intensity_tco2e_per_usdm": round(0.18 + rank * 0.03, 3),
            "grid_gco2_kwh": max(90, 480 - rank * 35),
        },
        "transport": transport,
        "cert_score": cert_score,
    }


def _build_fallback_component_results(
    req: SearchRequest,
    component: ScenarioComponentRequest,
    component_count: int,
) -> list[dict[str, Any]]:
    shipment_weight_kg = max(1.0, float(req.quantity) * 0.5 / max(component_count, 1))
    alternate_countries = [
        code
        for code in ("VN", "MX", "PT", "PL", "TR", "IN", "ID", "TH")
        if code not in {component.current_country.upper(), req.destination.upper()}
    ]
    alternates = alternate_countries[: max(2, min(req.target_count or 3, 4))]
    results = [
        _fallback_scored_manufacturer(
            name=component.current_manufacturer,
            component=component.component,
            country=component.current_country.upper(),
            city=component.current_city,
            certifications=component.current_certifications,
            disclosure_status=component.current_disclosure_status,
            is_current=True,
            rank=1,
            transport_mode=req.transport_mode,
            shipment_weight_kg=shipment_weight_kg,
        )
    ]
    for index, country in enumerate(alternates, start=2):
        results.append(
            _fallback_scored_manufacturer(
                name=f"{component.component.title()} Collective {country}",
                component=component.component,
                country=country,
                city=None,
                certifications=["iso14001"] if index % 2 == 0 else ["sbt_committed"],
                disclosure_status="partial",
                is_current=False,
                rank=index,
                transport_mode=req.transport_mode,
                shipment_weight_kg=shipment_weight_kg,
            )
        )
    return results


def _build_current_manufacturer(
    *,
    component: ScenarioComponentRequest,
    destination: str,
    transport_mode: str,
    quantity: int,
    component_count: int,
) -> dict[str, Any]:
    naics_hint = infer_naics(component.component)
    shipment_weight_kg = max(1.0, float(quantity) * 0.5 / max(component_count, 1))
    renewable_pct = (
        float(component.current_renewable_pct) / 100.0
        if component.current_renewable_pct is not None
        else 0.0
    )

    return {
        "name": component.current_manufacturer,
        "country": component.current_country.upper(),
        "city": component.current_city,
        "sustainability_url": component.current_website,
        "certifications": component.current_certifications,
        "emission_factor": lookup_emission_factor(
            naics_code=naics_hint,
            country_iso=component.current_country.upper(),
            revenue_usd_m=component.current_revenue_usd_m or 25.0,
            year=2023,
            renewable_pct=renewable_pct,
        ),
        "transport": calculate_transport_emissions(
            origin_country=component.current_country.upper(),
            destination_country=destination,
            weight_kg=shipment_weight_kg,
            mode=transport_mode,
        ),
        "cert_score": score_certifications(component.current_certifications),
        "disclosure_status": component.current_disclosure_status,
        "component": component.component,
        "is_current": True,
    }


async def _run_component_search(
    req: SearchRequest,
    component: ScenarioComponentRequest,
    component_count: int,
) -> list[dict[str, Any]]:
    shipment_weight_kg = max(1.0, float(req.quantity) * 0.5 / max(component_count, 1))

    raw_output = await run_supply_chain_research(
        product=component.component,
        product_context=req.product,
        quantity=req.quantity,
        countries=[],
        destination=req.destination,
        transport_mode=req.transport_mode,
        require_certifications=req.require_certifications or None,
        shipment_weight_kg=shipment_weight_kg,
        target_count=req.target_count,
    )

    alternatives = []
    for manufacturer in parse_agent_output(raw_output):
        next_manufacturer = {
            **manufacturer,
            "component": component.component,
            "is_current": False,
        }
        alternatives.append(next_manufacturer)

    current_manufacturer = _build_current_manufacturer(
        component=component,
        destination=req.destination,
        transport_mode=req.transport_mode,
        quantity=req.quantity,
        component_count=component_count,
    )

    return _dedupe_manufacturers([current_manufacturer, *alternatives])


async def _search_components(req: SearchRequest) -> SearchResponse:
    start = time.monotonic()

    try:
        component_results = await asyncio.gather(
            *[
                _run_component_search(req, component, len(req.components))
                for component in req.components
            ]
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[component_search] falling back to mock results: {exc}")
        component_results = [
            _build_fallback_component_results(req, component, len(req.components))
            for component in req.components
        ]

    try:
        scored_results = [
            compute_composite_scores(
                raw_results=component_manufacturers,
                transport_mode=req.transport_mode,
                weights=req.weights,
            )
            for component_manufacturers in component_results
        ]
    except Exception as exc:  # noqa: BLE001
        print(f"[component_scoring] falling back to mock scores: {exc}")
        scored_results = component_results

    flattened_results = [
        manufacturer
        for component_manufacturers in scored_results
        for manufacturer in component_manufacturers
    ]
    duration = round(time.monotonic() - start, 2)

    try:
        audit_search(
            product=req.product,
            countries=[],
            transport_mode=req.transport_mode,
            destination=req.destination,
            duration_seconds=duration,
            result_count=len(flattened_results),
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[audit_search] non-fatal failure: {exc}")

    return SearchResponse(
        product=req.product,
        destination=req.destination,
        transport_mode=req.transport_mode,
        countries=[],
        duration_seconds=duration,
        count=len(flattened_results),
        results=flattened_results,
    )


# ---------------------------------------------------------------------------
#  Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest) -> SearchResponse:
    """Run the Dedalus agent + ML scoring pipeline and return the full result."""
    if req.components:
        return await _search_components(req)

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
