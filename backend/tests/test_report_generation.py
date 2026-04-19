from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, Mock, patch

from backend.report_generation import (
    ReportGenerationConfigError,
    _build_report_context,
    _get_gemini_settings,
    generate_scenario_report_with_gemini,
)
from backend.scenario_editing import SupplyScenarioPayload


def make_scenario() -> SupplyScenarioPayload:
    return SupplyScenarioPayload.model_validate(
        {
            "components": [
                {
                    "graphPosition": {"x": 10, "y": 20},
                    "id": "component_handle",
                    "kind": "component",
                    "label": "Handle",
                    "manufacturerIds": ["mfr_current", "mfr_alt"],
                }
            ],
            "destination": {
                "id": "destination_main",
                "label": "Chicago",
                "location": {
                    "city": "Chicago",
                    "country": "United States",
                    "countryCode": "US",
                    "lat": 41.8781,
                    "lng": -87.6298,
                },
            },
            "graph": {"edges": [], "nodes": []},
            "id": "scenario_widget_001",
            "manufacturers": [
                {
                    "certifications": ["iso14001"],
                    "climateRiskScore": 25,
                    "componentId": "component_handle",
                    "componentLabel": "Handle",
                    "ecoScore": 55,
                    "graphPosition": {"x": 30, "y": 40},
                    "gridCarbonScore": 35,
                    "id": "mfr_current",
                    "isCurrent": True,
                    "kind": "manufacturer",
                    "location": {
                        "city": "Cleveland",
                        "country": "United States",
                        "countryCode": "US",
                        "lat": 41.4993,
                        "lng": -81.6944,
                    },
                    "manufacturingEmissionsTco2e": {"q10": 1.0, "q50": 2.0, "q90": 3.0},
                    "name": "Current Manufacturing",
                    "transportEmissionsTco2e": 4.0,
                },
                {
                    "certifications": ["sbt", "iso14001"],
                    "climateRiskScore": 20,
                    "componentId": "component_handle",
                    "componentLabel": "Handle",
                    "ecoScore": 30,
                    "graphPosition": {"x": 50, "y": 60},
                    "gridCarbonScore": 72,
                    "id": "mfr_alt",
                    "isCurrent": False,
                    "kind": "manufacturer",
                    "location": {
                        "city": "Hamburg",
                        "country": "Germany",
                        "countryCode": "DE",
                        "lat": 53.5511,
                        "lng": 9.9937,
                    },
                    "manufacturingEmissionsTco2e": {"q10": 0.8, "q50": 1.4, "q90": 2.1},
                    "name": "Alt Manufacturing",
                    "transportEmissionsTco2e": 2.5,
                },
            ],
            "product": {
                "childIds": ["component_handle"],
                "graphPosition": {"x": -20, "y": -30},
                "id": "product_widget",
                "kind": "product",
                "label": "Widget",
                "subtitle": "1,000 units",
            },
            "quantity": 1000,
            "routes": [
                {
                    "componentId": "component_handle",
                    "destinationId": "destination_main",
                    "id": "route_current",
                    "isCurrent": True,
                    "manufacturerId": "mfr_current",
                },
                {
                    "componentId": "component_handle",
                    "destinationId": "destination_main",
                    "id": "route_alt",
                    "isCurrent": False,
                    "manufacturerId": "mfr_alt",
                },
            ],
            "stats": {
                "componentCount": 1,
                "currentRouteCount": 1,
                "graphEdgeCount": 0,
                "graphNodeCount": 0,
                "routeCount": 2,
                "siteCount": 3,
            },
            "title": "Widget",
            "unit": "units",
            "updatedAt": "Sample dataset",
        }
    )


class ReportGenerationTests(unittest.IsolatedAsyncioTestCase):
    def test_get_gemini_settings_requires_api_key(self) -> None:
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=False):
            with self.assertRaises(ReportGenerationConfigError):
                _get_gemini_settings()

    def test_build_report_context_uses_selected_route(self) -> None:
        scenario = make_scenario()

        context = _build_report_context(
            scenario,
            selected_by_component={"component_handle": "mfr_alt"},
        )

        self.assertTrue(context["highlights"]["selectedPathDiffersFromCurrent"])
        self.assertTrue(context["highlights"]["selectedPathMatchesBestEco"])
        self.assertEqual(
            context["components"][0]["selectedManufacturerId"],
            "mfr_alt",
        )
        self.assertLess(
            context["paths"]["selectedVsCurrent"]["estimatedTotalQ50Tco2eDelta"],
            0,
        )

    async def test_generate_scenario_report_with_gemini_returns_markdown(self) -> None:
        scenario = make_scenario()

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": "# Executive Summary\n\nSelected path outperforms the baseline."
                            }
                        ]
                    }
                }
            ]
        }

        with patch.dict(
            os.environ,
            {
                "GEMINI_API_KEY": "test-key",
                "GEMINI_MODEL": "gemma-4-26b-a4b-it",
            },
            clear=False,
        ):
            with patch(
                "httpx.AsyncClient.post",
                new=AsyncMock(return_value=mock_response),
            ) as mock_post:
                result = await generate_scenario_report_with_gemini(
                    scenario,
                    selected_by_component={"component_handle": "mfr_alt"},
                )

        self.assertIn("Executive Summary", result.markdown)
        self.assertEqual(result.model, "gemma-4-26b-a4b-it")
        self.assertTrue(result.fileName.endswith(".md"))
        self.assertIn("/models/gemma-4-26b-a4b-it:generateContent", mock_post.await_args.args[0])


if __name__ == "__main__":
    unittest.main()
