"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  MapPinpoint02Icon,
  MapsGlobal01Icon,
  Route03Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { InteractiveGlobe } from "@/components/dashboard/interactive-globe"
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
        <div className="relative flex min-h-[24rem] flex-1 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] md:min-h-[27rem]">
          <div className="absolute inset-6 rounded-full border border-white/12" />
          <div className="absolute inset-14 rounded-full border border-white/10" />
          <InteractiveGlobe
            className="relative z-10"
            entities={data.entities}
            links={data.links}
            locations={data.locations}
            selectedLocationId={selectedLocation?.id}
          />

          <div className="absolute top-4 left-4 rounded-lg border border-white/12 bg-background/84 px-3 py-2 backdrop-blur-sm">
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
          Drag to rotate. Continents, countries, and routes trace the visible
          hemisphere.
        </div>
      </div>
    </section>
  )
}
