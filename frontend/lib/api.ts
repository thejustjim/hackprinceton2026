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

export interface SearchRequest {
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
  rank: number
  name: string
  country: string
  city: string | null
  sustainability_url: string | null
  certifications: string[]
  composite_score: number
  env_rating: EnvRating
  disclosure_status: DisclosureStatus
  transport_mode: string
  scores: {
    manufacturing_tco2e: number
    transport_tco2e: number
    grid_carbon_gco2_kwh: number
    cert_score: number
    total_tco2e: number
  }
  rank_scores: {
    manufacturing_norm: number
    transport_norm: number
    grid_norm: number
    cert_norm: number
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
    disclosure_penalty: number
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

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"

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
    const detail = await response.text().catch(() => response.statusText)
    throw new Error(
      `Search failed (${response.status}): ${detail || response.statusText}`
    )
  }

  return response.json()
}
