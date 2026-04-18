from __future__ import annotations

import json
import os
import time
from typing import Any, Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SupplyScenarioGraphPositionPayload(StrictModel):
    x: float
    y: float


class SupplyScenarioLocationPayload(StrictModel):
    city: str
    country: str
    countryCode: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class SupplyScenarioManufacturingEmissionsPayload(StrictModel):
    q10: float = Field(ge=0)
    q50: float = Field(ge=0)
    q90: float = Field(ge=0)


class SupplyScenarioProductNodePayload(StrictModel):
    childIds: list[str]
    graphPosition: SupplyScenarioGraphPositionPayload
    id: str
    kind: Literal["product"]
    label: str
    subtitle: str | None = None


class SupplyScenarioComponentNodePayload(StrictModel):
    graphPosition: SupplyScenarioGraphPositionPayload
    id: str
    kind: Literal["component"]
    label: str
    manufacturerIds: list[str]


class SupplyScenarioManufacturerNodePayload(StrictModel):
    certifications: list[str]
    climateRiskScore: float = Field(ge=0, le=100)
    componentId: str
    componentLabel: str
    ecoScore: float = Field(ge=0, le=100)
    graphPosition: SupplyScenarioGraphPositionPayload
    gridCarbonScore: float = Field(ge=0, le=100)
    id: str
    isCurrent: bool
    kind: Literal["manufacturer"]
    location: SupplyScenarioLocationPayload
    manufacturingEmissionsTco2e: SupplyScenarioManufacturingEmissionsPayload
    name: str
    transportEmissionsTco2e: float = Field(ge=0)


class SupplyScenarioGraphNodeDataPayload(StrictModel):
    certifications: list[str] | None = None
    childIds: list[str] | None = None
    climateRiskScore: float | None = None
    componentId: str | None = None
    componentLabel: str | None = None
    ecoScore: float | None = None
    graphPosition: SupplyScenarioGraphPositionPayload
    gridCarbonScore: float | None = None
    id: str
    isCurrent: bool | None = None
    kind: Literal["product", "component", "manufacturer"]
    label: str | None = None
    location: SupplyScenarioLocationPayload | None = None
    manufacturerIds: list[str] | None = None
    manufacturingEmissionsTco2e: SupplyScenarioManufacturingEmissionsPayload | None = None
    name: str | None = None
    subtitle: str | None = None
    transportEmissionsTco2e: float | None = None


class SupplyScenarioGraphNodePayload(StrictModel):
    data: SupplyScenarioGraphNodeDataPayload
    id: str
    position: SupplyScenarioGraphPositionPayload


class SupplyScenarioGraphEdgePayload(StrictModel):
    id: str
    sourceId: str
    targetId: str


class SupplyScenarioDestinationPayload(StrictModel):
    id: str
    label: str
    location: SupplyScenarioLocationPayload


class SupplyScenarioRoutePayload(StrictModel):
    componentId: str
    destinationId: str
    id: str
    isCurrent: bool
    manufacturerId: str


class SupplyScenarioStatsPayload(StrictModel):
    componentCount: int = Field(ge=0)
    currentRouteCount: int = Field(ge=0)
    graphEdgeCount: int = Field(ge=0)
    graphNodeCount: int = Field(ge=0)
    routeCount: int = Field(ge=0)
    siteCount: int = Field(ge=0)


class SupplyScenarioPayload(StrictModel):
    components: list[SupplyScenarioComponentNodePayload]
    destination: SupplyScenarioDestinationPayload
    graph: "SupplyScenarioGraphPayload"
    id: str
    manufacturers: list[SupplyScenarioManufacturerNodePayload]
    product: SupplyScenarioProductNodePayload
    quantity: int = Field(ge=1)
    routes: list[SupplyScenarioRoutePayload]
    stats: SupplyScenarioStatsPayload
    title: str
    unit: str
    updatedAt: str


class SupplyScenarioGraphPayload(StrictModel):
    edges: list[SupplyScenarioGraphEdgePayload]
    nodes: list[SupplyScenarioGraphNodePayload]


class ScenarioEditRequestPayload(StrictModel):
    prompt: str
    scenario: SupplyScenarioPayload


class ScenarioEditModelOutputPayload(StrictModel):
    message: str
    scenario_json: str | None = None
    status: Literal["applied", "rejected"]


class ScenarioEditResponsePayload(StrictModel):
    message: str
    scenario: SupplyScenarioPayload | None = None
    status: Literal["applied", "rejected"]


class ScenarioEditConfigError(RuntimeError):
    pass


class ScenarioEditProviderError(RuntimeError):
    pass


class ScenarioEditValidationError(ValueError):
    pass


def _strip_schema_annotations(value: Any) -> Any:
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for key, nested_value in value.items():
            if key in {"title", "description", "default", "examples"}:
                continue
            sanitized[key] = _strip_schema_annotations(nested_value)
        return sanitized

    if isinstance(value, list):
        return [_strip_schema_annotations(item) for item in value]

    return value


def _normalize_base_url(value: str | None) -> str:
    raw = (value or "https://api.k2think.ai/v1").strip().rstrip("/")
    if not raw:
        return "https://api.k2think.ai/v1"
    return raw


def _get_k2think_settings() -> tuple[str, str, str]:
    api_key = os.environ.get("K2THINK_API_KEY", "").strip()
    if not api_key:
        raise ScenarioEditConfigError(
            "K2THINK_API_KEY is not set. Add it to backend/.env before using prompt edits."
        )

    model = os.environ.get("K2THINK_MODEL", "MBZUAI-IFM/K2-Think-v2").strip()
    if not model:
        raise ScenarioEditConfigError(
            "K2THINK_MODEL is empty. Set it to your K2 Think model name."
        )

    base_url = _normalize_base_url(os.environ.get("K2THINK_BASE_URL"))
    return api_key, model, base_url


def _format_updated_at() -> str:
    return f"Edited {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())}"


def _product_subtitle(quantity: int, unit: str) -> str:
    return f"{quantity:,} {unit}"


def _non_empty(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ScenarioEditValidationError(f"{field_name} cannot be empty.")
    return normalized


def _validate_structure(
    original: SupplyScenarioPayload, candidate: SupplyScenarioPayload
) -> None:
    if candidate.id != original.id:
        raise ScenarioEditValidationError("Scenario ID cannot be changed.")

    if candidate.product.id != original.product.id:
        raise ScenarioEditValidationError("Product node ID cannot be changed.")

    if candidate.destination.id != original.destination.id:
        raise ScenarioEditValidationError("Destination ID cannot be changed.")

    original_component_ids = [component.id for component in original.components]
    candidate_component_ids = [component.id for component in candidate.components]
    if candidate_component_ids != original_component_ids:
        raise ScenarioEditValidationError(
            "Components cannot be added, removed, or reordered."
        )

    original_manufacturer_ids = [
        manufacturer.id for manufacturer in original.manufacturers
    ]
    candidate_manufacturer_ids = [
        manufacturer.id for manufacturer in candidate.manufacturers
    ]
    if candidate_manufacturer_ids != original_manufacturer_ids:
        raise ScenarioEditValidationError(
            "Manufacturers cannot be added, removed, or reordered."
        )

    if candidate.product.childIds != original.product.childIds:
        raise ScenarioEditValidationError(
            "Product-to-component structure cannot be changed."
        )

    for original_component, candidate_component in zip(
        original.components, candidate.components, strict=True
    ):
        if candidate_component.manufacturerIds != original_component.manufacturerIds:
            raise ScenarioEditValidationError(
                "Component manufacturer membership cannot be changed."
            )

    for original_manufacturer, candidate_manufacturer in zip(
        original.manufacturers, candidate.manufacturers, strict=True
    ):
        if candidate_manufacturer.componentId != original_manufacturer.componentId:
            raise ScenarioEditValidationError(
                "Manufacturer component assignments cannot be changed."
            )

    original_edges = [
        (edge.id, edge.sourceId, edge.targetId) for edge in original.graph.edges
    ]
    candidate_edges = [
        (edge.id, edge.sourceId, edge.targetId) for edge in candidate.graph.edges
    ]
    if candidate_edges != original_edges:
        raise ScenarioEditValidationError("Graph edges cannot be changed.")

    original_routes = [
        (route.id, route.componentId, route.destinationId, route.manufacturerId)
        for route in original.routes
    ]
    candidate_routes = [
        (route.id, route.componentId, route.destinationId, route.manufacturerId)
        for route in candidate.routes
    ]
    if candidate_routes != original_routes:
        raise ScenarioEditValidationError("Routes cannot be added or rewired.")

    original_graph_node_ids = [node.id for node in original.graph.nodes]
    candidate_graph_node_ids = [node.id for node in candidate.graph.nodes]
    if candidate_graph_node_ids != original_graph_node_ids:
        raise ScenarioEditValidationError("Graph nodes cannot be added or removed.")


def _build_graph_node_data(
    node: (
        SupplyScenarioProductNodePayload
        | SupplyScenarioComponentNodePayload
        | SupplyScenarioManufacturerNodePayload
    ),
) -> SupplyScenarioGraphNodeDataPayload:
    if node.kind == "product":
        return SupplyScenarioGraphNodeDataPayload(
            childIds=node.childIds,
            graphPosition=node.graphPosition,
            id=node.id,
            kind=node.kind,
            label=node.label,
            subtitle=node.subtitle,
        )

    if node.kind == "component":
        return SupplyScenarioGraphNodeDataPayload(
            graphPosition=node.graphPosition,
            id=node.id,
            kind=node.kind,
            label=node.label,
            manufacturerIds=node.manufacturerIds,
        )

    return SupplyScenarioGraphNodeDataPayload(
        certifications=node.certifications,
        climateRiskScore=node.climateRiskScore,
        componentId=node.componentId,
        componentLabel=node.componentLabel,
        ecoScore=node.ecoScore,
        graphPosition=node.graphPosition,
        gridCarbonScore=node.gridCarbonScore,
        id=node.id,
        isCurrent=node.isCurrent,
        kind=node.kind,
        location=node.location,
        manufacturingEmissionsTco2e=node.manufacturingEmissionsTco2e,
        name=node.name,
        transportEmissionsTco2e=node.transportEmissionsTco2e,
    )


def normalize_edited_scenario(
    original: SupplyScenarioPayload, candidate: SupplyScenarioPayload
) -> SupplyScenarioPayload:
    _validate_structure(original, candidate)

    title = _non_empty(candidate.title, "Scenario title")
    unit = _non_empty(candidate.unit, "Scenario unit")
    quantity = candidate.quantity

    product = original.product.model_copy(
        update={
            "label": _non_empty(candidate.product.label, "Product label"),
            "subtitle": _product_subtitle(quantity, unit),
        }
    )

    normalized_components: list[SupplyScenarioComponentNodePayload] = []
    component_label_by_id: dict[str, str] = {}
    for original_component, candidate_component in zip(
        original.components, candidate.components, strict=True
    ):
        label = _non_empty(candidate_component.label, "Component label")
        component_label_by_id[original_component.id] = label
        normalized_components.append(
            original_component.model_copy(update={"label": label})
        )

    normalized_manufacturers: list[SupplyScenarioManufacturerNodePayload] = []
    current_count_by_component: dict[str, int] = {
        component.id: 0 for component in original.components
    }
    for original_manufacturer, candidate_manufacturer in zip(
        original.manufacturers, candidate.manufacturers, strict=True
    ):
        component_label = component_label_by_id[original_manufacturer.componentId]
        name = _non_empty(candidate_manufacturer.name, "Manufacturer name")
        location = candidate_manufacturer.location.model_copy(
            update={
                "city": _non_empty(
                    candidate_manufacturer.location.city, "Manufacturer city"
                ),
                "country": _non_empty(
                    candidate_manufacturer.location.country, "Manufacturer country"
                ),
                "countryCode": _non_empty(
                    candidate_manufacturer.location.countryCode,
                    "Manufacturer country code",
                ).upper(),
            }
        )
        normalized_manufacturer = original_manufacturer.model_copy(
            update={
                "certifications": candidate_manufacturer.certifications,
                "climateRiskScore": candidate_manufacturer.climateRiskScore,
                "componentLabel": component_label,
                "ecoScore": candidate_manufacturer.ecoScore,
                "gridCarbonScore": candidate_manufacturer.gridCarbonScore,
                "isCurrent": candidate_manufacturer.isCurrent,
                "location": location,
                "manufacturingEmissionsTco2e": candidate_manufacturer.manufacturingEmissionsTco2e,
                "name": name,
                "transportEmissionsTco2e": candidate_manufacturer.transportEmissionsTco2e,
            }
        )
        normalized_manufacturers.append(normalized_manufacturer)
        if normalized_manufacturer.isCurrent:
            current_count_by_component[normalized_manufacturer.componentId] += 1

    invalid_components = [
        component_id
        for component_id, current_count in current_count_by_component.items()
        if current_count != 1
    ]
    if invalid_components:
        raise ScenarioEditValidationError(
            "Each component must have exactly one current manufacturer."
        )

    destination = original.destination.model_copy(
        update={
            "label": _non_empty(candidate.destination.label, "Destination label"),
            "location": candidate.destination.location.model_copy(
                update={
                    "city": _non_empty(
                        candidate.destination.location.city, "Destination city"
                    ),
                    "country": _non_empty(
                        candidate.destination.location.country, "Destination country"
                    ),
                    "countryCode": _non_empty(
                        candidate.destination.location.countryCode,
                        "Destination country code",
                    ).upper(),
                }
            ),
        }
    )

    normalized_routes = [
        original_route.model_copy(
            update={
                "isCurrent": next(
                    manufacturer.isCurrent
                    for manufacturer in normalized_manufacturers
                    if manufacturer.id == original_route.manufacturerId
                )
            }
        )
        for original_route in original.routes
    ]

    node_by_id: dict[str, Any] = {product.id: product}
    node_by_id.update({component.id: component for component in normalized_components})
    node_by_id.update(
        {manufacturer.id: manufacturer for manufacturer in normalized_manufacturers}
    )

    normalized_graph_nodes = [
        SupplyScenarioGraphNodePayload(
            data=_build_graph_node_data(node_by_id[original_node.id]),
            id=original_node.id,
            position=node_by_id[original_node.id].graphPosition,
        )
        for original_node in original.graph.nodes
    ]

    graph = SupplyScenarioGraphPayload(
        edges=original.graph.edges,
        nodes=normalized_graph_nodes,
    )

    stats = SupplyScenarioStatsPayload(
        componentCount=len(normalized_components),
        currentRouteCount=sum(route.isCurrent for route in normalized_routes),
        graphEdgeCount=len(graph.edges),
        graphNodeCount=len(graph.nodes),
        routeCount=len(normalized_routes),
        siteCount=len(normalized_manufacturers) + 1,
    )

    return SupplyScenarioPayload(
        components=normalized_components,
        destination=destination,
        graph=graph,
        id=original.id,
        manufacturers=normalized_manufacturers,
        product=product,
        quantity=quantity,
        routes=normalized_routes,
        stats=stats,
        title=title,
        unit=unit,
        updatedAt=_format_updated_at(),
    )


def _build_edit_messages(prompt: str, scenario: SupplyScenarioPayload) -> list[dict[str, str]]:
    scenario_json = json.dumps(
        scenario.model_dump(mode="json"),
        separators=(",", ":"),
    )
    return [
        {
            "role": "system",
            "content": (
                "You edit a supply-chain scenario JSON document. "
                "Allowed edits: scenario title, quantity, unit, destination label/location, "
                "product/component/manufacturer labels, manufacturer metadata, scores, "
                "certifications, location fields, and which existing manufacturer is current. "
                "Do not add, remove, reorder, or rename IDs for nodes, routes, or edges. "
                "Do not change graph topology, memberships, route wiring, or identifiers. "
                "If the user's request requires structural changes, respond with status='rejected' "
                "and explain why in message. If it can be safely applied, respond with "
                "status='applied', a short message, and scenario_json containing the full "
                "edited scenario JSON object serialized as a JSON string. "
                "Return JSON only. No markdown fences or extra prose."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Edit request:\n{prompt.strip()}\n\n"
                "Current scenario JSON:\n"
                f"{scenario_json}"
            ),
        },
    ]


async def edit_scenario_with_k2(
    prompt: str, scenario: SupplyScenarioPayload
) -> ScenarioEditResponsePayload:
    api_key, model, base_url = _get_k2think_settings()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "accept": "application/json",
        "Content-Type": "application/json",
    }

    request_body = {
        "model": model,
        "messages": _build_edit_messages(prompt, scenario),
        "stream": False,
        "temperature": 0.1,
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=request_body,
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip()
        raise ScenarioEditProviderError(
            f"K2 Think request failed with {exc.response.status_code}: {detail or exc.response.reason_phrase}"
        ) from exc
    except httpx.HTTPError as exc:
        raise ScenarioEditProviderError(
            f"K2 Think request failed: {type(exc).__name__}: {exc}"
        ) from exc

    payload = response.json()
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ScenarioEditProviderError(
            "K2 Think response did not include a chat completion payload."
        ) from exc

    if isinstance(content, list):
        content = "".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict)
        )

    try:
        decoded = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ScenarioEditProviderError(
            "K2 Think did not return valid JSON for the scenario edit response."
        ) from exc

    try:
        model_output = ScenarioEditModelOutputPayload.model_validate(decoded)
    except Exception as exc:  # noqa: BLE001
        raise ScenarioEditProviderError(
            f"K2 Think returned a response that did not match the expected shape: {exc}"
        ) from exc

    if model_output.status == "rejected":
        return ScenarioEditResponsePayload(
            message=model_output.message,
            status="rejected",
        )

    if not model_output.scenario_json:
        raise ScenarioEditProviderError(
            "K2 Think returned an applied response without scenario_json."
        )

    try:
        scenario_payload = json.loads(model_output.scenario_json)
    except json.JSONDecodeError as exc:
        raise ScenarioEditProviderError(
            "K2 Think returned an invalid scenario_json payload."
        ) from exc

    try:
        scenario = SupplyScenarioPayload.model_validate(scenario_payload)
    except Exception as exc:  # noqa: BLE001
        raise ScenarioEditProviderError(
            f"K2 Think returned a scenario payload that failed validation: {exc}"
        ) from exc

    return ScenarioEditResponsePayload(
        message=model_output.message,
        scenario=scenario,
        status="applied",
    )
