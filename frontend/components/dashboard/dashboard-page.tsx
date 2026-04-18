"use client"

import { useCallback, useEffect, useState } from "react"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import type { UploadPanelStatus } from "@/components/dashboard/upload-panel"
import { search } from "@/lib/api"
import { apiResultToScenario } from "@/lib/api-to-scenario"
import { parseManufacturersCsv } from "@/lib/csv-to-search"
import {
  clearDashboardEntry,
  persistDemoDashboardEntry,
} from "@/lib/dashboard-entry"
import {
  sampleSupplyScenario,
  type SupplyScenario,
} from "@/lib/supply-chain-scenario"

interface DashboardPageProps {
  startsInDemo: boolean
}

export function DashboardPage({ startsInDemo }: DashboardPageProps) {
  const [scenario, setScenario] = useState<SupplyScenario | null>(() =>
    startsInDemo ? sampleSupplyScenario : null
  )
  const [scenarioSource, setScenarioSource] = useState<"demo" | "search" | null>(
    () => (startsInDemo ? "demo" : null)
  )
  const [status, setStatus] = useState<UploadPanelStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (startsInDemo) {
      persistDemoDashboardEntry()
      return
    }

    clearDashboardEntry()
  }, [startsInDemo])

  const handleUseDemo = useCallback(() => {
    persistDemoDashboardEntry()
    setStatus("idle")
    setError(null)
    setScenario(sampleSupplyScenario)
    setScenarioSource("demo")
  }, [])

  const handleReset = useCallback(() => {
    clearDashboardEntry()
    setStatus("idle")
    setError(null)
  }, [])

  const handleFile = useCallback(async (file: File) => {
    clearDashboardEntry()
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
      setScenarioSource("search")
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
      scenarioSource={scenarioSource}
      status={status}
    />
  )
}
