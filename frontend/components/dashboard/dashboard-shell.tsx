"use client"

import { startTransition, useEffect, useMemo, useState } from "react"

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
  const [pinnedManufacturerByComponent, setPinnedManufacturerByComponent] =
    useState(() => createPinnedManufacturerByComponent(scenario))
  const manufacturerComponentById = useMemo(
    () =>
      new Map(
        scenario.manufacturers.map(
          (manufacturer) => [manufacturer.id, manufacturer.componentId] as const
        )
      ),
    [scenario.manufacturers]
  )

  useEffect(() => {
    setPinnedManufacturerByComponent(
      createPinnedManufacturerByComponent(scenario)
    )
  }, [scenario])

  function handleSelectNode(nodeId: SupplyScenarioSelectableNodeId | null) {
    const componentId = nodeId ? manufacturerComponentById.get(nodeId) : null

    if (componentId && nodeId) {
      setPinnedManufacturerByComponent((previousState) =>
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
    <main className="dashboard-shell">
      <div className="mx-auto flex min-h-svh w-full max-w-[1600px] flex-col gap-4 px-4 py-4 lg:px-5">
        <header className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-medium tracking-tight text-foreground">
              GreenChain · Supply Intelligence
            </h1>
            <p className="text-sm text-muted-foreground">
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

        <section className="grid flex-1 gap-4 lg:grid-cols-[1.45fr_minmax(400px,0.95fr)]">
          <GraphView
            className="min-h-[32rem] lg:min-h-0"
            hoveredNodeId={hoveredNodeId}
            onHoverNode={handleHoverNode}
            onSelectNode={handleSelectNode}
            scenario={scenario}
            selectedNodeId={selectedNodeId}
          />
          <GlobeView
            className="min-h-[32rem] lg:min-h-0"
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
