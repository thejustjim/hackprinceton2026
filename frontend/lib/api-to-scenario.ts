import type { ManufacturerResult, SearchResponse } from "@/lib/api"
import { getCountryCentroid } from "@/lib/country-coords"
import type {
  ScenarioSearchCsv,
  ScenarioSearchCsvComponentRow,
} from "@/lib/csv-to-search"
import {
  type SupplyScenario,
  type SupplyScenarioComponentNode,
  type SupplyScenarioDestination,
  type SupplyScenarioGraphEdge,
  type SupplyScenarioGraphNode,
  type SupplyScenarioLocation,
  type SupplyScenarioManufacturerNode,
  type SupplyScenarioProductNode,
} from "@/lib/supply-chain-scenario"

const COUNTRY_NAMES: Record<string, string> = {
  AR: "Argentina",
  AT: "Austria",
  AU: "Australia",
  BD: "Bangladesh",
  BE: "Belgium",
  BR: "Brazil",
  CA: "Canada",
  CH: "Switzerland",
  CL: "Chile",
  CN: "China",
  CZ: "Czechia",
  DE: "Germany",
  DK: "Denmark",
  EG: "Egypt",
  ES: "Spain",
  ET: "Ethiopia",
  FI: "Finland",
  FR: "France",
  GB: "United Kingdom",
  GR: "Greece",
  HU: "Hungary",
  ID: "Indonesia",
  IE: "Ireland",
  IL: "Israel",
  IN: "India",
  IT: "Italy",
  JP: "Japan",
  KE: "Kenya",
  KR: "South Korea",
  MA: "Morocco",
  MX: "Mexico",
  MY: "Malaysia",
  NG: "Nigeria",
  NL: "Netherlands",
  NO: "Norway",
  NZ: "New Zealand",
  PE: "Peru",
  PH: "Philippines",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  RU: "Russia",
  SE: "Sweden",
  TH: "Thailand",
  TR: "Türkiye",
  TW: "Taiwan",
  UA: "Ukraine",
  US: "United States",
  VN: "Vietnam",
  ZA: "South Africa",
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function buildLocation(
  countryCode: string,
  city: string | null
): SupplyScenarioLocation {
  const iso = countryCode.trim().toUpperCase()
  const centroid = getCountryCentroid(iso)
  return {
    city: city?.trim() || COUNTRY_NAMES[iso] || iso,
    country: COUNTRY_NAMES[iso] || iso,
    countryCode: iso,
    lat: centroid.lat,
    lng: centroid.lng,
  }
}

function climateRiskFromRating(rating: ManufacturerResult["env_rating"]): number {
  if (rating === "green") return 20
  if (rating === "amber") return 50
  return 80
}

function gridScoreFromNorm(gridNorm: number): number {
  return clamp(Math.round(100 - gridNorm), 0, 100)
}

function ecoScoreFromComposite(composite: number): number {
  return clamp(Math.round(composite), 0, 100)
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "node"
  )
}

function normalizeComponentKey(value: string): string {
  return value.trim().toLowerCase()
}

function radialPosition(index: number, total: number, radius: number) {
  if (total <= 0) return { x: 0, y: 0 }
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  }
}

function offsetPosition(
  base: { x: number; y: number },
  offset: { x: number; y: number }
) {
  return {
    x: base.x + offset.x,
    y: base.y + offset.y,
  }
}

function buildManufacturerNode(
  result: ManufacturerResult,
  componentId: string,
  componentLabel: string,
  index: number
): SupplyScenarioManufacturerNode {
  return {
    certifications: result.certifications,
    climateRiskScore: climateRiskFromRating(result.env_rating),
    componentId,
    componentLabel,
    ecoScore: ecoScoreFromComposite(result.composite_score),
    graphPosition: { x: 0, y: 0 },
    gridCarbonScore: gridScoreFromNorm(result.rank_scores.grid_norm),
    id: `mfr_${result.is_current ? "current" : "alt"}_${slugify(componentLabel)}_${result.rank}_${slugify(result.name)}_${index}`,
    isCurrent: Boolean(result.is_current),
    kind: "manufacturer",
    location: buildLocation(result.country, result.city),
    manufacturingEmissionsTco2e: {
      q10: result.emission_factor.q10_tco2e,
      q50: result.emission_factor.q50_tco2e,
      q90: result.emission_factor.q90_tco2e,
    },
    name: result.name,
    transportEmissionsTco2e: result.scores.transport_tco2e,
  }
}

function createFallbackCurrentResult(
  component: ScenarioSearchCsvComponentRow,
  transportMode: string
): ManufacturerResult {
  return {
    cert_score: {
      cert_score: 0,
      disclosure_penalty: component.currentCertifications.length === 0,
      matched_certs: component.currentCertifications,
      multiplier: 1,
    },
    certifications: component.currentCertifications,
    city: component.currentCity,
    component: component.component,
    composite_score: 50,
    country: component.currentCountry,
    disclosure_status: component.currentDisclosureStatus,
    emission_factor: {
      q10_tco2e: 0,
      q50_tco2e: 0,
      q90_tco2e: 0,
    },
    env_rating: "amber",
    is_current: true,
    name: component.currentManufacturer,
    rank: 1,
    rank_scores: {
      cert_norm: 50,
      grid_norm: 50,
      manufacturing_norm: 50,
      risk_norm: 50,
      transport_norm: 50,
    },
    scores: {
      cert_score: 0,
      climate_risk_score: 50,
      grid_carbon_gco2_kwh: 0,
      manufacturing_tco2e: 0,
      total_tco2e: 0,
      transport_tco2e: 0,
    },
    sustainability_url: component.currentWebsite,
    transport: {
      distance_km: 0,
      mode: "sea",
      transport_tco2e: 0,
      weight_kg: 0,
    },
    transport_mode: transportMode,
  }
}

export function apiResultToScenario(
  response: SearchResponse,
  csv: ScenarioSearchCsv
): SupplyScenario {
  const productLabel = csv.product
  const productSlug = slugify(productLabel)
  const productId = `product_${productSlug}`
  const resultGroups = new Map<string, ManufacturerResult[]>()

  response.results.forEach((result) => {
    const componentName = result.component?.trim()
    if (!componentName) {
      return
    }

    const normalizedComponent = normalizeComponentKey(componentName)
    const nextGroup = resultGroups.get(normalizedComponent) ?? []
    nextGroup.push(result)
    resultGroups.set(normalizedComponent, nextGroup)
  })

  const components: SupplyScenarioComponentNode[] = []
  const manufacturers: SupplyScenarioManufacturerNode[] = []

  csv.components.forEach((componentRow) => {
    const componentLabel = componentRow.component
    const componentId = `component_${productSlug}_${slugify(componentLabel)}`
    const scoredResults =
      resultGroups.get(normalizeComponentKey(componentLabel)) ?? []

    const currentResult =
      scoredResults.find((result) => result.is_current) ??
      createFallbackCurrentResult(componentRow, csv.transportMode)
    const alternateResults = scoredResults.filter((result) => !result.is_current)
    const manufacturerNodes = [currentResult, ...alternateResults].map(
      (result, index) =>
        buildManufacturerNode(result, componentId, componentLabel, index)
    )

    const componentPosition = radialPosition(
      components.length,
      Math.max(csv.components.length, 1),
      Math.max(260, 140 + csv.components.length * 70)
    )
    const ringRadius = Math.max(320, 120 + manufacturerNodes.length * 52)
    manufacturerNodes.forEach((manufacturer, index) => {
      manufacturer.graphPosition = offsetPosition(
        componentPosition,
        radialPosition(index, manufacturerNodes.length, ringRadius)
      )
    })

    manufacturers.push(...manufacturerNodes)
    components.push({
      graphPosition: componentPosition,
      id: componentId,
      kind: "component",
      label: componentLabel,
      manufacturerIds: manufacturerNodes.map((manufacturer) => manufacturer.id),
    })
  })

  const product: SupplyScenarioProductNode = {
    childIds: components.map((component) => component.id),
    graphPosition: { x: -180, y: -180 },
    id: productId,
    kind: "product",
    label: productLabel,
    subtitle: `${csv.quantity.toLocaleString()} ${csv.unit}`,
  }

  const destination: SupplyScenarioDestination = {
    id: "destination_main",
    label: COUNTRY_NAMES[csv.destination] || csv.destination,
    location: buildLocation(csv.destination, null),
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

  const graphEdges: SupplyScenarioGraphEdge[] = [
    ...components.map((component) => ({
      id: `edge_${productId}_${component.id}`,
      sourceId: productId,
      targetId: component.id,
    })),
    ...manufacturers.map((manufacturer) => ({
      id: `edge_${manufacturer.componentId}_${manufacturer.id}`,
      sourceId: manufacturer.componentId,
      targetId: manufacturer.id,
    })),
  ]

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
    id: `scenario_${productSlug}_${Date.now()}`,
    manufacturers,
    product,
    quantity: csv.quantity,
    routes,
    stats: {
      componentCount: components.length,
      currentRouteCount: routes.filter((route) => route.isCurrent).length,
      graphEdgeCount: graphEdges.length,
      graphNodeCount: graphNodes.length,
      routeCount: routes.length,
      siteCount: manufacturers.length + 1,
    },
    title: productLabel,
    unit: csv.unit,
    updatedAt: `Live search · ${components.length} components · ${response.duration_seconds.toFixed(1)}s`,
  }
}
