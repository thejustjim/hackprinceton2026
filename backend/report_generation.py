from __future__ import annotations

import json
import os
import re
import time
from statistics import mean
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field

from .scenario_editing import (
    SupplyScenarioComponentNodePayload,
    SupplyScenarioManufacturerNodePayload,
    SupplyScenarioPayload,
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ScenarioReportRequestPayload(StrictModel):
    scenario: SupplyScenarioPayload
    selectedManufacturerByComponent: dict[str, str] = Field(default_factory=dict)


class ScenarioReportResponsePayload(StrictModel):
    fileName: str
    generatedAt: str
    markdown: str
    mimeType: str = "text/markdown"
    model: str


class ReportGenerationConfigError(RuntimeError):
    pass


class ReportGenerationProviderError(RuntimeError):
    pass


def _normalize_gemini_base_url(value: str | None) -> str:
    raw = (value or "https://generativelanguage.googleapis.com/v1beta").strip().rstrip("/")
    if not raw:
        return "https://generativelanguage.googleapis.com/v1beta"
    return raw


def _get_gemini_settings() -> tuple[str, str, str, str | None]:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ReportGenerationConfigError(
            "GEMINI_API_KEY is not set. Add it to backend/.env before using report downloads."
        )

    model = os.environ.get("GEMINI_MODEL", "gemma-4-26b-a4b-it").strip()
    if not model:
        raise ReportGenerationConfigError(
            "GEMINI_MODEL is empty. Set it to a valid Gemini API model name."
        )

    thinking_level = os.environ.get("GEMINI_THINKING_LEVEL", "").strip() or None
    base_url = _normalize_gemini_base_url(os.environ.get("GEMINI_BASE_URL"))
    return api_key, model, base_url, thinking_level


def _round(value: float, digits: int = 2) -> float:
    return round(float(value), digits)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:64] or "scenario"


def _report_timestamp() -> str:
    return time.strftime("%Y%m%d_%H%M%SZ", time.gmtime())


def _report_generated_at() -> str:
    return time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime())


def _manufacturer_metrics(
    manufacturer: SupplyScenarioManufacturerNodePayload,
) -> dict[str, Any]:
    manufacturing = manufacturer.manufacturingEmissionsTco2e
    total_q50 = manufacturing.q50 + manufacturer.transportEmissionsTco2e
    return {
        "id": manufacturer.id,
        "name": manufacturer.name,
        "isCurrent": manufacturer.isCurrent,
        "location": {
            "city": manufacturer.location.city,
            "country": manufacturer.location.country,
            "countryCode": manufacturer.location.countryCode,
        },
        "certifications": manufacturer.certifications,
        "signals": {
            "ecoScore": manufacturer.ecoScore,
            "climateRiskScore": manufacturer.climateRiskScore,
            "gridCarbonScore": manufacturer.gridCarbonScore,
            "manufacturingEmissionsTco2e": {
                "q10": manufacturing.q10,
                "q50": manufacturing.q50,
                "q90": manufacturing.q90,
            },
            "transportEmissionsTco2e": manufacturer.transportEmissionsTco2e,
            "estimatedTotalQ50Tco2e": _round(total_q50),
        },
    }


def _path_summary(
    label: str,
    manufacturers: list[SupplyScenarioManufacturerNodePayload],
) -> dict[str, Any]:
    if not manufacturers:
        return {
            "label": label,
            "componentCount": 0,
            "manufacturers": [],
            "totals": {},
        }

    manufacturing_q10 = sum(item.manufacturingEmissionsTco2e.q10 for item in manufacturers)
    manufacturing_q50 = sum(item.manufacturingEmissionsTco2e.q50 for item in manufacturers)
    manufacturing_q90 = sum(item.manufacturingEmissionsTco2e.q90 for item in manufacturers)
    transport_total = sum(item.transportEmissionsTco2e for item in manufacturers)

    certifications = sorted(
        {
            certification
            for manufacturer in manufacturers
            for certification in manufacturer.certifications
        }
    )

    return {
        "label": label,
        "componentCount": len(manufacturers),
        "manufacturers": [
            {
                "componentId": manufacturer.componentId,
                "componentLabel": manufacturer.componentLabel,
                **_manufacturer_metrics(manufacturer),
            }
            for manufacturer in manufacturers
        ],
        "totals": {
            "manufacturingQ10Tco2e": _round(manufacturing_q10),
            "manufacturingQ50Tco2e": _round(manufacturing_q50),
            "manufacturingQ90Tco2e": _round(manufacturing_q90),
            "transportTco2e": _round(transport_total),
            "estimatedTotalQ50Tco2e": _round(manufacturing_q50 + transport_total),
            "averageEcoScore": _round(mean(item.ecoScore for item in manufacturers), 1),
            "averageClimateRiskScore": _round(
                mean(item.climateRiskScore for item in manufacturers), 1
            ),
            "averageGridCarbonScore": _round(
                mean(item.gridCarbonScore for item in manufacturers), 1
            ),
            "uniqueCertifications": certifications,
            "uniqueCertificationCount": len(certifications),
        },
    }


def _delta_summary(
    baseline: SupplyScenarioManufacturerNodePayload,
    candidate: SupplyScenarioManufacturerNodePayload,
) -> dict[str, Any]:
    baseline_total = (
        baseline.manufacturingEmissionsTco2e.q50 + baseline.transportEmissionsTco2e
    )
    candidate_total = (
        candidate.manufacturingEmissionsTco2e.q50 + candidate.transportEmissionsTco2e
    )
    absolute_delta = candidate_total - baseline_total
    percent_delta = 0.0
    if baseline_total > 0:
        percent_delta = (absolute_delta / baseline_total) * 100

    return {
        "estimatedTotalQ50Tco2eDelta": _round(absolute_delta),
        "estimatedTotalQ50PctDelta": _round(percent_delta, 1),
        "ecoScoreDelta": _round(candidate.ecoScore - baseline.ecoScore, 1),
        "transportTco2eDelta": _round(
            candidate.transportEmissionsTco2e - baseline.transportEmissionsTco2e
        ),
        "manufacturingQ50Tco2eDelta": _round(
            candidate.manufacturingEmissionsTco2e.q50
            - baseline.manufacturingEmissionsTco2e.q50
        ),
        "gridCarbonScoreDelta": _round(
            candidate.gridCarbonScore - baseline.gridCarbonScore, 1
        ),
        "climateRiskScoreDelta": _round(
            candidate.climateRiskScore - baseline.climateRiskScore, 1
        ),
    }


def _path_delta_summary(
    baseline: dict[str, Any],
    candidate: dict[str, Any],
) -> dict[str, Any]:
    baseline_totals = baseline.get("totals", {})
    candidate_totals = candidate.get("totals", {})
    baseline_total = float(baseline_totals.get("estimatedTotalQ50Tco2e") or 0)
    candidate_total = float(candidate_totals.get("estimatedTotalQ50Tco2e") or 0)
    absolute_delta = candidate_total - baseline_total
    percent_delta = 0.0
    if baseline_total > 0:
        percent_delta = (absolute_delta / baseline_total) * 100

    return {
        "estimatedTotalQ50Tco2eDelta": _round(absolute_delta),
        "estimatedTotalQ50PctDelta": _round(percent_delta, 1),
        "manufacturingQ50Tco2eDelta": _round(
            float(candidate_totals.get("manufacturingQ50Tco2e") or 0)
            - float(baseline_totals.get("manufacturingQ50Tco2e") or 0)
        ),
        "transportTco2eDelta": _round(
            float(candidate_totals.get("transportTco2e") or 0)
            - float(baseline_totals.get("transportTco2e") or 0)
        ),
        "averageEcoScoreDelta": _round(
            float(candidate_totals.get("averageEcoScore") or 0)
            - float(baseline_totals.get("averageEcoScore") or 0),
            1,
        ),
        "averageClimateRiskScoreDelta": _round(
            float(candidate_totals.get("averageClimateRiskScore") or 0)
            - float(baseline_totals.get("averageClimateRiskScore") or 0),
            1,
        ),
        "averageGridCarbonScoreDelta": _round(
            float(candidate_totals.get("averageGridCarbonScore") or 0)
            - float(baseline_totals.get("averageGridCarbonScore") or 0),
            1,
        ),
    }


def _resolve_selected_manufacturer(
    component: SupplyScenarioComponentNodePayload,
    manufacturers_by_component: dict[str, list[SupplyScenarioManufacturerNodePayload]],
    selected_by_component: dict[str, str],
) -> SupplyScenarioManufacturerNodePayload:
    options = manufacturers_by_component[component.id]
    selected_id = selected_by_component.get(component.id)
    if selected_id:
        selected = next((item for item in options if item.id == selected_id), None)
        if selected:
            return selected

    current = next((item for item in options if item.isCurrent), None)
    if current:
        return current

    return options[0]


def _build_report_context(
    scenario: SupplyScenarioPayload,
    selected_by_component: dict[str, str],
) -> dict[str, Any]:
    manufacturers_by_component = {
        component.id: [
            manufacturer
            for manufacturer in scenario.manufacturers
            if manufacturer.componentId == component.id
        ]
        for component in scenario.components
    }

    current_path: list[SupplyScenarioManufacturerNodePayload] = []
    selected_path: list[SupplyScenarioManufacturerNodePayload] = []
    best_eco_path: list[SupplyScenarioManufacturerNodePayload] = []
    components_summary: list[dict[str, Any]] = []

    for component in scenario.components:
        options = manufacturers_by_component.get(component.id, [])
        if not options:
            continue

        current = next((item for item in options if item.isCurrent), options[0])
        selected = _resolve_selected_manufacturer(
            component, manufacturers_by_component, selected_by_component
        )
        best_eco = min(options, key=lambda item: (item.ecoScore, not item.isCurrent))

        current_path.append(current)
        selected_path.append(selected)
        best_eco_path.append(best_eco)

        option_summaries = sorted(
            (_manufacturer_metrics(option) for option in options),
            key=lambda option: (
                float(option["signals"]["ecoScore"]),
                option["name"].lower(),
            ),
        )
        components_summary.append(
            {
                "componentId": component.id,
                "componentLabel": component.label,
                "currentManufacturerId": current.id,
                "selectedManufacturerId": selected.id,
                "bestEcoManufacturerId": best_eco.id,
                "selectedDiffersFromCurrent": selected.id != current.id,
                "selectedMatchesBestEco": selected.id == best_eco.id,
                "currentVsSelected": _delta_summary(current, selected),
                "currentVsBestEco": _delta_summary(current, best_eco),
                "manufacturers": option_summaries,
            }
        )

    current_summary = _path_summary("Current path", current_path)
    selected_summary = _path_summary("Selected path", selected_path)
    best_eco_summary = _path_summary("Best eco path", best_eco_path)

    current_hotspots = sorted(
        (
            {
                "componentLabel": manufacturer.componentLabel,
                "manufacturerName": manufacturer.name,
                "estimatedTotalQ50Tco2e": _round(
                    manufacturer.manufacturingEmissionsTco2e.q50
                    + manufacturer.transportEmissionsTco2e
                ),
            }
            for manufacturer in current_path
        ),
        key=lambda item: item["estimatedTotalQ50Tco2e"],
        reverse=True,
    )[:3]

    reduction_opportunities = sorted(
        (
            {
                "componentLabel": component["componentLabel"],
                "currentManufacturerId": component["currentManufacturerId"],
                "bestEcoManufacturerId": component["bestEcoManufacturerId"],
                "estimatedTotalQ50Tco2eDelta": component["currentVsBestEco"][
                    "estimatedTotalQ50Tco2eDelta"
                ],
                "estimatedTotalQ50PctDelta": component["currentVsBestEco"][
                    "estimatedTotalQ50PctDelta"
                ],
            }
            for component in components_summary
        ),
        key=lambda item: item["estimatedTotalQ50Tco2eDelta"],
    )[:3]

    selected_changes = [
        {
            "componentLabel": component["componentLabel"],
            "currentManufacturerId": component["currentManufacturerId"],
            "selectedManufacturerId": component["selectedManufacturerId"],
        }
        for component in components_summary
        if component["selectedDiffersFromCurrent"]
    ]

    return {
        "scenario": {
            "id": scenario.id,
            "title": scenario.title,
            "quantity": scenario.quantity,
            "unit": scenario.unit,
            "updatedAt": scenario.updatedAt,
            "destination": {
                "label": scenario.destination.label,
                "country": scenario.destination.location.country,
                "countryCode": scenario.destination.location.countryCode,
            },
            "stats": scenario.stats.model_dump(mode="json"),
        },
        "signalDirections": {
            "ecoScore": "lower is better",
            "climateRiskScore": "lower is better",
            "gridCarbonScore": "higher is better",
            "manufacturingEmissionsTco2e": "lower is better",
            "transportEmissionsTco2e": "lower is better",
            "estimatedTotalQ50Tco2e": "lower is better",
            "certifications": "more relevant certifications are generally better",
        },
        "paths": {
            "current": current_summary,
            "selected": selected_summary,
            "bestEco": best_eco_summary,
            "selectedVsCurrent": _path_delta_summary(current_summary, selected_summary),
            "bestEcoVsCurrent": _path_delta_summary(current_summary, best_eco_summary),
        },
        "components": components_summary,
        "highlights": {
            "selectedPathDiffersFromCurrent": bool(selected_changes),
            "selectedPathMatchesBestEco": all(
                component["selectedMatchesBestEco"] for component in components_summary
            )
            if components_summary
            else True,
            "selectedRouteChanges": selected_changes,
            "currentHotspots": current_hotspots,
            "biggestReductionOpportunities": reduction_opportunities,
        },
    }


def _build_report_prompt(context: dict[str, Any]) -> str:
    context_json = json.dumps(context, separators=(",", ":"), ensure_ascii=True)
    return (
        "Generate a comprehensive markdown sustainability report for this supply-chain "
        "scenario using only the provided signal bundle.\n\n"
        "Requirements:\n"
        "- Treat the JSON as the source of truth. Do not invent facts, suppliers, or metrics.\n"
        "- Explicitly use every signal family somewhere in the report: eco score, climate risk, "
        "grid carbon score, manufacturing q10/q50/q90, transport emissions, certifications, "
        "component-level deltas, and path-level totals.\n"
        "- Compare three paths when available: current path, selected path, and best eco path.\n"
        "- Explain tradeoffs, not just the lowest-emissions option.\n"
        "- Keep the report decision-oriented and suitable for download by an operations user.\n"
        "- Use concise markdown headings and bullets. Include at least these sections:\n"
        "  1. Executive Summary\n"
        "  2. Path Comparison\n"
        "  3. Component Findings\n"
        "  4. Risks And Signal Readout\n"
        "  5. Recommended Actions\n"
        "- When the selected path already matches the best eco path, say so directly.\n"
        "- When a metric direction matters, respect the provided signalDirections metadata.\n"
        "- Mention uncertainty correctly: q10/q50/q90 refer to manufacturing emissions only.\n"
        "- Keep the report under roughly 1,200 words.\n\n"
        f"Signal bundle JSON:\n{context_json}"
    )


def _extract_text_response(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise ReportGenerationProviderError(
            "Gemini response did not include any candidates."
        )

    content = candidates[0].get("content")
    if not isinstance(content, dict):
        raise ReportGenerationProviderError(
            "Gemini response did not include a candidate content payload."
        )

    parts = content.get("parts")
    if not isinstance(parts, list) or not parts:
        raise ReportGenerationProviderError(
            "Gemini response did not include text parts."
        )

    text = "".join(
        part.get("text", "")
        for part in parts
        if isinstance(part, dict) and isinstance(part.get("text"), str)
    ).strip()

    if not text:
        raise ReportGenerationProviderError(
            "Gemini response did not include any text content."
        )

    return text


async def generate_scenario_report_with_gemini(
    scenario: SupplyScenarioPayload,
    selected_by_component: dict[str, str] | None = None,
) -> ScenarioReportResponsePayload:
    api_key, model, base_url, thinking_level = _get_gemini_settings()
    selected_lookup = selected_by_component or {}
    context = _build_report_context(scenario, selected_lookup)
    prompt = _build_report_prompt(context)
    generated_at = _report_generated_at()

    request_body: dict[str, Any] = {
        "systemInstruction": {
            "parts": [
                {
                    "text": (
                        "You are GreenChain's report writer. "
                        "Write factual markdown grounded only in the supplied scenario metrics. "
                        "Prefer direct comparisons and quantified statements."
                    )
                }
            ]
        },
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 4096,
        },
    }

    if thinking_level:
        request_body["generationConfig"]["thinkingConfig"] = {
            "thinkingLevel": thinking_level
        }

    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=90) as client:
        try:
            response = await client.post(
                f"{base_url}/models/{model}:generateContent",
                headers=headers,
                json=request_body,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text.strip()
            raise ReportGenerationProviderError(
                f"Gemini request failed with {exc.response.status_code}: "
                f"{detail or exc.response.reason_phrase}"
            ) from exc
        except httpx.HTTPError as exc:
            raise ReportGenerationProviderError(
                f"Gemini request failed: {type(exc).__name__}: {exc}"
            ) from exc

    payload = response.json()
    markdown = _extract_text_response(payload)
    file_name = f"greenchain-{_slugify(scenario.title)}-report-{_report_timestamp()}.md"

    return ScenarioReportResponsePayload(
        fileName=file_name,
        generatedAt=generated_at,
        markdown=markdown,
        model=model,
    )
