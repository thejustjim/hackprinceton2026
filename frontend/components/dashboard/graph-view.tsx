"use client"

import {
  type SupplyScenario,
  type SupplyScenarioSelectableNodeId,
} from "@/lib/supply-chain-scenario"
import { cn } from "@/lib/utils"
import { SupplyChainGraph } from "@/components/dashboard/supply-chain-graph"
import { PromptBar } from "@/components/dashboard/prompt-bar"

interface GraphViewProps {
  bestEcoManufacturerByComponent: Record<string, string>
  className?: string
  hoveredNodeId: SupplyScenarioSelectableNodeId | null
  onHoverNode: (nodeId: SupplyScenarioSelectableNodeId | null) => void
  onPromptChange: (value: string) => void
  onPromptSubmit: () => void
  onSelectNode: (nodeId: SupplyScenarioSelectableNodeId | null) => void
  promptError?: string | null
  promptPending?: boolean
  promptValue: string
  scenario: SupplyScenario
  selectedNodeId: SupplyScenarioSelectableNodeId | null
}

export function GraphView({
  bestEcoManufacturerByComponent,
  className,
  hoveredNodeId,
  onHoverNode,
  onPromptChange,
  onPromptSubmit,
  onSelectNode,
  promptError,
  promptPending,
  promptValue,
  scenario,
  selectedNodeId,
}: GraphViewProps) {
  return (
    <section
      className={cn(
        "panel-surface flex min-h-0 flex-col overflow-hidden rounded-2xl",
        className
      )}
    >
      {/* Panel header */}
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              background: "color-mix(in oklab, var(--primary) 72%, white 8%)",
              boxShadow:
                "0 0 8px color-mix(in oklab, var(--primary) 44%, transparent)",
            }}
          />
          <div>
            <h2 className="text-sm font-medium text-white/85">
              Supply Chain Graph
            </h2>
            <p className="text-[11px] text-white/30">
              {scenario.title} · {scenario.quantity.toLocaleString()}{" "}
              {scenario.unit}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md border border-emerald-400/[0.15] bg-emerald-400/[0.08] px-2 py-1 text-[10px] font-medium text-emerald-300/70">
            Live
          </span>
          <span className="rounded-md border border-emerald-400/20 bg-emerald-400/[0.08] px-2 py-1 text-[10px] font-medium text-emerald-200/80">
            Green edges = most sustainable
          </span>
          <span className="dashboard-chip-muted">
            {scenario.stats.graphNodeCount} nodes ·{" "}
            {scenario.stats.graphEdgeCount} edges
          </span>
        </div>
      </div>

      {/* Graph canvas — fills all remaining height */}
      <div className="relative min-h-0 flex-1">
        <SupplyChainGraph
          bestEcoManufacturerByComponent={bestEcoManufacturerByComponent}
          hoveredNodeId={hoveredNodeId}
          onHoverNode={onHoverNode}
          onSelectNode={onSelectNode}
          scenario={scenario}
          selectedNodeId={selectedNodeId}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4">
          <PromptBar
            className="pointer-events-auto mx-auto w-full max-w-4xl"
            error={promptError}
            onSubmit={onPromptSubmit}
            onValueChange={onPromptChange}
            pending={promptPending}
            value={promptValue}
          />
        </div>
      </div>
    </section>
  )
}
