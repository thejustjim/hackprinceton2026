"use client"

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Download04Icon } from "@hugeicons/core-free-icons"
import { useDefaultLayout } from "react-resizable-panels"

import { GlobeView } from "@/components/dashboard/globe-view"
import { GraphView } from "@/components/dashboard/graph-view"
import {
  UploadPanel,
  type UploadPanelStatus,
} from "@/components/dashboard/upload-panel"
import { GreenChainLogo } from "@/components/green-chain-logo"
import { Button } from "@/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useSmoothedHandleIndicator,
} from "@/components/ui/resizable"
import {
  type SupplyScenario,
  type SupplyScenarioSelectableNodeId,
} from "@/lib/supply-chain-scenario"
import { cn } from "@/lib/utils"

const DASHBOARD_MAIN_SPLIT_ID = "dashboard-main-split"
const DASHBOARD_GRAPH_PANEL_ID = "dashboard-graph-panel"
const DASHBOARD_GLOBE_PANEL_ID = "dashboard-globe-panel"
const DASHBOARD_MAIN_SPLIT_DEFAULT = {
  [DASHBOARD_GRAPH_PANEL_ID]: 60,
  [DASHBOARD_GLOBE_PANEL_ID]: 40,
}

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

function createComponentBooleanMap(
  scenario: SupplyScenario | null,
  overrides: Record<string, boolean>,
  defaultValue: boolean
) {
  if (!scenario) {
    return {}
  }

  return Object.fromEntries(
    scenario.components.map((component) => [
      component.id,
      overrides[component.id] ?? defaultValue,
    ])
  )
}

function getLinkedComponentId(
  scenario: SupplyScenario | null,
  manufacturerComponentById: Map<string, string>,
  nodeId: SupplyScenarioSelectableNodeId | null
) {
  if (!scenario || !nodeId || nodeId === scenario.product.id) {
    return null
  }

  const component = scenario.components.find((item) => item.id === nodeId)

  if (component) {
    return component.id
  }

  return manufacturerComponentById.get(nodeId) ?? null
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
  const [isDesktopLayout, setIsDesktopLayout] = useState(false)
  const [isDashboardResizing, setIsDashboardResizing] = useState(false)
  const dashboardResizeTimeoutRef = useRef<number | null>(null)
  const dashboardSplitRef = useRef<HTMLDivElement>(null)
  const {
    defaultLayout: persistedDashboardLayout,
    onLayoutChanged: persistDashboardLayout,
  } = useDefaultLayout({
    id: DASHBOARD_MAIN_SPLIT_ID,
    panelIds: [DASHBOARD_GRAPH_PANEL_ID, DASHBOARD_GLOBE_PANEL_ID],
  })
  const {
    measure: measureDashboardHandleIndicator,
    position: dashboardHandleIndicatorPosition,
    targetPosition: dashboardHandleTargetPosition,
  } = useSmoothedHandleIndicator(dashboardSplitRef)
  const basePinnedManufacturerByComponent = useMemo(
    () => (scenario ? createPinnedManufacturerByComponent(scenario) : {}),
    [scenario]
  )
  const [pinnedManufacturerOverrides, setPinnedManufacturerOverrides] =
    useState<Record<string, string>>({})
  const [routeVisibleOverrides, setRouteVisibleOverrides] = useState<
    Record<string, boolean>
  >({})
  const [routeCollapsedOverrides, setRouteCollapsedOverrides] = useState<
    Record<string, boolean>
  >({})
  const validManufacturerIds = useMemo(
    () =>
      new Set(
        scenario?.manufacturers.map((manufacturer) => manufacturer.id) ?? []
      ),
    [scenario]
  )
  const validNodeIds = useMemo(
    () => new Set(scenario?.graph.nodes.map((node) => node.id) ?? []),
    [scenario]
  )
  const pinnedManufacturerByComponent = useMemo(
    () =>
      Object.fromEntries(
        Object.entries({
          ...basePinnedManufacturerByComponent,
          ...pinnedManufacturerOverrides,
        }).filter(
          ([componentId, manufacturerId]) =>
            componentId in basePinnedManufacturerByComponent &&
            validManufacturerIds.has(manufacturerId)
        )
      ),
    [
      basePinnedManufacturerByComponent,
      pinnedManufacturerOverrides,
      validManufacturerIds,
    ]
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
  const routeVisibleByComponent = useMemo(
    () => createComponentBooleanMap(scenario, routeVisibleOverrides, true),
    [routeVisibleOverrides, scenario]
  )
  const routeCollapsedByComponent = useMemo(
    () => createComponentBooleanMap(scenario, routeCollapsedOverrides, true),
    [routeCollapsedOverrides, scenario]
  )
  const resolvedSelectedNodeId =
    selectedNodeId && validNodeIds.has(selectedNodeId) ? selectedNodeId : null
  const resolvedHoveredNodeId =
    hoveredNodeId && validNodeIds.has(hoveredNodeId) ? hoveredNodeId : null
  const reportStatusText =
    reportError ||
    (reportPending && reportProgress ? reportProgress.label : null) ||
    scenario?.updatedAt ||
    null

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)")
    const syncLayoutMode = () => setIsDesktopLayout(mediaQuery.matches)

    syncLayoutMode()
    mediaQuery.addEventListener("change", syncLayoutMode)

    return () => {
      mediaQuery.removeEventListener("change", syncLayoutMode)
    }
  }, [])

  useEffect(() => {
    if (!scenario) {
      return
    }

    const selectedComponentId = getLinkedComponentId(
      scenario,
      manufacturerComponentById,
      selectedNodeId
    )
    const hoveredComponentId = getLinkedComponentId(
      scenario,
      manufacturerComponentById,
      hoveredNodeId
    )

    if (
      selectedComponentId &&
      !(routeVisibleByComponent[selectedComponentId] ?? true)
    ) {
      const frameId = window.requestAnimationFrame(() => {
        setSelectedNodeId((currentNodeId) =>
          currentNodeId === scenario.product.id
            ? currentNodeId
            : scenario.product.id
        )

        if (
          hoveredComponentId &&
          !(routeVisibleByComponent[hoveredComponentId] ?? true)
        ) {
          setHoveredNodeId(null)
        }
      })

      return () => window.cancelAnimationFrame(frameId)
    }

    if (
      hoveredComponentId &&
      !(routeVisibleByComponent[hoveredComponentId] ?? true)
    ) {
      const frameId = window.requestAnimationFrame(() => {
        setHoveredNodeId(null)
      })

      return () => window.cancelAnimationFrame(frameId)
    }
  }, [
    hoveredNodeId,
    manufacturerComponentById,
    routeVisibleByComponent,
    scenario,
    selectedNodeId,
  ])

  const stopDashboardResizeTracking = useCallback(() => {
    if (dashboardResizeTimeoutRef.current !== null) {
      window.clearTimeout(dashboardResizeTimeoutRef.current)
      dashboardResizeTimeoutRef.current = null
    }

    setIsDashboardResizing(false)
  }, [])

  const markDashboardResizeActive = useCallback(() => {
    setIsDashboardResizing(true)

    if (dashboardResizeTimeoutRef.current !== null) {
      window.clearTimeout(dashboardResizeTimeoutRef.current)
    }

    dashboardResizeTimeoutRef.current = window.setTimeout(() => {
      dashboardResizeTimeoutRef.current = null
      setIsDashboardResizing(false)
    }, 180)
  }, [])

  const handleDashboardLayoutChange = useCallback(() => {
    markDashboardResizeActive()
    measureDashboardHandleIndicator()
  }, [markDashboardResizeActive, measureDashboardHandleIndicator])

  const handleDashboardLayoutChanged = useCallback(
    (layout: Record<string, number>) => {
      persistDashboardLayout(layout)
      measureDashboardHandleIndicator()
      stopDashboardResizeTracking()
    },
    [
      measureDashboardHandleIndicator,
      persistDashboardLayout,
      stopDashboardResizeTracking,
    ]
  )

  useEffect(() => stopDashboardResizeTracking, [stopDashboardResizeTracking])

  useEffect(() => {
    if (!isDesktopLayout) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      measureDashboardHandleIndicator()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isDesktopLayout, measureDashboardHandleIndicator])

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

  function handleToggleRouteVisible(componentId: string) {
    setRouteVisibleOverrides((previousState) => ({
      ...previousState,
      [componentId]: !(previousState[componentId] ?? true),
    }))
  }

  function handleToggleRouteCollapsed(componentId: string) {
    setRouteCollapsedOverrides((previousState) => ({
      ...previousState,
      [componentId]: !(previousState[componentId] ?? true),
    }))
  }

  const graphPanel = scenario ? (
    <GraphView
      bestEcoManufacturerByComponent={bestEcoManufacturerByComponent}
      className="h-full min-h-0"
      hoveredNodeId={resolvedHoveredNodeId}
      isPanelResizing={isDashboardResizing}
      onHoverNode={handleHoverNode}
      onPromptChange={onPromptChange}
      onPromptSubmit={onPromptSubmit}
      onSelectNode={handleSelectNode}
      promptError={promptError}
      promptPending={promptPending}
      promptPlaceholder={promptPlaceholder}
      promptValue={promptValue}
      pinnedManufacturerByComponent={pinnedManufacturerByComponent}
      routeVisibleByComponent={routeVisibleByComponent}
      scenario={scenario}
      selectedNodeId={resolvedSelectedNodeId}
    />
  ) : null

  const globePanel = scenario ? (
    <GlobeView
      bestEcoManufacturerByComponent={bestEcoManufacturerByComponent}
      className="h-full min-h-0"
      hoveredNodeId={resolvedHoveredNodeId}
      onHoverNode={handleHoverNode}
      onSelectNode={handleSelectNode}
      onToggleRouteCollapsed={handleToggleRouteCollapsed}
      onToggleRouteVisible={handleToggleRouteVisible}
      pinnedManufacturerByComponent={pinnedManufacturerByComponent}
      routeCollapsedByComponent={routeCollapsedByComponent}
      routeVisibleByComponent={routeVisibleByComponent}
      scenario={scenario}
      selectedNodeId={resolvedSelectedNodeId}
    />
  ) : null

  const dashboardHandleLagOffset =
    dashboardHandleIndicatorPosition && dashboardHandleTargetPosition
      ? Math.max(
          -4,
          Math.min(
            4,
            dashboardHandleIndicatorPosition.x - dashboardHandleTargetPosition.x
          )
        )
      : 0

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
              <div className="grid gap-x-3 gap-y-1 sm:w-[27rem] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <p
                  className={cn(
                    "min-w-0 truncate text-right text-xs sm:pr-1",
                    reportError ? "text-red-300/80" : "text-muted-foreground"
                  )}
                  title={reportStatusText ?? undefined}
                >
                  {reportStatusText ?? "\u00A0"}
                </p>
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
                  className="min-w-[9.75rem] justify-center rounded-full border-white/12 bg-white/[0.03] text-white/80 hover:bg-white/[0.06] hover:text-white"
                >
                  <HugeiconsIcon
                    icon={Download04Icon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  {reportPending ? "Rendering PDF..." : "Download PDF"}
                </Button>
                <div className="translate-y-1 sm:col-start-2 sm:w-[9.75rem]">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className={cn(
                        "h-full rounded-full bg-[linear-gradient(90deg,rgba(15,118,110,0.75),rgba(94,234,212,0.92))] transition-[width,opacity] duration-500 ease-out",
                        reportPending && reportProgress
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                      aria-hidden={!reportPending || !reportProgress}
                      style={{
                        width: `${Math.max(
                          8,
                          Math.min((reportProgress?.value ?? 0.08) * 100, 96)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
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
          isDesktopLayout ? (
            <div ref={dashboardSplitRef} className="relative min-h-0 flex-1">
              <ResizablePanelGroup
                id={DASHBOARD_MAIN_SPLIT_ID}
                className="min-h-0 flex-1"
                defaultLayout={
                  persistedDashboardLayout ?? DASHBOARD_MAIN_SPLIT_DEFAULT
                }
                onLayoutChange={handleDashboardLayoutChange}
                onLayoutChanged={handleDashboardLayoutChanged}
              >
                <ResizablePanel
                  id={DASHBOARD_GRAPH_PANEL_ID}
                  className="min-h-0"
                  minSize="35%"
                >
                  <div className="h-full min-h-0 pr-2">{graphPanel}</div>
                </ResizablePanel>
                <ResizableHandle className="mx-0.5 w-3 rounded-full bg-transparent after:w-6" />
                <ResizablePanel
                  id={DASHBOARD_GLOBE_PANEL_ID}
                  className="min-h-0"
                  minSize="30%"
                >
                  <div className="h-full min-h-0 pl-2">{globePanel}</div>
                </ResizablePanel>
              </ResizablePanelGroup>
              {dashboardHandleTargetPosition ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute z-20 transition-opacity duration-150"
                  style={{
                    left: dashboardHandleTargetPosition.x - 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                >
                  <span
                    className={cn(
                      "flex w-3 items-center justify-center overflow-hidden rounded-full bg-white/[0.04] shadow-[0_0_14px_rgba(255,255,255,0.05)] transition-[height,background-color,box-shadow] duration-200",
                      isDashboardResizing ? "h-24 bg-white/[0.08]" : "h-16"
                    )}
                  >
                    <span
                      className={cn(
                        "block w-[3px] rounded-full bg-white/[0.16] shadow-[0_0_10px_rgba(255,255,255,0.08)] transition-[height,background-color,box-shadow] duration-200",
                        isDashboardResizing ? "h-24 bg-white/[0.3]" : "h-16"
                      )}
                      style={{
                        transform: `translateX(${dashboardHandleLagOffset}px)`,
                      }}
                    />
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <section className="grid min-h-0 flex-1 grid-rows-2 gap-4">
              {graphPanel}
              {globePanel}
            </section>
          )
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
