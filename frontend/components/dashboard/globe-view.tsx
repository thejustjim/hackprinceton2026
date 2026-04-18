"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  MapPinpoint02Icon,
  MapsGlobal01Icon,
  Route03Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  type SupplyChainEntity,
  type SupplyChainSnapshot,
} from "@/lib/mock-supply-chain"

interface GlobeViewProps {
  data: SupplyChainSnapshot
  className?: string
  selectedEntityId?: string
  onSelectEntity?: (entityId: string) => void
}

function getSelectedEntity(
  selectedEntityId: string | undefined,
  entities: SupplyChainEntity[]
) {
  return (
    entities.find((entity) => entity.id === selectedEntityId) ?? entities[0]
  )
}

export function GlobeView({
  data,
  className,
  selectedEntityId,
  onSelectEntity,
}: GlobeViewProps) {
  const selectedEntity = getSelectedEntity(selectedEntityId, data.entities)
  const selectedLocation = data.locations.find(
    (location) => location.id === selectedEntity.locationId
  )

  return (
    <section
      className={cn(
        "panel-surface flex min-h-0 flex-col rounded-2xl",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Globe</h2>
          <p className="text-xs text-muted-foreground">Geographic context</p>
        </div>
        <Button variant="ghost" size="xs">
          <HugeiconsIcon
            icon={MapsGlobal01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Overview
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <div className="relative flex min-h-[22rem] flex-1 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-[radial-gradient(circle_at_center,rgba(122,84,255,0.14),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]">
          <div className="absolute inset-6 rounded-full border border-border/50" />
          <div className="absolute inset-14 rounded-full border border-border/35" />
          <div className="relative aspect-square w-full max-w-[20rem] rounded-full border border-border/60 bg-[radial-gradient(circle_at_50%_45%,rgba(151,118,255,0.2),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01))] shadow-[inset_0_0_60px_rgba(125,85,255,0.08)]">
            <svg
              className="absolute inset-0 size-full"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              {data.locations.map((location) => (
                <circle
                  key={location.id}
                  cx={location.coordinates.x}
                  cy={location.coordinates.y}
                  r={location.id === selectedLocation?.id ? "2.4" : "1.7"}
                  fill={
                    location.id === selectedLocation?.id
                      ? "var(--primary)"
                      : "color-mix(in oklab, var(--foreground) 65%, transparent)"
                  }
                />
              ))}
              <path
                d="M 20 62 C 38 40, 55 26, 74 34"
                fill="none"
                stroke="color-mix(in oklab, var(--primary) 80%, white)"
                strokeWidth="1"
                strokeDasharray="3 2"
              />
              <path
                d="M 28 31 C 48 28, 70 29, 80 32"
                fill="none"
                stroke="color-mix(in oklab, var(--foreground) 34%, transparent)"
                strokeWidth="0.9"
              />
            </svg>
          </div>

          <div className="absolute top-4 left-4 rounded-lg border border-border/70 bg-background/88 px-3 py-2">
            <p className="text-xs text-muted-foreground">Focused location</p>
            <p className="text-sm font-medium text-foreground">
              {selectedLocation?.name}
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          {data.locations.slice(0, 4).map((location) => {
            const entity = data.entities.find(
              (item) => item.locationId === location.id
            )

            return (
              <button
                key={location.id}
                type="button"
                onClick={() => {
                  if (entity) {
                    onSelectEntity?.(entity.id)
                  }
                }}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors",
                  location.id === selectedLocation?.id
                    ? "border-primary/60 bg-card"
                    : "border-border/70 bg-card/88 hover:bg-card"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {location.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {location.country}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="hidden sm:inline">
                    {location.throughput}
                  </span>
                  <span className="flex items-center gap-1">
                    <HugeiconsIcon
                      icon={MapPinpoint02Icon}
                      strokeWidth={2}
                      className="text-primary"
                    />
                    {location.region}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <HugeiconsIcon icon={Route03Icon} strokeWidth={2} />
          Routes are placeholder geometry for now.
        </div>
      </div>
    </section>
  )
}
