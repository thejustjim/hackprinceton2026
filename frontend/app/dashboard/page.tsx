"use client"

import { useCallback, useEffect, useState } from "react"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import type { UploadPanelStatus } from "@/components/dashboard/upload-panel"
import { search } from "@/lib/api"
import { apiResultToScenario } from "@/lib/api-to-scenario"
import { parseScenarioSearchCsv } from "@/lib/csv-to-search"
import {
  clearPendingScenarioCsv,
  consumePendingScenarioCsv,
} from "@/lib/scenario-handoff"
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

  const runScenarioCsvText = useCallback(async (text: string) => {
    setStatus("loading")
    setError(null)

    const parsed = parseScenarioSearchCsv(text)
    if (!parsed.ok) {
      setStatus("error")
      setError(parsed.error)
      return
    }

    const scenarioCsv = parsed.scenario
    try {
      const response = await search({
        components: scenarioCsv.components.map((component) => ({
          component: component.component,
          current_certifications: component.currentCertifications,
          current_city: component.currentCity,
          current_country: component.currentCountry,
          current_disclosure_status: component.currentDisclosureStatus,
          current_manufacturer: component.currentManufacturer,
          current_renewable_pct: component.currentRenewablePct,
          current_revenue_usd_m: component.currentRevenueUsdM,
          current_website: component.currentWebsite,
        })),
        product: scenarioCsv.product,
        quantity: scenarioCsv.quantity,
        destination: scenarioCsv.destination,
        countries: [],
        target_count: scenarioCsv.targetCount ?? undefined,
        transport_mode: scenarioCsv.transportMode,
      })
      setScenario(apiResultToScenario(response, scenarioCsv))
      setStatus("idle")
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unknown error during search."
      setStatus("error")
      setError(message)
    }
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      let text: string
      try {
        text = await file.text()
      } catch {
        setStatus("error")
        setError("Could not read the file.")
        return
      }

      await runScenarioCsvText(text)
    },
    [runScenarioCsvText]
  )

  useEffect(() => {
    const isLaunchHandoff =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("handoff") === "1"

    if (!isLaunchHandoff) {
      clearPendingScenarioCsv()
      return
    }

    const pendingCsv = consumePendingScenarioCsv()
    if (!pendingCsv) {
      setStatus("error")
      setError("No scenario CSV was transferred from /launch.")
      return
    }

    void runScenarioCsvText(pendingCsv)
  }, [runScenarioCsvText])

  return (
    <DashboardShell
      error={error}
      onFile={handleFile}
      onReset={handleReset}
      onUseDemo={handleUseDemo}
      scenario={scenario}
      showUploadPanel={false}
      status={status}
    />
  )
}
