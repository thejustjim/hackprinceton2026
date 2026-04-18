export type TransportMode = "sea" | "air" | "rail" | "road";

export interface SearchRequest {
  product: string;
  quantity: number;
  destinationCountry: string;
  countries: string[];
  transportMode: TransportMode;
  certifications: string[];
}

export interface ScoreBreakdown {
  manufacturing: number;
  transport: number;
  grid: number;
  certifications: number;
  climateRisk: number;
  total: number;
}

export interface ManufacturerResult {
  id: string;
  manufacturerName: string;
  country: string;
  location: string;
  sustainabilityUrl: string | null;
  certifications: string[];
  score: ScoreBreakdown;
}

export interface SearchResult {
  id: string;
  summary: string;
  results: ManufacturerResult[];
}

export interface StartSearchResponse {
  searchId: string;
}

export interface MemoResponse {
  title: string;
  body: string;
}

