"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertDiamondIcon,
  DatabaseIcon,
  Factory01Icon,
  Globe02Icon,
  Link01Icon,
  PackageMoving01Icon,
  Route03Icon,
} from "@hugeicons/core-free-icons"

import { PromptBar } from "@/components/dashboard/prompt-bar"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import {
  type SupplyChainEntity,
  type SupplyChainSnapshot,
} from "@/lib/mock-supply-chain"

interface GraphViewProps {
  data: SupplyChainSnapshot
  className?: string
  selectedEntityId?: string
  onSelectEntity?: (entityId: string) => void
}

const kindIcons = {
  supplier: DatabaseIcon,
  component: PackageMoving01Icon,
  manufacturer: Factory01Icon,
  logistics: Route03Icon,
  market: Globe02Icon,
} as const

const statusTone = {
  stable: "bg-emerald-400/70",
  watch: "bg-amber-400/80",
  critical: "bg-rose-400/80",
} as const

function getSelectedEntity(
  selectedEntityId: string | undefined,
  entities: SupplyChainEntity[]
) {
  return (
    entities.find((entity) => entity.id === selectedEntityId) ?? entities[0]
  )
}

export function GraphView({
  data,
  className,
  selectedEntityId,
  onSelectEntity,
}: GraphViewProps) {
  const selectedEntity = getSelectedEntity(selectedEntityId, data.entities)

  return (
    <section
      className={cn(
        "panel-surface panel-grid flex min-h-0 flex-col rounded-2xl",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-foreground">Graph</h2>
          <p className="text-xs text-muted-foreground">Simple network shell</p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="supplier-heat">
            <SelectTrigger className="min-w-40">
              <SelectValue placeholder="Preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Presets</SelectLabel>
                <SelectItem value="supplier-heat">Supplier Heatmap</SelectItem>
                <SelectItem value="risk-trace">Risk Trace</SelectItem>
                <SelectItem value="route-focus">Route Focus</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <ToggleGroup
            type="single"
            defaultValue="graph"
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="graph">Graph</ToggleGroupItem>
            <ToggleGroupItem value="routes">Routes</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="relative flex-1 px-4 py-4">
        <svg
          className="absolute inset-x-4 top-4 bottom-24 h-[calc(100%-7rem)] w-[calc(100%-2rem)]"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {data.links.map((link) => {
            const source = data.entities.find(
              (entity) => entity.id === link.sourceId
            )
            const target = data.entities.find(
              (entity) => entity.id === link.targetId
            )

            if (!source || !target) {
              return null
            }

            const isSelected =
              selectedEntity.id === source.id || selectedEntity.id === target.id

            return (
              <path
                key={link.id}
                d={`M ${source.graph.x} ${source.graph.y} C ${(source.graph.x + target.graph.x) / 2} ${source.graph.y - 8} ${(source.graph.x + target.graph.x) / 2} ${target.graph.y + 8} ${target.graph.x} ${target.graph.y}`}
                fill="none"
                stroke={
                  isSelected
                    ? "color-mix(in oklab, var(--primary) 84%, white)"
                    : "color-mix(in oklab, var(--foreground) 18%, transparent)"
                }
                strokeOpacity={isSelected ? 0.9 : 0.55}
                strokeWidth={isSelected ? 1.4 : 0.8}
                strokeDasharray={link.status === "stable" ? "0" : "3 3"}
              />
            )
          })}
        </svg>

        <div className="absolute inset-x-4 top-4 bottom-24">
          {data.entities.map((entity) => {
            const Icon = kindIcons[entity.kind]
            const isSelected = selectedEntity.id === entity.id

            return (
              <button
                key={entity.id}
                type="button"
                onClick={() => onSelectEntity?.(entity.id)}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border px-3 py-2 text-left transition-colors",
                  isSelected
                    ? "border-primary/70 bg-card shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_35%,transparent)]"
                    : "border-border/70 bg-card/92 hover:border-border"
                )}
                style={{
                  left: `${entity.graph.x}%`,
                  top: `${entity.graph.y}%`,
                  width: "11rem",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-muted">
                    <HugeiconsIcon
                      icon={Icon}
                      strokeWidth={2}
                      className="text-primary"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {entity.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entity.tier}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "ml-auto size-2 rounded-full",
                      statusTone[entity.status]
                    )}
                  />
                </div>
              </button>
            )
          })}
        </div>

        <div className="absolute inset-x-4 bottom-24 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/86 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Selected</p>
            <p className="truncate text-sm font-medium text-foreground">
              {selectedEntity.name}
            </p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Button variant="ghost" size="xs">
              <HugeiconsIcon
                icon={Link01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Trace links
            </Button>
            <Button variant="ghost" size="xs">
              <HugeiconsIcon
                icon={AlertDiamondIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Inspect risk
            </Button>
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-4">
          <PromptBar />
        </div>
      </div>
    </section>
  )
}
