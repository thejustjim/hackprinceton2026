"""
transport.py
------------
Standalone transport recalculator — used by the /rescore-transport endpoint.

The frontend toggle flips the transport mode client-side (using the same GLEC
factors below) for instant feedback. This module exists for callers that
prefer server-side re-ranking.
"""

from __future__ import annotations

GLEC_FACTORS = {
    "sea":  0.011,   # kgCO2 per tonne-km
    "air":  0.602,
    "rail": 0.028,
    "road": 0.096,
}


def rescore_transport(manufacturers: list[dict], new_mode: str) -> list[dict]:
    """
    Recalculate transport emissions for all manufacturers with a new mode.

    Expects each manufacturer dict to carry `transport.distance_km` and
    `transport.weight_kg` (populated during the original /search call).

    Returns the same list with `transport` and `scores` fields updated in place.
    """
    factor = GLEC_FACTORS.get(new_mode, GLEC_FACTORS["sea"])

    for m in manufacturers:
        transport = m.setdefault("transport", {})
        scores = m.setdefault("scores", {})

        distance_km = float(transport.get("distance_km", 8000))
        weight_kg = float(transport.get("weight_kg", 500))

        new_transport_tco2e = round(factor * (weight_kg / 1000) * distance_km, 3)
        transport["transport_tco2e"] = new_transport_tco2e
        transport["mode"] = new_mode
        transport["glec_factor"] = factor

        scores["transport_tco2e"] = new_transport_tco2e
        mfg = float(scores.get("manufacturing_tco2e", 0.0))
        scores["total_tco2e"] = round(mfg + new_transport_tco2e, 2)

    return manufacturers
