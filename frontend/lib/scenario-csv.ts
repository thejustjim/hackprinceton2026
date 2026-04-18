export const SCHEMA_VERSION = "scenario_csv_v1"
export const VALID_TRANSPORT_MODES = ["sea", "air", "rail", "road"] as const
export const REQUIRED_SCENARIO_CSV_HEADERS = [
  "product",
  "quantity",
  "destination",
  "countries",
  "transport_mode",
] as const
export const OPTIONAL_SCENARIO_CSV_HEADERS = [
  "require_certifications",
  "target_count",
] as const

const HEADER_ALIASES = new Map(
  [...REQUIRED_SCENARIO_CSV_HEADERS, ...OPTIONAL_SCENARIO_CSV_HEADERS].map(
    (header) => [header.toLowerCase(), header]
  )
)

export type ScenarioCsvPreview = {
  filename: string
  headers: string[]
  normalized: {
    countries: string[]
    destination: string
    product: string
    quantity: number
    requireCertifications: string[]
    targetCount: number | null
    transportMode: (typeof VALID_TRANSPORT_MODES)[number]
  }
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase()
}

function splitPipeList(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let currentCell = ""
  let currentRow: string[] = []
  let index = 0
  let inQuotes = false
  const source = text.replace(/^\uFEFF/, "")

  while (index < source.length) {
    const character = source[index]

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          currentCell += '"'
          index += 2
          continue
        }

        inQuotes = false
        index += 1
        continue
      }

      currentCell += character
      index += 1
      continue
    }

    if (character === '"') {
      inQuotes = true
      index += 1
      continue
    }

    if (character === ",") {
      currentRow.push(currentCell)
      currentCell = ""
      index += 1
      continue
    }

    if (character === "\r" || character === "\n") {
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentCell = ""
      currentRow = []

      if (character === "\r" && source[index + 1] === "\n") {
        index += 2
      } else {
        index += 1
      }

      continue
    }

    currentCell += character
    index += 1
  }

  currentRow.push(currentCell)
  rows.push(currentRow)

  return rows
}

function buildRowMap(headers: string[], row: string[]) {
  if (row.length > headers.length) {
    throw new Error("Row has more columns than the header.")
  }

  const paddedRow = row.concat(
    Array.from({ length: headers.length - row.length }, () => "")
  )

  return Object.fromEntries(
    headers.map((header, headerIndex) => [
      header,
      paddedRow[headerIndex]?.trim() ?? "",
    ])
  )
}

export function validateScenarioCsvFile(
  file: File,
  text: string
): ScenarioCsvPreview {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Only .csv files are supported.")
  }

  const rows = parseCsv(text)
  if (!rows.length || !rows[0]?.some((cell) => cell.trim().length > 0)) {
    throw new Error("CSV must include a header row and one data row.")
  }

  const headers: string[] = []
  const seenHeaders = new Set<string>()

  for (const rawHeader of rows[0]) {
    const normalizedHeader = normalizeHeader(rawHeader)
    if (!normalizedHeader) {
      throw new Error("Header names cannot be empty.")
    }

    const canonicalHeader =
      HEADER_ALIASES.get(normalizedHeader) ?? normalizedHeader
    if (seenHeaders.has(canonicalHeader)) {
      throw new Error(`Duplicate header: ${canonicalHeader}`)
    }

    seenHeaders.add(canonicalHeader)
    headers.push(canonicalHeader)
  }

  const missingHeaders = REQUIRED_SCENARIO_CSV_HEADERS.filter(
    (header) => !seenHeaders.has(header)
  )
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required header(s): ${missingHeaders.join(", ")}`)
  }

  const dataRows = rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim().length > 0))

  if (dataRows.length === 0) {
    throw new Error("CSV must include one scenario row.")
  }
  if (dataRows.length > 1) {
    throw new Error("This version accepts one scenario per upload.")
  }

  const rowMap = buildRowMap(headers, dataRows[0])
  const product = rowMap.product?.trim() ?? ""
  if (!product) {
    throw new Error("Product is required.")
  }

  const quantity = Number(rowMap.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive number.")
  }

  const destination = rowMap.destination?.trim() ?? ""
  if (!destination) {
    throw new Error("Destination is required.")
  }

  const transportMode = rowMap.transport_mode?.trim().toLowerCase() ?? ""
  if (
    !VALID_TRANSPORT_MODES.includes(
      transportMode as (typeof VALID_TRANSPORT_MODES)[number]
    )
  ) {
    throw new Error(
      `transport_mode must be one of: ${VALID_TRANSPORT_MODES.join(", ")}.`
    )
  }

  let targetCount: number | null = null
  const targetCountText = rowMap.target_count?.trim() ?? ""
  if (targetCountText) {
    targetCount = Number(targetCountText)
    if (!Number.isInteger(targetCount) || targetCount <= 0) {
      throw new Error("target_count must be a positive whole number.")
    }
  }

  return {
    filename: file.name,
    headers,
    normalized: {
      countries: splitPipeList(rowMap.countries ?? ""),
      destination,
      product,
      quantity,
      requireCertifications: splitPipeList(rowMap.require_certifications ?? ""),
      targetCount,
      transportMode: transportMode as (typeof VALID_TRANSPORT_MODES)[number],
    },
  }
}
