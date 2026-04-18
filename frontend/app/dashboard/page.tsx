"use client"

import { useCallback, useState } from "react"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import type { UploadPanelStatus } from "@/components/dashboard/upload-panel"
import { search } from "@/lib/api"
import { apiResultToScenario } from "@/lib/api-to-scenario"
import { parseManufacturersCsv } from "@/lib/csv-to-search"
import {
  sampleSupplyScenario,
  type SupplyScenario,
} from "@/lib/supply-chain-scenario"

export default function Page() {
  const [scenario, setScenario] = useState<SupplyScenario | null>(null)
  const [status, setStatus] = useState<UploadPanelStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  const handleUseDemo = useCallback(() => {
    setStatus("idle")
    setError(null)
    setScenario(sampleSupplyScenario)
  }, [])

  const handleReset = useCallback(() => {
    setStatus("idle")
    setError(null)
  }, [])

  const handleFile = useCallback(async (file: File) => {
    setStatus("loading")
    setError(null)

    let text: string
    try {
      text = await file.text()
    } catch {
      setStatus("error")
      setError("Could not read the file.")
      return
    }

    const parsed = parseManufacturersCsv(text)
    if (!parsed.ok) {
      setStatus("error")
      setError(parsed.error)
      return
    }

    const row = parsed.row
    try {
      const response = await search({
        product: row.product,
        quantity: row.quantity,
        destination: row.destination,
        countries: [],
        transport_mode: "sea",
      })
      setScenario(apiResultToScenario(response, row))
      setStatus("idle")
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unknown error during search."
      setStatus("error")
      setError(message)
    }
  }, [])

  return (
    <DashboardShell
      error={error}
      onFile={handleFile}
      onReset={handleReset}
      onUseDemo={handleUseDemo}
      scenario={scenario}
      status={status}
    />
  )
}
