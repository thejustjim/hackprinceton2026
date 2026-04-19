from __future__ import annotations

import json
import os
import unittest
from unittest.mock import AsyncMock, Mock, patch

from backend.scenario_editing import (
    ScenarioEditConfigError,
    SupplyScenarioPayload,
    edit_scenario_with_k2,
    normalize_edited_scenario,
    _get_k2think_settings,
)


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
            "graph": {
                "edges": [
                    {
                        "id": "edge_product_component",
                        "sourceId": "product_widget",
                        "targetId": "component_handle",
                    },
                    {
                        "id": "edge_component_current",
                        "sourceId": "component_handle",
                        "targetId": "mfr_current",
                    },
                    {
                        "id": "edge_component_alt",
                        "sourceId": "component_handle",
                        "targetId": "mfr_alt",
                    },
                ],
                "nodes": [
                    {
                        "data": {
                            "childIds": ["component_handle"],
                            "graphPosition": {"x": -20, "y": -30},
                            "id": "product_widget",
                            "kind": "product",
                            "label": "Widget",
                            "subtitle": "1,000 units",
                        },
                        "id": "product_widget",
                        "position": {"x": -20, "y": -30},
                    },
                    {
                        "data": {
                            "graphPosition": {"x": 10, "y": 20},
                            "id": "component_handle",
                            "kind": "component",
                            "label": "Handle",
                            "manufacturerIds": ["mfr_current", "mfr_alt"],
                        },
                        "id": "component_handle",
                        "position": {"x": 10, "y": 20},
                    },
                    {
                        "data": {
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
                            "manufacturingEmissionsTco2e": {
                                "q10": 1.0,
                                "q50": 2.0,
                                "q90": 3.0,
                            },
                            "name": "Current Manufacturing",
                            "transportEmissionsTco2e": 4.0,
                        },
                        "id": "mfr_current",
                        "position": {"x": 30, "y": 40},
                    },
                    {
                        "data": {
                            "certifications": ["sbt"],
                            "climateRiskScore": 20,
                            "componentId": "component_handle",
                            "componentLabel": "Handle",
                            "ecoScore": 30,
                            "graphPosition": {"x": 50, "y": 60},
                            "gridCarbonScore": 22,
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
                            "manufacturingEmissionsTco2e": {
                                "q10": 0.8,
                                "q50": 1.4,
                                "q90": 2.1,
                            },
                            "name": "Alt Manufacturing",
                            "transportEmissionsTco2e": 2.5,
                        },
                        "id": "mfr_alt",
                        "position": {"x": 50, "y": 60},
                    },
                ],
            },
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
                    "certifications": ["sbt"],
                    "climateRiskScore": 20,
                    "componentId": "component_handle",
                    "componentLabel": "Handle",
                    "ecoScore": 30,
                    "graphPosition": {"x": 50, "y": 60},
                    "gridCarbonScore": 22,
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
                "graphEdgeCount": 3,
                "graphNodeCount": 4,
                "routeCount": 2,
                "siteCount": 3,
            },
            "title": "Widget",
            "unit": "units",
            "updatedAt": "Sample dataset",
        }
    )


class ScenarioEditingTests(unittest.IsolatedAsyncioTestCase):
    def test_normalize_edited_scenario_applies_real_filter_edits(self) -> None:
        original = make_scenario()
        candidate = original.model_copy(deep=True)
        candidate.title = "Widget Mk II"
        candidate.quantity = 5000
        candidate.unit = "cases"
        candidate.destination.label = "Detroit"
        candidate.destination.location.city = "Detroit"
        candidate.components[0].label = "Grip"
        candidate.manufacturers[1].name = "Better Alt Manufacturing"
        candidate.manufacturers[1].ecoScore = 19
        candidate.manufacturers[1].isCurrent = True
        candidate.manufacturers = [candidate.manufacturers[1]]
        candidate.components[0].manufacturerIds = ["mfr_alt"]
        candidate.product.childIds = ["component_handle"]
        candidate.stats.graphNodeCount = 0

        normalized = normalize_edited_scenario(original, candidate)

        self.assertEqual(normalized.title, "Widget Mk II")
        self.assertEqual(normalized.unit, "cases")
        self.assertEqual(normalized.quantity, 5000)
        self.assertEqual(normalized.product.subtitle, "5,000 cases")
        self.assertEqual(normalized.components[0].label, "Grip")
        self.assertEqual(normalized.manufacturers[0].componentLabel, "Grip")
        self.assertEqual(len(normalized.manufacturers), 1)
        self.assertEqual(normalized.manufacturers[0].id, "mfr_alt")
        self.assertEqual(normalized.manufacturers[0].name, "Better Alt Manufacturing")
        self.assertTrue(normalized.manufacturers[0].isCurrent)
        self.assertEqual(normalized.components[0].manufacturerIds, ["mfr_alt"])
        self.assertEqual(
            [edge.id for edge in normalized.graph.edges],
            [
                "edge_product_widget_component_handle",
                "edge_component_handle_mfr_alt",
            ],
        )
        self.assertEqual(normalized.stats.graphNodeCount, 3)
        self.assertEqual(normalized.stats.routeCount, 1)
        self.assertTrue(normalized.updatedAt.startswith("Edited "))

    def test_normalize_edited_scenario_rejects_inconsistent_component_membership(self) -> None:
        original = make_scenario()
        candidate = original.model_copy(deep=True)
        candidate.manufacturers = [candidate.manufacturers[1]]
        candidate.components[0].manufacturerIds = ["mfr_current"]

        with self.assertRaisesRegex(
            Exception, "manufacturerIds must match its manufacturers in order"
        ):
            normalize_edited_scenario(original, candidate)

    def test_get_k2think_settings_requires_api_key(self) -> None:
        with patch.dict(
            os.environ,
            {"K2THINK_API_KEY": "", "K2THINK_MODEL": "MBZUAI-IFM/K2-Think-v2"},
            clear=False,
        ):
            with self.assertRaises(ScenarioEditConfigError):
                _get_k2think_settings()

    async def test_edit_scenario_with_k2_parses_model_output(self) -> None:
        scenario = make_scenario()
        candidate = scenario.model_copy(deep=True)
        candidate.title = "Edited Widget"
        response_payload = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "status": "applied",
                                "message": "Applied edit",
                                "scenario_json": json.dumps(
                                    candidate.model_dump(mode="json")
                                ),
                            }
                        )
                    }
                }
            ]
        }

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = response_payload

        with patch.dict(
            os.environ,
            {
                "K2THINK_API_KEY": "test-key",
                "K2THINK_MODEL": "MBZUAI-IFM/K2-Think-v2",
            },
            clear=False,
        ):
            with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_response)):
                result = await edit_scenario_with_k2("rename the scenario", scenario)

        self.assertEqual(result.status, "applied")
        self.assertIsNotNone(result.scenario)
        self.assertEqual(result.scenario.title, "Edited Widget")

    async def test_edit_scenario_with_k2_retries_invalid_json(self) -> None:
        scenario = make_scenario()
        candidate = scenario.model_copy(deep=True)
        candidate.manufacturers = [candidate.manufacturers[1]]
        candidate.manufacturers[0].isCurrent = True
        candidate.components[0].manufacturerIds = ["mfr_alt"]

        invalid_response = Mock()
        invalid_response.raise_for_status.return_value = None
        invalid_response.json.return_value = {
            "choices": [{"message": {"content": "not-json"}}]
        }

        valid_response = Mock()
        valid_response.raise_for_status.return_value = None
        valid_response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "status": "applied",
                                "message": "Applied filter",
                                "scenario_json": json.dumps(
                                    candidate.model_dump(mode="json")
                                ),
                            }
                        )
                    }
                }
            ]
        }

        with patch.dict(
            os.environ,
            {
                "K2THINK_API_KEY": "test-key",
                "K2THINK_MODEL": "MBZUAI-IFM/K2-Think-v2",
            },
            clear=False,
        ):
            with patch(
                "httpx.AsyncClient.post",
                new=AsyncMock(side_effect=[invalid_response, valid_response]),
            ) as mock_post:
                result = await edit_scenario_with_k2(
                    "only keep China options", scenario
                )

        self.assertEqual(mock_post.await_count, 2)
        self.assertEqual(result.status, "applied")
        self.assertIsNotNone(result.scenario)
        assert result.scenario is not None
        self.assertEqual(len(result.scenario.manufacturers), 1)
        self.assertEqual(result.scenario.manufacturers[0].id, "mfr_alt")


if __name__ == "__main__":
    unittest.main()
