export interface ManufacturerCsvRow {
  product: string
  destination: string
  quantity: number
  currentManufacturer: string
  currentCountry: string
}

const REQUIRED_COLUMNS = [
  "product",
  "destination",
  "quantity",
  "current_manufacturer",
  "current_country",
] as const

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number]

export type ParseResult =
  | { ok: true; row: ManufacturerCsvRow }
  | { ok: false; error: string }

function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ",") {
      fields.push(current)
      current = ""
      continue
    }

    current += char
  }

  fields.push(current)
  return fields.map((field) => field.trim())
}

export function parseManufacturersCsv(text: string): ParseResult {
  const normalized = text.replace(/\r\n?/g, "\n").trim()

  if (!normalized) {
    return { ok: false, error: "CSV is empty." }
  }

  const lines = normalized.split("\n").filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    return { ok: false, error: "CSV must have a header row and one data row." }
  }

  if (lines.length > 2) {
    return {
      ok: false,
      error: `Only single-row CSVs are supported (found ${lines.length - 1} data rows).`,
    }
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase())
  const values = splitCsvLine(lines[1])

  for (const column of REQUIRED_COLUMNS) {
    if (!headers.includes(column)) {
      return { ok: false, error: `Missing required column: ${column}.` }
    }
  }

  function read(column: RequiredColumn): string {
    const index = headers.indexOf(column)
    return values[index]?.trim() ?? ""
  }

  const product = read("product")
  const destination = read("destination")
  const quantityRaw = read("quantity")
  const currentManufacturer = read("current_manufacturer")
  const currentCountry = read("current_country")

  if (!product) return { ok: false, error: "product is required." }
  if (!destination) return { ok: false, error: "destination is required." }
  if (!quantityRaw) return { ok: false, error: "quantity is required." }
  if (!currentManufacturer) return { ok: false, error: "current_manufacturer is required." }
  if (!currentCountry) return { ok: false, error: "current_country is required." }

  const quantity = Number(quantityRaw)
  if (!Number.isFinite(quantity) || quantity < 1) {
    return { ok: false, error: `quantity must be a positive number (got "${quantityRaw}").` }
  }

  const destinationIso = destination.toUpperCase()
  if (destinationIso.length !== 2) {
    return {
      ok: false,
      error: `destination must be an ISO-2 country code (got "${destination}").`,
    }
  }

  const currentCountryIso = currentCountry.toUpperCase()
  if (currentCountryIso.length !== 2) {
    return {
      ok: false,
      error: `current_country must be an ISO-2 country code (got "${currentCountry}").`,
    }
  }

  return {
    ok: true,
    row: {
      product,
      destination: destinationIso,
      quantity: Math.floor(quantity),
      currentManufacturer,
      currentCountry: currentCountryIso,
    },
  }
}
