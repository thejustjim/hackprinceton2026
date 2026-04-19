"use client"

import { startTransition, useMemo, useState } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Download04Icon } from "@hugeicons/core-free-icons"

import { GlobeView } from "@/components/dashboard/globe-view"
import { GraphView } from "@/components/dashboard/graph-view"
import {
  UploadPanel,
  type UploadPanelStatus,
} from "@/components/dashboard/upload-panel"
import { GreenChainLogo } from "@/components/green-chain-logo"
import { Button } from "@/components/ui/button"
import {
  type SupplyScenario,
  type SupplyScenarioSelectableNodeId,
} from "@/lib/supply-chain-scenario"

interface DashboardShellProps {
  error: string | null
  onDownloadReport?: (payload: {
    scenario: SupplyScenario
    selectedManufacturerByComponent: Record<string, string>
  }) => void
  onFile: (file: File) => void
  onPromptChange: (value: string) => void
  onPromptSubmit: () => void
  onRestartOnboarding?: () => void
  onReset: () => void
  onUseDemo: () => void
  promptError?: string | null
  promptPending?: boolean
  promptPlaceholder?: string
  promptValue: string
  reportError?: string | null
  reportPending?: boolean
  reportProgress?: {
    label: string
    value: number
  }
  scenario: SupplyScenario | null
  scenarioSource: "demo" | "search" | null
  showUploadPanel?: boolean
  status: UploadPanelStatus
}

function createPinnedManufacturerByComponent(scenario: SupplyScenario) {
  return Object.fromEntries(
    scenario.components
      .map((component) => {
        const manufacturers = scenario.manufacturers.filter(
          (manufacturer) => manufacturer.componentId === component.id
        )
        const pinnedManufacturer =
          manufacturers.find((manufacturer) => manufacturer.isCurrent) ??
          manufacturers[0]

        return pinnedManufacturer
          ? ([component.id, pinnedManufacturer.id] as const)
          : null
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry))
  )
}

function createBestEcoManufacturerByComponent(scenario: SupplyScenario) {
  return Object.fromEntries(
    scenario.components
      .map((component) => {
        const manufacturers = scenario.manufacturers.filter(
          (manufacturer) => manufacturer.componentId === component.id
        )
        const bestManufacturer = manufacturers.reduce<
          (typeof manufacturers)[number] | null
        >((best, manufacturer) => {
          if (!best) {
            return manufacturer
          }

          if (manufacturer.ecoScore < best.ecoScore) {
            return manufacturer
          }

          if (
            manufacturer.ecoScore === best.ecoScore &&
            manufacturer.isCurrent &&
            !best.isCurrent
          ) {
            return manufacturer
          }

          return best
        }, null)

        return bestManufacturer
          ? ([component.id, bestManufacturer.id] as const)
          : null
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry))
  )
}

export function DashboardShell({
  error,
  onDownloadReport,
  onFile,
  onPromptChange,
  onPromptSubmit,
  onRestartOnboarding,
  onReset,
  onUseDemo,
  promptError,
  promptPending,
  promptPlaceholder,
  promptValue,
  reportError,
  reportPending = false,
  reportProgress,
  scenario,
  scenarioSource,
  showUploadPanel = true,
  status,
}: DashboardShellProps) {
  const [selectedNodeId, setSelectedNodeId] =
    useState<SupplyScenarioSelectableNodeId | null>(null)
  const [hoveredNodeId, setHoveredNodeId] =
    useState<SupplyScenarioSelectableNodeId | null>(null)
  const basePinnedManufacturerByComponent = useMemo(
    () => (scenario ? createPinnedManufacturerByComponent(scenario) : {}),
    [scenario]
  )
  const [pinnedManufacturerOverrides, setPinnedManufacturerOverrides] =
    useState<Record<string, string>>({})
  const pinnedManufacturerByComponent = useMemo(
    () => ({
      ...basePinnedManufacturerByComponent,
      ...pinnedManufacturerOverrides,
    }),
    [basePinnedManufacturerByComponent, pinnedManufacturerOverrides]
  )
  const bestEcoManufacturerByComponent = useMemo(
    () => (scenario ? createBestEcoManufacturerByComponent(scenario) : {}),
    [scenario]
  )
  const manufacturerComponentById = useMemo(
    () =>
      scenario
        ? new Map(
            scenario.manufacturers.map(
              (manufacturer) =>
                [manufacturer.id, manufacturer.componentId] as const
            )
          )
        : new Map<string, string>(),
    [scenario]
  )

  function handleSelectNode(nodeId: SupplyScenarioSelectableNodeId | null) {
    const componentId = nodeId ? manufacturerComponentById.get(nodeId) : null

    if (componentId && nodeId) {
      setPinnedManufacturerOverrides((previousState) =>
        previousState[componentId] === nodeId
          ? previousState
          : {
              ...previousState,
              [componentId]: nodeId,
            }
      )
    }

    startTransition(() => {
      setSelectedNodeId(nodeId)
    })
  }

  function handleHoverNode(nodeId: SupplyScenarioSelectableNodeId | null) {
    setHoveredNodeId(nodeId)
  }

  return (
    <main className="dashboard-shell h-svh">
      <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col gap-4 px-4 py-4 lg:px-5">
        <header className="flex flex-col gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
            <Link
              href="/"
              className="inline-flex shrink-0 items-center transition-opacity hover:opacity-90"
            >
              <GreenChainLogo
                variant="onDark"
                className="h-7 w-auto sm:h-8 md:h-9"
              />
            </Link>
            {scenario ? (
              <div className="grid min-w-0 flex-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1.1fr)]">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    Scenario ID
                  </p>
                  <p
                    className="mt-0.5 truncate font-mono text-xs text-foreground/90"
                    title={scenario.id}
                  >
                    {scenario.id}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {scenarioSource === "demo"
                      ? "Offline snapshot"
                      : scenarioSource === "search"
                        ? "Search-backed run"
                        : null}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    Plan volume
                  </p>
                  <p className="mt-0.5 text-foreground/90">
                    {scenario.quantity.toLocaleString()}{" "}
                    <span className="text-muted-foreground">
                      {scenario.unit}
                    </span>
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    Ship-to
                  </p>
                  <p className="mt-0.5 truncate text-foreground/90">
                    {scenario.destination.location.city},{" "}
                    {scenario.destination.location.country}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {scenario.stats.componentCount} components ·{" "}
                    {scenario.stats.routeCount} routes ·{" "}
                    {scenario.stats.siteCount} sites
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Load a scenario to open the operations view.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {onRestartOnboarding ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRestartOnboarding}
                className="rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                Restart onboarding
              </Button>
            ) : null}
            {scenario && onDownloadReport ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onDownloadReport({
                    scenario,
                    selectedManufacturerByComponent:
                      pinnedManufacturerByComponent,
                  })
                }
                disabled={reportPending}
                className="rounded-full border-white/12 bg-white/[0.03] text-white/80 hover:bg-white/[0.06] hover:text-white"
              >
                <HugeiconsIcon
                  icon={Download04Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                {reportPending ? "Rendering PDF..." : "Download PDF"}
              </Button>
            ) : null}
            {scenario?.updatedAt ? (
              <p className="text-right text-xs text-muted-foreground sm:max-w-xs">
                {scenario.updatedAt}
              </p>
            ) : null}
            {reportPending && reportProgress ? (
              <div className="sm:max-w-xs">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-right text-[11px] text-white/58">
                    {reportProgress.label}
                  </p>
                  <span className="font-mono text-[10px] tracking-[0.14em] text-white/34 uppercase">
                    Processing
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(15,118,110,0.75),rgba(94,234,212,0.92))] transition-[width] duration-500 ease-out"
                    style={{
                      width: `${Math.max(
                        8,
                        Math.min(reportProgress.value * 100, 96)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
            {reportError ? (
              <p className="text-right text-xs text-red-300/80 sm:max-w-xs">
                {reportError}
              </p>
            ) : null}
          </div>
        </header>

        {showUploadPanel ? (
          <UploadPanel
            error={error}
            onFile={onFile}
            onReset={onReset}
            onUseDemo={onUseDemo}
            scenarioSource={scenarioSource}
            scenarioTitle={scenario?.title ?? null}
            status={status}
          />
        ) : null}

        {scenario ? (
          <section className="grid min-h-0 flex-1 grid-rows-2 gap-4 lg:grid-cols-[1.45fr_minmax(400px,0.95fr)] lg:grid-rows-1">
            <GraphView
              bestEcoManufacturerByComponent={bestEcoManufacturerByComponent}
              className="h-full min-h-0"
              hoveredNodeId={hoveredNodeId}
              onHoverNode={handleHoverNode}
              onPromptChange={onPromptChange}
              onPromptSubmit={onPromptSubmit}
              onSelectNode={handleSelectNode}
              promptError={promptError}
              promptPending={promptPending}
              promptPlaceholder={promptPlaceholder}
              promptValue={promptValue}
              scenario={scenario}
              selectedNodeId={selectedNodeId}
            />
            <GlobeView
              bestEcoManufacturerByComponent={bestEcoManufacturerByComponent}
              className="h-full min-h-0"
              hoveredNodeId={hoveredNodeId}
              onHoverNode={handleHoverNode}
              onSelectNode={handleSelectNode}
              pinnedManufacturerByComponent={pinnedManufacturerByComponent}
              scenario={scenario}
              selectedNodeId={selectedNodeId}
            />
          </section>
        ) : (
          <section className="panel-surface flex min-h-0 flex-1 items-center justify-center rounded-2xl">
            <div className="max-w-md text-center">
              <p className="text-[10px] font-medium tracking-[0.28em] text-white/40 uppercase">
                {status === "loading" ? "Processing" : "Empty state"}
              </p>
              <p className="mt-3 text-base font-medium text-white/80">
                {status === "loading"
                  ? "Building your scenario"
                  : error
                    ? "Scenario could not be loaded"
                    : "No data loaded"}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/48">
                {status === "loading"
                  ? "Running the agent and ML scoring flow for each component."
                  : error
                    ? error
                    : showUploadPanel
                      ? "Drop a CSV above to run the full agent + ML search, or use the demo dataset to preview the dashboard offline."
                      : "Upload scenarios from the launch page. This dashboard is for results only."}
              </p>
              {!showUploadPanel && status !== "loading" ? (
                <div className="mt-5 flex items-center justify-center gap-3">
                  <Button asChild variant="outline">
                    <Link href="/launch">Go To Launch</Link>
                  </Button>
                  <Button type="button" onClick={onUseDemo}>
                    Use Demo Data
                  </Button>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
