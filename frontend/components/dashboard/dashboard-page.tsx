"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import type { UploadPanelStatus } from "@/components/dashboard/upload-panel"
import { editScenario, generateScenarioReport, search } from "@/lib/api"
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

interface ReportProgressState {
  label: string
  value: number
}

interface ScenarioEditHistoryState {
  future: SupplyScenario[]
  past: SupplyScenario[]
}

const MAX_SCENARIO_EDIT_HISTORY = 50

function createDefaultPrompt() {
  return `Show me only factories in Asia`
}

function getReportProgressState(elapsedMs: number): ReportProgressState {
  if (elapsedMs < 1200) {
    return { label: "Collecting route signals", value: 0.18 }
  }

  if (elapsedMs < 3200) {
    return { label: "Writing the narrative", value: 0.46 }
  }

  if (elapsedMs < 6200) {
    return { label: "Typesetting the PDF", value: 0.74 }
  }

  return { label: "Finalizing download", value: 0.92 }
}

function downloadBase64File(
  fileName: string,
  contentBase64: string,
  mimeType: string
) {
  const decoded = atob(contentBase64)
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0))
  const blob = new Blob([bytes], { type: mimeType })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

function trimScenarioHistory(stack: SupplyScenario[]) {
  return stack.length > MAX_SCENARIO_EDIT_HISTORY
    ? stack.slice(stack.length - MAX_SCENARIO_EDIT_HISTORY)
    : stack
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  )
}

function isKimiPromptTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("[data-kimi-prompt-input='true']"))
  )
}

export function DashboardPage({ isHandoff, startsInDemo }: DashboardPageProps) {
  const [scenario, setScenario] = useState<SupplyScenario | null>(() =>
    startsInDemo ? sampleSupplyScenario : null
  )
  const [scenarioSource, setScenarioSource] = useState<
    "demo" | "search" | null
  >(() => (startsInDemo ? "demo" : null))
  const [status, setStatus] = useState<UploadPanelStatus>(() =>
    isHandoff ? "loading" : "idle"
  )
  const [error, setError] = useState<string | null>(null)
  const [promptValue, setPromptValue] = useState("")
  const [promptPlaceholder, setPromptPlaceholder] = useState(() =>
    startsInDemo ? createDefaultPrompt() : ""
  )
  const [promptPending, setPromptPending] = useState(false)
  const [promptError, setPromptError] = useState<string | null>(null)
  const [reportPending, setReportPending] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportElapsedMs, setReportElapsedMs] = useState(0)
  const [scenarioEditHistory, setScenarioEditHistory] =
    useState<ScenarioEditHistoryState>({
      future: [],
      past: [],
    })
  const handoffConsumedRef = useRef(false)

  useEffect(() => {
    if (!reportPending) {
      return
    }

    const startedAt = Date.now()
    const intervalId = window.setInterval(() => {
      setReportElapsedMs(Date.now() - startedAt)
    }, 220)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [reportPending])

  const resetScenarioEditHistory = useCallback(() => {
    setScenarioEditHistory({
      future: [],
      past: [],
    })
  }, [])

  const handleUndoPromptEdit = useCallback(() => {
    if (promptPending || !scenario || scenarioEditHistory.past.length === 0) {
      return false
    }

    const previousScenario =
      scenarioEditHistory.past[scenarioEditHistory.past.length - 1]

    setScenarioEditHistory((previousState) => ({
      future: trimScenarioHistory([scenario, ...previousState.future]),
      past: previousState.past.slice(0, -1),
    }))
    setScenario(previousScenario)
    setPromptError(null)
    setReportPending(false)
    setReportElapsedMs(0)
    setReportError(null)
    return true
  }, [promptPending, scenario, scenarioEditHistory.past])

  const handleRedoPromptEdit = useCallback(() => {
    if (promptPending || !scenario || scenarioEditHistory.future.length === 0) {
      return false
    }

    const [nextScenario, ...remainingFuture] = scenarioEditHistory.future

    setScenarioEditHistory((previousState) => ({
      future: remainingFuture,
      past: trimScenarioHistory([...previousState.past, scenario]),
    }))
    setScenario(nextScenario)
    setPromptError(null)
    setReportPending(false)
    setReportElapsedMs(0)
    setReportError(null)
    return true
  }, [promptPending, scenario, scenarioEditHistory.future])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return
      }

      if (event.key.toLowerCase() !== "z") {
        return
      }

      if (isEditableTarget(event.target) && !isKimiPromptTarget(event.target)) {
        return
      }

      const handled = event.shiftKey
        ? handleRedoPromptEdit()
        : handleUndoPromptEdit()

      if (handled) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true })
  }, [handleRedoPromptEdit, handleUndoPromptEdit])

  const runScenarioCsvText = useCallback(async (text: string) => {
    clearDashboardEntry()
    setStatus("loading")
    setError(null)
    setPromptError(null)
    setReportPending(false)
    setReportElapsedMs(0)
    setReportError(null)
    setScenario(null)
    setScenarioSource(null)
    resetScenarioEditHistory()

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

      const nextScenario = apiResultToScenario(response, scenarioCsv)
      setScenario(nextScenario)
      setScenarioSource("search")
      setPromptValue("")
      setPromptPlaceholder(createDefaultPrompt())
      setReportPending(false)
      setReportElapsedMs(0)
      setReportError(null)
      resetScenarioEditHistory()
      setStatus("idle")
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Unknown error during search."
      setStatus("error")
      setError(message)
    }
  }, [resetScenarioEditHistory])

  useEffect(() => {
    if (isHandoff) {
      if (handoffConsumedRef.current) return
      handoffConsumedRef.current = true

      const pendingCsv = consumePendingScenarioCsv()
      if (!pendingCsv) {
        queueMicrotask(() => {
          setScenario(null)
          setScenarioSource(null)
          setStatus("error")
          setError("No scenario CSV was transferred from /launch.")
          resetScenarioEditHistory()
        })
        return
      }

      queueMicrotask(() => {
        void runScenarioCsvText(pendingCsv)
      })
      return
    }

    clearPendingScenarioCsv()

    if (startsInDemo) {
      persistDemoDashboardEntry()
      queueMicrotask(() => {
        setScenario(sampleSupplyScenario)
        setScenarioSource("demo")
        setPromptValue("")
        setPromptPlaceholder(createDefaultPrompt())
        setStatus("idle")
        setError(null)
        setPromptError(null)
        setReportPending(false)
        setReportElapsedMs(0)
        setReportError(null)
        resetScenarioEditHistory()
      })
      return
    }

    clearDashboardEntry()
    queueMicrotask(() => {
      setScenario(null)
      setScenarioSource(null)
      setPromptValue("")
      setStatus("idle")
      setError(null)
      setPromptError(null)
      setReportPending(false)
      setReportElapsedMs(0)
      setReportError(null)
      resetScenarioEditHistory()
    })
  }, [isHandoff, resetScenarioEditHistory, runScenarioCsvText, startsInDemo])

  const handleUseDemo = useCallback(() => {
    clearPendingScenarioCsv()
    persistDemoDashboardEntry()
    setStatus("idle")
    setError(null)
    setScenario(sampleSupplyScenario)
    setScenarioSource("demo")
    setPromptValue("")
    setPromptPlaceholder(createDefaultPrompt())
    setPromptError(null)
    setReportPending(false)
    setReportElapsedMs(0)
    setReportError(null)
    resetScenarioEditHistory()
  }, [resetScenarioEditHistory])

  const handleReset = useCallback(() => {
    clearPendingScenarioCsv()
    clearDashboardEntry()
    setStatus("idle")
    setError(null)
    setScenario(null)
    setScenarioSource(null)
    setPromptValue("")
    setPromptError(null)
    setReportPending(false)
    setReportElapsedMs(0)
    setReportError(null)
    resetScenarioEditHistory()
  }, [resetScenarioEditHistory])

  const handlePromptSubmit = useCallback(async () => {
    if (!scenario || !promptValue.trim() || promptPending) {
      return
    }

    setPromptPending(true)
    setPromptError(null)

    try {
      const response = await editScenario({
        prompt: promptValue,
        scenario,
      })

      if (response.status === "applied" && response.scenario) {
        setScenarioEditHistory((previousState) => ({
          future: [],
          past: scenario
            ? trimScenarioHistory([...previousState.past, scenario])
            : previousState.past,
        }))
        setScenario(response.scenario)
        setPromptError(null)
        return
      }

      setPromptError(response.message)
    } catch (caught) {
      setPromptError(
        caught instanceof Error
          ? caught.message
          : "Scenario edit failed unexpectedly."
      )
    } finally {
      setPromptPending(false)
    }
  }, [promptPending, promptValue, scenario])

  const handleDownloadReport = useCallback(
    async ({
      scenario: activeScenario,
      selectedManufacturerByComponent,
    }: {
      scenario: SupplyScenario
      selectedManufacturerByComponent: Record<string, string>
    }) => {
      if (reportPending) {
        return
      }

      setReportPending(true)
      setReportElapsedMs(0)
      setReportError(null)

      try {
        const response = await generateScenarioReport({
          scenario: activeScenario,
          selectedManufacturerByComponent,
        })
        downloadBase64File(
          response.fileName,
          response.contentBase64,
          response.mimeType
        )
      } catch (caught) {
        setReportError(
          caught instanceof Error
            ? caught.message
            : "Scenario report failed unexpectedly."
        )
      } finally {
        setReportPending(false)
        setReportElapsedMs(0)
      }
    },
    [reportPending]
  )

  return (
    <DashboardShell
      error={error}
      onDownloadReport={handleDownloadReport}
      onFile={() => undefined}
      onPromptChange={setPromptValue}
      onPromptSubmit={handlePromptSubmit}
      onReset={handleReset}
      onUseDemo={handleUseDemo}
      promptError={promptError}
      promptPending={promptPending}
      promptPlaceholder={promptPlaceholder}
      promptValue={promptValue}
      reportError={reportError}
      reportProgress={getReportProgressState(reportElapsedMs)}
      reportPending={reportPending}
      scenario={scenario}
      scenarioSource={scenarioSource}
      showUploadPanel={false}
      status={status}
    />
  )
}
