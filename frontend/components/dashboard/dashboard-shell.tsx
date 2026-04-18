"use client"

import { startTransition, useMemo, useState } from "react"
import Link from "next/link"

import { GlobeView } from "@/components/dashboard/globe-view"
import { GraphView } from "@/components/dashboard/graph-view"
import {
  UploadPanel,
  type UploadPanelStatus,
} from "@/components/dashboard/upload-panel"
import { GreenChainLogo } from "@/components/green-chain-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  type SupplyScenario,
  type SupplyScenarioSelectableNodeId,
} from "@/lib/supply-chain-scenario"

interface DashboardShellProps {
  error: string | null
  onFile: (file: File) => void
  onPromptChange: (value: string) => void
  onPromptSubmit: () => void
  onRestartOnboarding?: () => void
  onReset: () => void
  onUseDemo: () => void
  promptError?: string | null
  promptPending?: boolean
  promptValue: string
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
  onFile,
  onPromptChange,
  onPromptSubmit,
  onRestartOnboarding,
  onReset,
  onUseDemo,
  promptError,
  promptPending,
  promptValue,
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
  const [pinnedManufacturerOverrides, setPinnedManufacturerOverrides] = useState<
    Record<string, string>
  >({})
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
        <header className="flex flex-col gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
            <Link
              href="/"
              className="inline-flex shrink-0 items-center transition-opacity hover:opacity-90"
            >
              <GreenChainLogo
                variant="onDark"
                className="h-7 w-auto sm:h-8 md:h-9"
              />
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 truncate text-base font-medium text-white/85">
                {scenario ? scenario.title : "Dashboard"}
              </p>
              {scenarioSource === "demo" ? (
                <Badge variant="outline" className="shrink-0">
                  Demo
                </Badge>
              ) : scenarioSource === "search" ? (
                <Badge variant="outline" className="shrink-0">
                  Live search
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground sm:max-w-md sm:border-l sm:border-border/70 sm:pl-5">
              Interactive supply chain graph · geographic intelligence
            </p>
          </div>
          <div className="flex items-center gap-3">
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
            {scenario && scenario.updatedAt && scenario.updatedAt !== "Sample dataset" ? (
              <div className="text-sm text-muted-foreground">
                {scenario.updatedAt}
              </div>
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
