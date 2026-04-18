"use client"

import { startTransition, useMemo, useState } from "react"

import { GlobeView } from "@/components/dashboard/globe-view"
import { GraphView } from "@/components/dashboard/graph-view"
import { Button } from "@/components/ui/button"
import {
  type SupplyScenario,
  type SupplyScenarioSelectableNodeId,
} from "@/lib/supply-chain-scenario"

interface DashboardShellProps {
  onRestartOnboarding?: () => void
  scenario: SupplyScenario
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

export function DashboardShell({
  onRestartOnboarding,
  scenario,
}: DashboardShellProps) {
  const [selectedNodeId, setSelectedNodeId] =
    useState<SupplyScenarioSelectableNodeId | null>(null)
  const [hoveredNodeId, setHoveredNodeId] =
    useState<SupplyScenarioSelectableNodeId | null>(null)
  const basePinnedManufacturerByComponent = useMemo(
    () => createPinnedManufacturerByComponent(scenario),
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
  const manufacturerComponentById = useMemo(
    () =>
      new Map(
        scenario.manufacturers.map(
          (manufacturer) => [manufacturer.id, manufacturer.componentId] as const
        )
      ),
    [scenario.manufacturers]
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
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-[0.18em] text-white/30 uppercase">
                GreenChain Demo
              </p>
              <p className="mt-1 truncate text-base font-medium text-white/85">
                {scenario.title}
              </p>
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
            <div className="text-sm text-muted-foreground">
              {scenario.updatedAt}
            </div>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 grid-rows-2 gap-4 lg:grid-cols-[1.45fr_minmax(400px,0.95fr)] lg:grid-rows-1">
          <GraphView
            className="h-full min-h-0"
            hoveredNodeId={hoveredNodeId}
            onHoverNode={handleHoverNode}
            onSelectNode={handleSelectNode}
            scenario={scenario}
            selectedNodeId={selectedNodeId}
          />
          <GlobeView
            className="h-full min-h-0"
            hoveredNodeId={hoveredNodeId}
            onHoverNode={handleHoverNode}
            onSelectNode={handleSelectNode}
            pinnedManufacturerByComponent={pinnedManufacturerByComponent}
            scenario={scenario}
            selectedNodeId={selectedNodeId}
          />
        </section>
      </div>
    </main>
  )
}
