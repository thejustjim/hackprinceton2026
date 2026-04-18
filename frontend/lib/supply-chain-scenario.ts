import rawData from "@/lib/sampledata.json"

interface RawScenario {
  scenario: {
    id: string
    productName: string
    quantity: number
    unit: string
    destination: RawLocation
  }
  nodes: RawNode[]
  edges: RawEdge[]
}

interface RawLocation {
  city: string
  country: string
  lat: number
  lng: number
}

interface RawProductNode {
  id: string
  nodeKind: "base"
  baseType: "product"
  label: string
  subtitle?: string
  children: string[]
}

interface RawComponentNode {
  id: string
  nodeKind: "base"
  baseType: "component"
  label: string
  children: string[]
}

interface RawManufacturerNode {
  id: string
  nodeKind: "manufacturer"
  name: string
  component: string
  isCurrent: boolean
  location: RawLocation
  ecoScore: number
  gridCarbonScore: number
  climateRiskScore: number
  transportEmissionsTco2e: number
  manufacturingEmissionsTco2e: {
    q10: number
    q50: number
    q90: number
  }
  certifications: string[]
}

type RawNode = RawComponentNode | RawManufacturerNode | RawProductNode

interface RawEdge {
  id: string
  source: string
  target: string
}

export interface SupplyScenarioLocation {
  city: string
  country: string
  countryCode: string
  lat: number
  lng: number
}

interface ScenarioNodeBase {
  graphPosition: {
    x: number
    y: number
  }
  id: string
}

export interface SupplyScenarioProductNode extends ScenarioNodeBase {
  childIds: string[]
  kind: "product"
  label: string
  subtitle?: string
}

export interface SupplyScenarioComponentNode extends ScenarioNodeBase {
  kind: "component"
  label: string
  manufacturerIds: string[]
}

export interface SupplyScenarioManufacturerNode extends ScenarioNodeBase {
  certifications: string[]
  climateRiskScore: number
  componentId: string
  componentLabel: string
  ecoScore: number
  gridCarbonScore: number
  isCurrent: boolean
  kind: "manufacturer"
  location: SupplyScenarioLocation
  manufacturingEmissionsTco2e: {
    q10: number
    q50: number
    q90: number
  }
  name: string
  transportEmissionsTco2e: number
}

export type SupplyScenarioNode =
  | SupplyScenarioComponentNode
  | SupplyScenarioManufacturerNode
  | SupplyScenarioProductNode

export interface SupplyScenarioGraphNode {
  data: SupplyScenarioNode
  id: string
  position: {
    x: number
    y: number
  }
}

export interface SupplyScenarioGraphEdge {
  id: string
  sourceId: string
  targetId: string
}

export interface SupplyScenarioDestination {
  id: string
  label: string
  location: SupplyScenarioLocation
}

export interface SupplyScenarioRoute {
  componentId: string
  destinationId: string
  id: string
  isCurrent: boolean
  manufacturerId: string
}

export interface SupplyScenario {
  components: SupplyScenarioComponentNode[]
  destination: SupplyScenarioDestination
  graph: {
    edges: SupplyScenarioGraphEdge[]
    nodes: SupplyScenarioGraphNode[]
  }
  id: string
  manufacturers: SupplyScenarioManufacturerNode[]
  product: SupplyScenarioProductNode
  quantity: number
  routes: SupplyScenarioRoute[]
  stats: {
    componentCount: number
    currentRouteCount: number
    graphEdgeCount: number
    graphNodeCount: number
    routeCount: number
    siteCount: number
  }
  title: string
  unit: string
  updatedAt: string
}

export type SupplyScenarioSelectableNodeId = SupplyScenarioNode["id"]

const COUNTRY_NAMES: Record<string, string> = {
  CA: "Canada",
  CN: "China",
  DE: "Germany",
  MX: "Mexico",
  US: "United States",
}

const DEFAULT_GRAPH_NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  product_lint_roller: { x: -55, y: -55 },
  component_adhesive: { x: 260, y: -40 },
  mfr_adh_current: { x: 560, y: -360 },
  mfr_adh_delo: { x: 700, y: -20 },
  mfr_adh_nanpao: { x: 560, y: 320 },
}

function normalizeLocation(location: RawLocation): SupplyScenarioLocation {
  return {
    city: location.city,
    country: COUNTRY_NAMES[location.country] ?? location.country,
    countryCode: location.country,
    lat: location.lat,
    lng: location.lng,
  }
}

export function createSupplyScenario(
  rawScenario: RawScenario,
  graphPositions: Record<string, { x: number; y: number }>
): SupplyScenario {
  const rawProduct = rawScenario.nodes.find(
    (node): node is RawProductNode =>
      node.nodeKind === "base" && node.baseType === "product"
  )

  if (!rawProduct) {
    throw new Error("Scenario is missing a product node")
  }

  const rawComponents = rawScenario.nodes.filter(
    (node): node is RawComponentNode =>
      node.nodeKind === "base" && node.baseType === "component"
  )
  const componentIdByLabel = new Map(
    rawComponents.map((component) => [component.label, component.id])
  )
  const manufacturers = rawScenario.nodes
    .filter(
      (node): node is RawManufacturerNode => node.nodeKind === "manufacturer"
    )
    .map((manufacturer) => {
      const componentId = componentIdByLabel.get(manufacturer.component)

      if (!componentId) {
        throw new Error(
          `Manufacturer ${manufacturer.id} references unknown component ${manufacturer.component}`
        )
      }

      return {
        certifications: manufacturer.certifications,
        climateRiskScore: manufacturer.climateRiskScore,
        componentId,
        componentLabel: manufacturer.component,
        ecoScore: manufacturer.ecoScore,
        graphPosition: graphPositions[manufacturer.id] ?? { x: 0, y: 0 },
        gridCarbonScore: manufacturer.gridCarbonScore,
        id: manufacturer.id,
        isCurrent: manufacturer.isCurrent,
        kind: "manufacturer" as const,
        location: normalizeLocation(manufacturer.location),
        manufacturingEmissionsTco2e: manufacturer.manufacturingEmissionsTco2e,
        name: manufacturer.name,
        transportEmissionsTco2e: manufacturer.transportEmissionsTco2e,
      }
    })
  const manufacturerById = new Map(
    manufacturers.map((manufacturer) => [manufacturer.id, manufacturer])
  )
  const components = rawComponents.map((component) => ({
    graphPosition: graphPositions[component.id] ?? { x: 0, y: 0 },
    id: component.id,
    kind: "component" as const,
    label: component.label,
    manufacturerIds: component.children.filter((childId) =>
      manufacturerById.has(childId)
    ),
  }))
  const product: SupplyScenarioProductNode = {
    childIds: rawProduct.children,
    graphPosition: graphPositions[rawProduct.id] ?? { x: 0, y: 0 },
    id: rawProduct.id,
    kind: "product",
    label: rawProduct.label,
    subtitle: rawProduct.subtitle,
  }
  const destination: SupplyScenarioDestination = {
    id: "destination_main",
    label: rawScenario.scenario.destination.city,
    location: normalizeLocation(rawScenario.scenario.destination),
  }
  const graphNodes: SupplyScenarioGraphNode[] = [
    product,
    ...components,
    ...manufacturers,
  ].map((node) => ({
    data: node,
    id: node.id,
    position: node.graphPosition,
  }))
  const graphEdges = rawScenario.edges.map((edge) => ({
    id: edge.id,
    sourceId: edge.source,
    targetId: edge.target,
  }))
  const routes = manufacturers.map((manufacturer) => ({
    componentId: manufacturer.componentId,
    destinationId: destination.id,
    id: `route_${manufacturer.id}_${destination.id}`,
    isCurrent: manufacturer.isCurrent,
    manufacturerId: manufacturer.id,
  }))

  return {
    components,
    destination,
    graph: {
      edges: graphEdges,
      nodes: graphNodes,
    },
    id: rawScenario.scenario.id,
    manufacturers,
    product,
    quantity: rawScenario.scenario.quantity,
    routes,
    stats: {
      componentCount: components.length,
      currentRouteCount: routes.filter((route) => route.isCurrent).length,
      graphEdgeCount: graphEdges.length,
      graphNodeCount: graphNodes.length,
      routeCount: routes.length,
      siteCount: manufacturers.length + 1,
    },
    title: rawScenario.scenario.productName,
    unit: rawScenario.scenario.unit,
    updatedAt: "",
  }
}

export const sampleSupplyScenario = createSupplyScenario(
  rawData as RawScenario,
  DEFAULT_GRAPH_NODE_POSITIONS
)
