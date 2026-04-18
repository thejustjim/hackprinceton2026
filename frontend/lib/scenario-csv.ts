import {
  parseScenarioSearchCsv,
  type ScenarioSearchCsv,
} from "@/lib/csv-to-search"

export const SCHEMA_VERSION = "scenario_csv_v2"
export const REQUIRED_SCENARIO_CSV_HEADERS = [
  "product",
  "quantity",
  "destination",
  "component",
  "current_manufacturer",
  "current_country",
] as const
export const OPTIONAL_SCENARIO_CSV_HEADERS = [
  "unit",
  "transport_mode",
  "target_count",
  "current_city",
  "current_website",
  "current_certifications",
  "current_disclosure_status",
  "current_revenue_usd_m",
  "current_renewable_pct",
] as const

export type ScenarioCsvPreview = {
  filename: string
  headers: string[]
  normalized: ScenarioSearchCsv & {
    componentCount: number
  }
}

function parseHeaders(text: string): string[] {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? ""
  if (!firstLine.trim()) {
    return []
  }

  const headers: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < firstLine.length; index += 1) {
    const character = firstLine[index]

    if (inQuotes) {
      if (character === '"') {
        if (firstLine[index + 1] === '"') {
          current += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        current += character
      }
      continue
    }

    if (character === '"') {
      inQuotes = true
      continue
    }

    if (character === ",") {
      headers.push(current.trim().toLowerCase())
      current = ""
      continue
    }

    current += character
  }

  headers.push(current.trim().toLowerCase())
  return headers.filter(Boolean)
}

export function validateScenarioCsvFile(
  file: File,
  text: string
): ScenarioCsvPreview {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Only .csv files are supported.")
  }

  const parsed = parseScenarioSearchCsv(text)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  return {
    filename: file.name,
    headers: parseHeaders(text),
    normalized: {
      ...parsed.scenario,
      componentCount: parsed.scenario.components.length,
    },
  }
}
