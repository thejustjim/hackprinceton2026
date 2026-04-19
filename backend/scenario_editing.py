from __future__ import annotations

import json
import os
import time
from typing import Literal

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


class EditableScenarioPayload(StrictModel):
    components: list[SupplyScenarioComponentNodePayload]
    destination: SupplyScenarioDestinationPayload
    id: str
    manufacturers: list[SupplyScenarioManufacturerNodePayload]
    product: SupplyScenarioProductNodePayload
    quantity: int = Field(ge=1)
    title: str
    unit: str


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


def _normalize_base_url(value: str | None) -> str:
    raw = (value or "https://api.k2think.ai/v1").strip().rstrip("/")
    if not raw:
        return "https://api.k2think.ai/v1"
    return raw


def _get_k2think_settings() -> tuple[str, str, str, float]:
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
    timeout_raw = os.environ.get("K2THINK_TIMEOUT_SECONDS", "120").strip()
    try:
        timeout_seconds = float(timeout_raw)
    except ValueError as exc:
        raise ScenarioEditConfigError(
            "K2THINK_TIMEOUT_SECONDS must be a number."
        ) from exc
    if timeout_seconds <= 0:
        raise ScenarioEditConfigError(
            "K2THINK_TIMEOUT_SECONDS must be greater than 0."
        )
    return api_key, model, base_url, timeout_seconds


def _format_updated_at() -> str:
    return f"Edited {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())}"


def _product_subtitle(quantity: int, unit: str) -> str:
    return f"{quantity:,} {unit}"


def _non_empty(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ScenarioEditValidationError(f"{field_name} cannot be empty.")
    return normalized


def _normalize_location(
    location: SupplyScenarioLocationPayload, *, field_prefix: str
) -> SupplyScenarioLocationPayload:
    return location.model_copy(
        update={
            "city": _non_empty(location.city, f"{field_prefix} city"),
            "country": _non_empty(location.country, f"{field_prefix} country"),
            "countryCode": _non_empty(
                location.countryCode, f"{field_prefix} country code"
            ).upper(),
        }
    )


def _rebuild_graph(
    product: SupplyScenarioProductNodePayload,
    components: list[SupplyScenarioComponentNodePayload],
    manufacturers: list[SupplyScenarioManufacturerNodePayload],
) -> SupplyScenarioGraphPayload:
    graph_nodes = [
        SupplyScenarioGraphNodePayload(
            data=_build_graph_node_data(product),
            id=product.id,
            position=product.graphPosition,
        ),
        *[
            SupplyScenarioGraphNodePayload(
                data=_build_graph_node_data(component),
                id=component.id,
                position=component.graphPosition,
            )
            for component in components
        ],
        *[
            SupplyScenarioGraphNodePayload(
                data=_build_graph_node_data(manufacturer),
                id=manufacturer.id,
                position=manufacturer.graphPosition,
            )
            for manufacturer in manufacturers
        ],
    ]

    graph_edges = [
        *[
            SupplyScenarioGraphEdgePayload(
                id=f"edge_{product.id}_{component.id}",
                sourceId=product.id,
                targetId=component.id,
            )
            for component in components
        ],
        *[
            SupplyScenarioGraphEdgePayload(
                id=f"edge_{manufacturer.componentId}_{manufacturer.id}",
                sourceId=manufacturer.componentId,
                targetId=manufacturer.id,
            )
            for manufacturer in manufacturers
        ],
    ]

    return SupplyScenarioGraphPayload(edges=graph_edges, nodes=graph_nodes)


def _rebuild_routes(
    destination: SupplyScenarioDestinationPayload,
    manufacturers: list[SupplyScenarioManufacturerNodePayload],
) -> list[SupplyScenarioRoutePayload]:
    return [
        SupplyScenarioRoutePayload(
            componentId=manufacturer.componentId,
            destinationId=destination.id,
            id=f"route_{manufacturer.id}",
            isCurrent=manufacturer.isCurrent,
            manufacturerId=manufacturer.id,
        )
        for manufacturer in manufacturers
    ]


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


def _to_editable_scenario(scenario: SupplyScenarioPayload) -> EditableScenarioPayload:
    return EditableScenarioPayload(
        components=scenario.components,
        destination=scenario.destination,
        id=scenario.id,
        manufacturers=scenario.manufacturers,
        product=scenario.product,
        quantity=scenario.quantity,
        title=scenario.title,
        unit=scenario.unit,
    )


def normalize_edited_scenario(
    original: SupplyScenarioPayload, candidate: EditableScenarioPayload
) -> SupplyScenarioPayload:
    title = _non_empty(candidate.title, "Scenario title")
    unit = _non_empty(candidate.unit, "Scenario unit")
    quantity = candidate.quantity

    components = [
        component.model_copy(update={"label": _non_empty(component.label, "Component label")})
        for component in candidate.components
    ]
    component_ids = [component.id for component in components]
    if not component_ids:
        raise ScenarioEditValidationError("Scenario must contain at least one component.")
    if len(component_ids) != len(set(component_ids)):
        raise ScenarioEditValidationError("Component IDs must be unique.")

    component_by_id = {component.id: component for component in components}

    if len(candidate.product.childIds) != len(set(candidate.product.childIds)):
        raise ScenarioEditValidationError("Product childIds must be unique.")
    if candidate.product.childIds != component_ids:
        raise ScenarioEditValidationError(
            "Product childIds must match the component IDs in order."
        )

    product = candidate.product.model_copy(
        update={
            "label": _non_empty(candidate.product.label, "Product label"),
            "subtitle": _product_subtitle(quantity, unit),
        }
    )

    manufacturers: list[SupplyScenarioManufacturerNodePayload] = []
    manufacturer_ids: list[str] = []
    current_count_by_component: dict[str, int] = {
        component.id: 0 for component in components
    }

    for manufacturer in candidate.manufacturers:
        if manufacturer.componentId not in component_by_id:
            raise ScenarioEditValidationError(
                f"Manufacturer {manufacturer.id} references unknown component {manufacturer.componentId}."
            )

        component_label = component_by_id[manufacturer.componentId].label
        normalized_manufacturer = manufacturer.model_copy(
            update={
                "name": _non_empty(manufacturer.name, "Manufacturer name"),
                "componentLabel": component_label,
                "location": _normalize_location(
                    manufacturer.location, field_prefix="Manufacturer"
                ),
            }
        )
        manufacturers.append(normalized_manufacturer)
        manufacturer_ids.append(normalized_manufacturer.id)
        if normalized_manufacturer.isCurrent:
            current_count_by_component[normalized_manufacturer.componentId] += 1

    if not manufacturer_ids:
        raise ScenarioEditValidationError("Scenario must contain at least one manufacturer.")
    if len(manufacturer_ids) != len(set(manufacturer_ids)):
        raise ScenarioEditValidationError("Manufacturer IDs must be unique.")

    for component in components:
        if len(component.manufacturerIds) != len(set(component.manufacturerIds)):
            raise ScenarioEditValidationError(
                f"Component {component.id} has duplicate manufacturerIds."
            )

        if not component.manufacturerIds:
            raise ScenarioEditValidationError(
                f"Component {component.id} must reference at least one manufacturer."
            )

        expected_ids = [
            manufacturer.id
            for manufacturer in manufacturers
            if manufacturer.componentId == component.id
        ]
        if component.manufacturerIds != expected_ids:
            raise ScenarioEditValidationError(
                f"Component {component.id} manufacturerIds must match its manufacturers in order."
            )

        if current_count_by_component.get(component.id, 0) != 1:
            raise ScenarioEditValidationError(
                f"Component {component.id} must have exactly one current manufacturer."
            )

    destination = candidate.destination.model_copy(
        update={
            "label": _non_empty(candidate.destination.label, "Destination label"),
            "location": _normalize_location(
                candidate.destination.location, field_prefix="Destination"
            ),
        }
    )

    routes = _rebuild_routes(destination, manufacturers)
    graph = _rebuild_graph(product, components, manufacturers)
    stats = SupplyScenarioStatsPayload(
        componentCount=len(components),
        currentRouteCount=sum(route.isCurrent for route in routes),
        graphEdgeCount=len(graph.edges),
        graphNodeCount=len(graph.nodes),
        routeCount=len(routes),
        siteCount=len(manufacturers) + 1,
    )

    return SupplyScenarioPayload(
        components=components,
        destination=destination,
        graph=graph,
        id=original.id,
        manufacturers=manufacturers,
        product=product,
        quantity=quantity,
        routes=routes,
        stats=stats,
        title=title,
        unit=unit,
        updatedAt=_format_updated_at(),
    )


def _build_edit_messages(prompt: str, scenario: SupplyScenarioPayload) -> list[dict[str, str]]:
    scenario_json = json.dumps(
        _to_editable_scenario(scenario).model_dump(mode="json"),
        separators=(",", ":"),
    )
    return [
        {
            "role": "system",
            "content": (
                "You edit a supply-chain scenario JSON document. "
                "You may filter, remove, reorder, or relabel components and manufacturers "
                "when needed to satisfy the user's request. "
                "Preserve the top-level object shape and keep the scenario internally consistent. "
                "Required consistency rules: product.childIds must exactly match the component IDs in order; "
                "each component.manufacturerIds must exactly match the IDs of manufacturers belonging to that component in order; "
                "every manufacturer.componentId must reference an existing component; "
                "each component must end with exactly one current manufacturer; "
                "destination/product/component/manufacturer labels and locations must be non-empty. "
                "Return only the editable scenario fields: "
                "id, title, quantity, unit, product, destination, components, manufacturers. "
                "Do not include graph, routes, stats, or updatedAt; those are rebuilt server-side. "
                "If the user's request cannot be represented as scenario JSON, respond with status='rejected' "
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
    api_key, model, base_url, timeout_seconds = _get_k2think_settings()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "accept": "application/json",
        "Content-Type": "application/json",
    }

    messages = _build_edit_messages(prompt, scenario)

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        parse_error: str | None = None

        for attempt in range(1, 4):
            request_body = {
                "model": model,
                "messages": messages,
                "stream": False,
                "temperature": 0.1,
            }

            try:
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
                model_output = ScenarioEditModelOutputPayload.model_validate(decoded)
                if model_output.status == "rejected":
                    return ScenarioEditResponsePayload(
                        message=model_output.message,
                        status="rejected",
                    )

                if not model_output.scenario_json:
                    raise ValueError(
                        "K2 Think returned an applied response without scenario_json."
                    )

                scenario_payload = json.loads(model_output.scenario_json)
                try:
                    editable_scenario = EditableScenarioPayload.model_validate(
                        scenario_payload
                    )
                except Exception:
                    editable_scenario = _to_editable_scenario(
                        SupplyScenarioPayload.model_validate(scenario_payload)
                    )
            except (json.JSONDecodeError, ValueError) as exc:
                parse_error = str(exc)
            except Exception as exc:  # noqa: BLE001
                parse_error = (
                    "K2 Think returned a scenario payload that failed validation: "
                    f"{exc}"
                )
            else:
                return ScenarioEditResponsePayload(
                    message=model_output.message,
                    scenario=normalize_edited_scenario(scenario, editable_scenario),
                    status="applied",
                )

            if attempt < 3:
                messages = [
                    *messages,
                    {
                        "role": "assistant",
                        "content": content if isinstance(content, str) else json.dumps(content),
                    },
                    {
                        "role": "user",
                        "content": (
                            "Your previous response was invalid. "
                            f"Problem: {parse_error}. "
                            "Return only valid JSON matching the required response schema."
                        ),
                    },
                ]

    raise ScenarioEditProviderError(
        "K2 Think failed to return valid JSON for the scenario edit response after 3 attempts."
        + (f" Last error: {parse_error}" if parse_error else "")
    )
