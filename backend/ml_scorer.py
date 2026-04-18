"""
ml_scorer.py
------------
Composite-score pipeline called after the Dedalus agent returns raw JSON.

Delegates the heavy lifting to `ml.inference.ScoreAssembler`, which is the
single source of truth for how the 5 environmental dimensions combine into a
0-100 composite score.

Input shape (per manufacturer, as emitted by the Dedalus agent):
{
  "name": str,
  "country": str,                  # ISO alpha-2
  "city": str | None,
  "sustainability_url": str | None,
  "certifications": list[str],
  "emission_factor": { ... from lookup_emission_factor ... },
  "transport":       { ... from calculate_transport_emissions ... },
  "cert_score":      { ... from score_certifications ... },
  "disclosure_status": "verified" | "partial" | "none"
}

Output: list of scored dicts, sorted best-first, each with a `rank`,
`composite_score`, `env_rating`, and normalised per-dimension scores.
"""

from __future__ import annotations

import json
import re
from typing import Any, Iterable

from .ml_bridge import get_score_assembler


DEFAULT_WEIGHTS = {
    "manufacturing":  0.40,
    "transport":      0.25,
    "grid_carbon":    0.20,
    "certifications": 0.10,
    "climate_risk":   0.05,
}


def _parse_agent_output(raw: str | list | dict) -> list[dict[str, Any]]:
    """Coerce the Dedalus agent output into a list of manufacturer dicts."""
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        # Tolerate {"manufacturers": [...]}-shaped wrappers.
        for key in ("manufacturers", "results", "data"):
            if key in raw and isinstance(raw[key], list):
                return raw[key]
        return [raw]

    if not isinstance(raw, str):
        return []

    text = raw.strip()
    # Try direct JSON first.
    try:
        parsed = json.loads(text)
        return _parse_agent_output(parsed)
    except json.JSONDecodeError:
        pass

    # Claude/Dedalus sometimes wraps JSON in ```json fences or prose.
    fenced = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            pass

    bare = re.search(r"\[.*\]", text, re.DOTALL)
    if bare:
        try:
            return json.loads(bare.group(0))
        except json.JSONDecodeError:
            pass

    return []


def _bucket(score: float) -> str:
    # ScoreAssembler's score is "lower = better" (0 best, 100 worst).
    if score <= 35:
        return "green"
    if score <= 65:
        return "amber"
    return "red"


def compute_composite_scores(
    raw_results: str | list | dict,
    transport_mode: str,
    weights: dict | None = None,
) -> list[dict[str, Any]]:
    """
    Score and rank manufacturers from the agent's raw JSON output.

    Returns a list sorted by composite score (lower = better) with per-
    manufacturer rank, env_rating bucket, and normalised sub-scores.
    """
    manufacturers = _parse_agent_output(raw_results)
    if not manufacturers:
        return []

    # Build the ScoreAssembler input contract.
    candidates = []
    for m in manufacturers:
        ef = m.get("emission_factor") or {}
        tr = m.get("transport") or {}
        cs = m.get("cert_score") or {}

        mfg_tco2e = ef.get("q50_tco2e") or ef.get("emission_factor_tco2e_per_1m_usd") or 0.0
        transport_tco2e = tr.get("transport_tco2e") or tr.get("tco2e") or 0.0
        if mfg_tco2e is None:
            mfg_tco2e = 0.0
        if transport_tco2e is None:
            transport_tco2e = 0.0

        candidates.append({
            "name":              m.get("name", "Unknown"),
            "country_iso":       (m.get("country") or "").upper() or "US",
            "mfg_tco2e":         float(mfg_tco2e),
            "transport_tco2e":   float(transport_tco2e),
            "certifications":    m.get("certifications", []) or [],
            # Keep the raw payload so we can merge it back after scoring.
            "_raw":              m,
        })

    ScoreAssembler = get_score_assembler()
    weights = weights or DEFAULT_WEIGHTS
    scored_raw = ScoreAssembler.score_candidates(candidates, weights=weights)

    # Re-merge with the agent-emitted fields and compose the response shape
    # CLAUDE.md's frontend expects.
    merged: list[dict[str, Any]] = []
    for s in scored_raw:
        raw = s.pop("_raw", {})
        composite = float(s["score"])
        merged.append({
            **raw,
            "rank":               s["rank"],
            "composite_score":    round(100 - composite, 1),   # flip so higher=better for UI
            "env_rating":         _bucket(composite),
            "transport_mode":     transport_mode,
            "scores": {
                "manufacturing_tco2e":  round(s["mfg_tco2e_adj"], 2),
                "transport_tco2e":      round(s["transport_tco2e"], 3),
                "grid_carbon_gco2_kwh": s["grid_gco2_kwh"],
                "cert_score":           raw.get("cert_score", {}).get("cert_score", 0),
                "climate_risk_score":   s["climate_risk_score"],
                "total_tco2e":          s["total_tco2e"],
            },
            "rank_scores": {
                "manufacturing_norm": s["mfg_norm"],
                "transport_norm":     s["transport_norm"],
                "grid_norm":          s["grid_norm"],
                "cert_norm":          s["cert_norm"],
                "risk_norm":          s["risk_norm"],
            },
        })

    return merged
