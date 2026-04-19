import type { SupplyScenario } from "@/lib/supply-chain-scenario"

export type TransportMode = "sea" | "air" | "rail" | "road"
export type EnvRating = "green" | "amber" | "red"
export type DisclosureStatus = "verified" | "partial" | "none"

export interface SearchWeights {
  manufacturing: number
  transport: number
  grid_carbon: number
  certifications: number
  climate_risk: number
}

export interface ScenarioComponentSearchRequest {
  component: string
  current_certifications?: string[]
  current_city?: string | null
  current_country: string
  current_disclosure_status?: "verified" | "partial" | "none"
  current_manufacturer: string
  current_renewable_pct?: number | null
  current_revenue_usd_m?: number | null
  current_website?: string | null
}

export interface SearchRequest {
  components?: ScenarioComponentSearchRequest[]
  product: string
  quantity: number
  destination: string
  countries: string[]
  transport_mode?: TransportMode
  require_certifications?: string[]
  target_count?: number
  weights?: SearchWeights
}

export interface ManufacturerResult {
  component?: string
  rank: number
  name: string
  country: string
  city: string | null
  sustainability_url: string | null
  certifications: string[]
  composite_score: number
  env_rating: EnvRating
  disclosure_status: DisclosureStatus
  is_current?: boolean
  transport_mode: string
  scores: {
    manufacturing_tco2e: number
    transport_tco2e: number
    grid_carbon_gco2_kwh: number
    cert_score: number
    climate_risk_score?: number
    total_tco2e: number
  }
  rank_scores: {
    manufacturing_norm: number
    transport_norm: number
    grid_norm: number
    cert_norm: number
    risk_norm?: number
  }
  emission_factor: {
    q10_tco2e: number
    q50_tco2e: number
    q90_tco2e: number
    intensity_tco2e_per_usdm?: number
    grid_gco2_kwh?: number
    [key: string]: number | undefined
  }
  transport: {
    transport_tco2e: number
    distance_km: number
    mode: string
    glec_factor?: number
    weight_kg?: number
    origin_port?: string | null
    dest_port?: string | null
    [key: string]: unknown
  }
  cert_score: {
    multiplier: number
    cert_score: number
    matched_certs: string[]
    disclosure_penalty: boolean
  }
}

export interface SearchResponse {
  product: string
  destination: string
  transport_mode: string
  countries: string[]
  duration_seconds: number
  count: number
  results: ManufacturerResult[]
}

export interface ScenarioEditRequest {
  prompt: string
  scenario: SupplyScenario
}

export interface ScenarioEditResponse {
  message: string
  scenario: SupplyScenario | null
  status: "applied" | "rejected"
}

export interface ScenarioReportRequest {
  scenario: SupplyScenario
  selectedManufacturerByComponent?: Record<string, string>
}

export interface ScenarioReportResponse {
  contentBase64: string
  fileName: string
  format: "pdf" | "tex"
  generatedAt: string
  mimeType: string
  model: string
}

export const API_BASE_URL = "/api"

async function readErrorDetail(response: Response) {
  const text = await response.text().catch(() => response.statusText)
  let detail = text || response.statusText
  try {
    const parsed = JSON.parse(text) as { detail?: string | { msg: string }[] }
    if (typeof parsed.detail === "string") {
      detail = parsed.detail
    }
  } catch {
    /* keep raw body */
  }
  return detail
}

export async function getHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/health`)
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`)
  }
  return response.json()
}

export async function search(request: SearchRequest): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    throw new Error(`Search failed (${response.status}): ${detail}`)
  }

  return response.json()
}

export async function editScenario(
  request: ScenarioEditRequest
): Promise<ScenarioEditResponse> {
  const response = await fetch(`${API_BASE_URL}/scenario/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    throw new Error(`Scenario edit failed (${response.status}): ${detail}`)
  }

  return response.json()
}

export async function generateScenarioReport(
  request: ScenarioReportRequest
): Promise<ScenarioReportResponse> {
  const response = await fetch(`${API_BASE_URL}/scenario/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    throw new Error(`Scenario report failed (${response.status}): ${detail}`)
  }

  return response.json()
}
