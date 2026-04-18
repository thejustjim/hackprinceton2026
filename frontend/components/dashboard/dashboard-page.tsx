"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import type { UploadPanelStatus } from "@/components/dashboard/upload-panel"
import { search } from "@/lib/api"
import { apiResultToScenario } from "@/lib/api-to-scenario"
import { parseScenarioSearchCsv } from "@/lib/csv-to-search"
import {
  clearDashboardEntry,
  persistDemoDashboardEntry,
} from "@/lib/dashboard-entry"
import {
  clearPendingScenarioCsv,
  consumePendingScenarioCsv,
} from "@/lib/scenario-handoff"
import {
  sampleSupplyScenario,
  type SupplyScenario,
} from "@/lib/supply-chain-scenario"

interface DashboardPageProps {
  isHandoff: boolean
  startsInDemo: boolean
}

export function DashboardPage({ isHandoff, startsInDemo }: DashboardPageProps) {
  const [scenario, setScenario] = useState<SupplyScenario | null>(() =>
    startsInDemo ? sampleSupplyScenario : null
  )
  const [scenarioSource, setScenarioSource] = useState<"demo" | "search" | null>(
    () => (startsInDemo ? "demo" : null)
  )
  const [status, setStatus] = useState<UploadPanelStatus>(() =>
    isHandoff ? "loading" : "idle"
  )
  const [error, setError] = useState<string | null>(null)
  const handoffConsumedRef = useRef(false)

  const runScenarioCsvText = useCallback(async (text: string) => {
    clearDashboardEntry()
    setStatus("loading")
    setError(null)
    setScenario(null)
    setScenarioSource(null)

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
      setScenarioSource("search")
      setStatus("idle")
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unknown error during search."
      setStatus("error")
      setError(message)
    }
  }, [])

  useEffect(() => {
    if (isHandoff) {
      if (handoffConsumedRef.current) return
      handoffConsumedRef.current = true

      const pendingCsv = consumePendingScenarioCsv()
      if (!pendingCsv) {
        setScenario(null)
        setScenarioSource(null)
        setStatus("error")
        setError("No scenario CSV was transferred from /launch.")
        return
      }

      void runScenarioCsvText(pendingCsv)
      return
    }

    clearPendingScenarioCsv()

    if (startsInDemo) {
      persistDemoDashboardEntry()
      setScenario(sampleSupplyScenario)
      setScenarioSource("demo")
      setStatus("idle")
      setError(null)
      return
    }

    clearDashboardEntry()
    setScenario(null)
    setScenarioSource(null)
    setStatus("idle")
    setError(null)
  }, [isHandoff, runScenarioCsvText, startsInDemo])

  const handleUseDemo = useCallback(() => {
    clearPendingScenarioCsv()
    persistDemoDashboardEntry()
    setStatus("idle")
    setError(null)
    setScenario(sampleSupplyScenario)
    setScenarioSource("demo")
  }, [])

  const handleReset = useCallback(() => {
    clearPendingScenarioCsv()
    clearDashboardEntry()
    setStatus("idle")
    setError(null)
    setScenario(null)
    setScenarioSource(null)
  }, [])

  return (
    <DashboardShell
      error={error}
      onFile={() => undefined}
      onReset={handleReset}
      onUseDemo={handleUseDemo}
      scenario={scenario}
      scenarioSource={scenarioSource}
      showUploadPanel={false}
      status={status}
    />
  )
}
