import type { ManufacturerResult, SearchResponse } from "@/lib/api"
import { getCountryCentroid } from "@/lib/country-coords"
import type { ManufacturerCsvRow } from "@/lib/csv-to-search"
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

function climateRiskFromRating(
  rating: ManufacturerResult["env_rating"]
): number {
  if (rating === "green") return 20
  if (rating === "amber") return 50
  return 80
}

function gridScoreFromNorm(gridNorm: number): number {
  return clamp(Math.round(100 - gridNorm), 0, 100)
}

function ecoScoreFromComposite(composite: number): number {
  return clamp(Math.round(100 - composite), 0, 100)
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "node"
}

function radialPosition(index: number, total: number, radius: number) {
  if (total <= 0) return { x: 0, y: 0 }
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  }
}

export function apiResultToScenario(
  response: SearchResponse,
  csv: ManufacturerCsvRow
): SupplyScenario {
  const productLabel = csv.product
  const productSlug = slugify(productLabel)
  const productId = `product_${productSlug}`
  const componentId = `component_${productSlug}`

  const currentManufacturer: SupplyScenarioManufacturerNode = {
    certifications: [],
    climateRiskScore: 50,
    componentId,
    componentLabel: productLabel,
    ecoScore: 50,
    graphPosition: { x: 0, y: 0 },
    gridCarbonScore: 50,
    id: `mfr_current_${slugify(csv.currentManufacturer)}`,
    isCurrent: true,
    kind: "manufacturer",
    location: buildLocation(csv.currentCountry, null),
    manufacturingEmissionsTco2e: { q10: 0, q50: 0, q90: 0 },
    name: csv.currentManufacturer,
    transportEmissionsTco2e: 0,
  }

  const alternateManufacturers: SupplyScenarioManufacturerNode[] =
    response.results.map((result, index) => ({
      certifications: result.certifications,
      climateRiskScore: climateRiskFromRating(result.env_rating),
      componentId,
      componentLabel: productLabel,
      ecoScore: ecoScoreFromComposite(result.composite_score),
      graphPosition: { x: 0, y: 0 },
      gridCarbonScore: gridScoreFromNorm(result.rank_scores.grid_norm),
      id: `mfr_alt_${result.rank}_${slugify(result.name)}_${index}`,
      isCurrent: false,
      kind: "manufacturer",
      location: buildLocation(result.country, result.city),
      manufacturingEmissionsTco2e: {
        q10: result.emission_factor.q10_tco2e,
        q50: result.emission_factor.q50_tco2e,
        q90: result.emission_factor.q90_tco2e,
      },
      name: result.name,
      transportEmissionsTco2e: result.scores.transport_tco2e,
    }))

  const manufacturers = [currentManufacturer, ...alternateManufacturers]
  const totalManufacturers = manufacturers.length
  const ringRadius = Math.max(360, 120 + totalManufacturers * 40)
  manufacturers.forEach((manufacturer, index) => {
    manufacturer.graphPosition = radialPosition(
      index,
      totalManufacturers,
      ringRadius
    )
  })

  const component: SupplyScenarioComponentNode = {
    graphPosition: { x: 0, y: 0 },
    id: componentId,
    kind: "component",
    label: productLabel,
    manufacturerIds: manufacturers.map((manufacturer) => manufacturer.id),
  }

  const product: SupplyScenarioProductNode = {
    childIds: [componentId],
    graphPosition: { x: -180, y: -180 },
    id: productId,
    kind: "product",
    label: productLabel,
    subtitle: `${csv.quantity.toLocaleString()} units`,
  }

  const destination: SupplyScenarioDestination = {
    id: "destination_main",
    label: COUNTRY_NAMES[csv.destination] || csv.destination,
    location: buildLocation(csv.destination, null),
  }

  const graphNodes: SupplyScenarioGraphNode[] = [
    product,
    component,
    ...manufacturers,
  ].map((node) => ({
    data: node,
    id: node.id,
    position: node.graphPosition,
  }))

  const graphEdges: SupplyScenarioGraphEdge[] = [
    {
      id: `edge_${productId}_${componentId}`,
      sourceId: productId,
      targetId: componentId,
    },
    ...manufacturers.map((manufacturer) => ({
      id: `edge_${componentId}_${manufacturer.id}`,
      sourceId: componentId,
      targetId: manufacturer.id,
    })),
  ]

  const routes = manufacturers.map((manufacturer) => ({
    componentId,
    destinationId: destination.id,
    id: `route_${manufacturer.id}_${destination.id}`,
    isCurrent: manufacturer.isCurrent,
    manufacturerId: manufacturer.id,
  }))

  return {
    components: [component],
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
      componentCount: 1,
      currentRouteCount: routes.filter((route) => route.isCurrent).length,
      graphEdgeCount: graphEdges.length,
      graphNodeCount: graphNodes.length,
      routeCount: routes.length,
      siteCount: manufacturers.length + 1,
    },
    title: productLabel,
    unit: "units",
    updatedAt: `Live search · ${response.duration_seconds.toFixed(1)}s`,
  }
}
