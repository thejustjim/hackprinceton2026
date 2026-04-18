"""
inference.py
------------
GreenChain ML inference module — loaded once at FastAPI startup.

Provides:
  EmissionsModel        — XGBoost quantile regression wrapper
  TransportCalculator   — pure-formula GLEC transport emissions
  ScoreAssembler        — combines all 5 dimensions into composite score

Usage:
    from ml.inference import EmissionsModel, TransportCalculator, ScoreAssembler

    model = EmissionsModel.load()

    # Predict manufacturing emissions
    result = model.predict(
        country_iso="CN",
        naics4="3152",        # Cut & Sew Apparel
        revenue_usd_m=25.0,
        year=2023
    )
    # result = {"q10": 312.4, "q50": 841.7, "q90": 2240.1}   (tCO2e/$1M * revenue)

    # Transport
    transport = TransportCalculator.compute(
        origin_country="CN",
        destination_country="US",
        weight_tonnes=5.0,
        mode="sea"
    )
    # transport = {"tco2e": 7.2, "distance_km": 11812, "glec_factor": 0.011}
"""

import os, sys, json, math
import numpy as np
import pandas as pd
import joblib

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from ml.reference_data import (
    EMBER_GRID_INTENSITY, COUNTRY_EMISSION_MULTIPLIER, ND_GAIN_RISK,
    GLEC_FACTORS, COUNTRY_DEFAULT_PORT, get_port_distance, NAICS_DETAIL,
    get_grid_intensity, REGIONAL_GRID_INTENSITY
)

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")


# ============================================================
#  1. Emissions Model
# ============================================================
class EmissionsModel:
    """
    Wraps 3 XGBoost quantile models (q10, q50, q90).
    Call .predict() to get tCO2e estimates for a supplier config.
    """

    def __init__(self, models: dict, feature_cols: list):
        self.models        = models       # {0.10: xgb, 0.50: xgb, 0.90: xgb}
        self.feature_cols  = feature_cols
        self._country_set  = set()
        self._naics2_set   = set()
        self._naics_index  = self._build_naics_prefix_index()  # fast NAICS lookup
        # Infer known categories from feature column names
        for col in feature_cols:
            if col.startswith("ctry_"):
                self._country_set.add(col[5:])
            elif col.startswith("nac_"):
                self._naics2_set.add(col[4:])

    @classmethod
    def load(cls, model_dir: str = MODEL_DIR) -> "EmissionsModel":
        models = {}
        for q_int in [10, 50, 90]:
            path = os.path.join(model_dir, f"xgb_q{q_int:02d}.joblib")
            models[q_int / 100] = joblib.load(path)
        with open(os.path.join(model_dir, "feature_columns.json")) as f:
            feature_cols = json.load(f)
        print(f"[EmissionsModel] Loaded 3 quantile models ({len(feature_cols)} features)")
        return cls(models, feature_cols)

    @staticmethod
    def _build_naics_prefix_index() -> dict:
        """Pre-build prefix index for fast NAICS lookups (built once at import)."""
        index = {}
        for code, (n2, title, val) in NAICS_DETAIL.items():
            for length in [6, 5, 4, 3, 2]:
                prefix = code[:length]
                if prefix not in index:
                    index[prefix] = (n2, float(val))
        return index

    @staticmethod
    def _lookup_naics(naics_str: str, prefix_index: dict) -> tuple:
        """
        Returns (naics2, useeio_intensity) for any NAICS code length.
        Tries exact match then progressively shorter prefixes.
        """
        s = str(naics_str).strip()
        for length in [len(s), 5, 4, 3, 2]:
            hit = prefix_index.get(s[:length])
            if hit:
                return hit
        return ("33", 500_000.0)  # fallback: generic manufacturing

    def _build_row(self, country_iso: str, naics4: str, revenue_usd_m: float,
                   year: int, grid_override: float = None) -> pd.DataFrame:
        naics_str = str(naics4).strip()
        naics2, useeio_val = self._lookup_naics(naics_str, self._naics_index)

        grid      = grid_override if grid_override is not None else EMBER_GRID_INTENSITY.get(country_iso, 450)
        ctry_mult = COUNTRY_EMISSION_MULTIPLIER.get(country_iso, 1.0)

        log_useeio = math.log(max(useeio_val, 1_000))
        log_grid   = math.log(max(grid, 5))

        row = {col: 0 for col in self.feature_cols}
        row["log_revenue"]     = math.log10(max(revenue_usd_m, 0.1))
        row["log_grid"]        = log_grid
        row["year_offset"]     = year - 2018
        row["ctry_mult"]       = ctry_mult
        row["log_useeio_base"] = log_useeio

        # Interaction features
        if "useeio_x_grid" in row:
            row["useeio_x_grid"] = log_useeio * log_grid
        if "useeio_x_ctry" in row:
            row["useeio_x_ctry"] = log_useeio * ctry_mult

        if f"ctry_{country_iso}" in row:
            row[f"ctry_{country_iso}"] = 1
        if f"nac_{naics2}" in row:
            row[f"nac_{naics2}"]       = 1
        return pd.DataFrame([row])[self.feature_cols]

    def predict(self, country_iso: str, naics4: str,
                revenue_usd_m: float, year: int = 2023,
                region: str = None, renewable_pct: float = 0.0) -> dict:
        """
        Returns estimated manufacturing tCO2e for the given supplier config.

        Args:
            country_iso:   e.g. "CN", "US", "IN"
            naics4:        NAICS code, any length e.g. "315220", "3152", "31"
            revenue_usd_m: Annual revenue in $M
            year:          Reporting year (default 2023)
            region:        Sub-national region for finer grid accuracy.
                           e.g. "GD" or "CN-GD" for Guangdong, "CA" for California
                           Supported: CN provinces, US states, IN states, DE states
            renewable_pct: 0.0–1.0. Fraction of energy from renewables/RECs.
                           e.g. 0.8 means factory runs on 80% clean energy.
        """
        grid = get_grid_intensity(country_iso, region, renewable_pct)
        X    = self._build_row(country_iso, naics4, revenue_usd_m, year,
                               grid_override=grid)
        results = {}
        for q, model in self.models.items():
            log_pred  = model.predict(X)[0]
            intensity = float(np.exp(log_pred))
            total     = intensity * revenue_usd_m
            results[q] = round(total, 1)

        return {
            "q10_tco2e":                results[0.10],
            "q50_tco2e":                results[0.50],
            "q90_tco2e":                results[0.90],
            "intensity_tco2e_per_usdm": round(results[0.50] / max(revenue_usd_m, 0.1), 2),
            "country_iso":              country_iso,
            "region":                   region,
            "grid_gco2_kwh":            grid,
            "renewable_pct":            renewable_pct,
            "naics4":                   naics4,
            "revenue_usd_m":            revenue_usd_m,
        }


# ============================================================
#  2. Transport Calculator  (pure formula, no ML)
# ============================================================
class TransportCalculator:

    @staticmethod
    def compute(origin_country: str, destination_country: str,
                weight_tonnes: float, mode: str = "sea") -> dict:
        """
        tCO2e = GLEC_factor × weight_tonnes × distance_km / 1000
        (GLEC factor is per tonne-km, distance in km, factor in kgCO2/tonne-km
         → divide by 1000 to convert kg → tonnes)
        """
        mode = mode.lower()
        if mode not in GLEC_FACTORS:
            raise ValueError(f"Unknown mode '{mode}'. Choose from {list(GLEC_FACTORS)}")

        factor     = GLEC_FACTORS[mode]           # kgCO2 / tonne-km
        origin_port = COUNTRY_DEFAULT_PORT.get(origin_country, "CNSHA")
        dest_port   = COUNTRY_DEFAULT_PORT.get(destination_country, "USNYC")
        distance_km = get_port_distance(origin_port, dest_port)

        tco2e = factor * weight_tonnes * distance_km / 1000   # kg → tonne

        return {
            "tco2e":          round(tco2e, 2),
            "distance_km":    int(distance_km),
            "glec_factor":    factor,
            "mode":           mode,
            "origin_port":    origin_port,
            "dest_port":      dest_port,
            "weight_tonnes":  weight_tonnes,
        }

    @staticmethod
    def compare_all_modes(origin_country: str, destination_country: str,
                          weight_tonnes: float) -> dict:
        """Return transport tCO2e for all 4 modes side by side."""
        return {
            mode: TransportCalculator.compute(
                origin_country, destination_country, weight_tonnes, mode
            )["tco2e"]
            for mode in GLEC_FACTORS
        }


# ============================================================
#  3. Score Assembler — combines 5 dimensions into composite
# ============================================================
DEFAULT_WEIGHTS = {
    "manufacturing": 0.40,
    "transport":     0.25,
    "grid_carbon":   0.20,
    "certifications":0.10,
    "climate_risk":  0.05,
}

CERT_ADJUSTMENTS = {
    "iso14001":    -0.05,   # -5%  (ISO 14001, ISO-14001, iso14001 all match)
    "cdpa":        -0.10,   # -10% (CDP A, cdp_a, cdpa all match)
    "sbt":         -0.08,   # -8%  (SBT, Science Based Target)
    "nodisclosure": +0.15,  # +15% uncertainty penalty (internal use only)
}


class ScoreAssembler:
    """
    Combines all 5 environmental dimensions into a composite 0-100 score.
    Lower = better (less environmental impact).

    Score is normalised within the candidate set so ranking is relative.
    """

    @staticmethod
    def grid_score(country_iso: str) -> float:
        """Normalised grid carbon score: 0=cleanest, 100=dirtiest."""
        intensity = EMBER_GRID_INTENSITY.get(country_iso, 450)
        # Scale 0-100: 0 gCO2/kWh → 0, 900 gCO2/kWh → 100
        return round(min(intensity / 900 * 100, 100), 1)

    @staticmethod
    def climate_risk_score(country_iso: str) -> float:
        """ND-GAIN physical climate risk: 0=low risk, 100=high risk."""
        return ND_GAIN_RISK.get(country_iso, 50.0)

    @staticmethod
    def cert_adjustment(certifications: list[str]) -> float:
        """Multiplicative adjustment to manufacturing tCO2e from certifications."""
        adj = 1.0
        # Normalise: lowercase, strip hyphens/spaces/underscores for fuzzy match
        # e.g. "ISO-14001", "ISO 14001", "iso14001" all → "iso14001"
        certs_lower = [c.lower().replace("-","").replace("_","").replace(" ","") for c in certifications]
        if not certifications:
            adj += CERT_ADJUSTMENTS["nodisclosure"]
        else:
            for cert_key, delta in CERT_ADJUSTMENTS.items():
                if cert_key in certs_lower:
                    adj += delta
        return round(adj, 4)

    @staticmethod
    def normalise_to_100(values: list[float]) -> list[float]:
        """Min-max normalise a list to 0-100. Lower input = lower output."""
        mn, mx = min(values), max(values)
        if mx == mn:
            return [50.0] * len(values)
        return [round((v - mn) / (mx - mn) * 100, 1) for v in values]

    @classmethod
    def score_candidates(
        cls,
        candidates: list[dict],
        weights: dict = None
    ) -> list[dict]:
        """
        candidates: list of dicts, each must have:
          - name               : str
          - country_iso        : str
          - mfg_tco2e          : float  (from EmissionsModel.predict q50)
          - transport_tco2e    : float  (from TransportCalculator.compute)
          - certifications     : list[str]   e.g. ["iso14001", "sbt"]

        Returns: sorted list of candidates (ascending score = better first).
        """
        if not candidates:
            raise ValueError("candidates list is empty")
        required = {"name", "country_iso", "mfg_tco2e", "transport_tco2e"}
        for i, c in enumerate(candidates):
            missing = required - set(c.keys())
            if missing:
                raise ValueError(f"Candidate[{i}] missing required fields: {missing}")
            if c["mfg_tco2e"] < 0:
                raise ValueError(f"Candidate '{c['name']}': mfg_tco2e must be >= 0")
            if c["transport_tco2e"] < 0:
                raise ValueError(f"Candidate '{c['name']}': transport_tco2e must be >= 0")
            # Ensure certifications key always exists
            c.setdefault("certifications", [])

        weights = weights or DEFAULT_WEIGHTS
        # Normalise weights
        total_w = sum(weights.values())
        w = {k: v / total_w for k, v in weights.items()}

        # Apply cert adjustment to manufacturing
        for c in candidates:
            adj = cls.cert_adjustment(c.get("certifications", []))
            c["mfg_tco2e_adj"] = c["mfg_tco2e"] * adj
            c["cert_adj"]      = adj
            c["grid_raw"]      = EMBER_GRID_INTENSITY.get(c["country_iso"], 450)
            c["risk_raw"]      = ND_GAIN_RISK.get(c["country_iso"], 50.0)

        # Normalise each dimension across candidates
        mfg_norm    = cls.normalise_to_100([c["mfg_tco2e_adj"]  for c in candidates])
        trans_norm  = cls.normalise_to_100([c["transport_tco2e"] for c in candidates])
        grid_norm   = cls.normalise_to_100([c["grid_raw"]        for c in candidates])
        cert_norm   = cls.normalise_to_100([c["cert_adj"]        for c in candidates])
        risk_norm   = cls.normalise_to_100([c["risk_raw"]        for c in candidates])

        scored = []
        for i, c in enumerate(candidates):
            composite = (
                w["manufacturing"]  * mfg_norm[i]   +
                w["transport"]      * trans_norm[i]  +
                w["grid_carbon"]    * grid_norm[i]   +
                w["certifications"] * cert_norm[i]   +
                w["climate_risk"]   * risk_norm[i]
            )
            scored.append({
                **c,
                "score":           round(composite, 1),
                "mfg_norm":        mfg_norm[i],
                "transport_norm":  trans_norm[i],
                "grid_norm":       grid_norm[i],
                "cert_norm":       cert_norm[i],
                "risk_norm":       risk_norm[i],
                "total_tco2e":     round(c["mfg_tco2e_adj"] + c["transport_tco2e"], 1),
                "grid_gco2_kwh":   c["grid_raw"],
                "climate_risk_score": c["risk_raw"],
            })

        scored.sort(key=lambda x: x["score"])
        for rank, s in enumerate(scored, 1):
            s["rank"] = rank
        return scored
