"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { MapsGlobal01Icon, Route03Icon } from "@hugeicons/core-free-icons"

import { InteractiveGlobe } from "@/components/dashboard/interactive-globe"
import { Button } from "@/components/ui/button"
import { getEcoDotStyles, getEcoSelectionStyles } from "@/lib/eco-visuals"
import {
  type SupplyScenario,
  type SupplyScenarioComponentNode,
  type SupplyScenarioManufacturerNode,
  type SupplyScenarioSelectableNodeId,
} from "@/lib/supply-chain-scenario"
import { cn } from "@/lib/utils"

interface GlobeViewProps {
  bestEcoManufacturerByComponent: Record<string, string>
  className?: string
  hoveredNodeId: SupplyScenarioSelectableNodeId | null
  onHoverNode: (nodeId: SupplyScenarioSelectableNodeId | null) => void
  onSelectNode: (nodeId: SupplyScenarioSelectableNodeId | null) => void
  pinnedManufacturerByComponent: Record<string, string>
  scenario: SupplyScenario
  selectedNodeId: SupplyScenarioSelectableNodeId | null
}

const CORNER_STAR_DOTS = [
  { left: "6%", opacity: 0.5, size: 1.4, top: "10%" },
  { left: "11%", opacity: 0.76, size: 2.1, top: "15%" },
  { left: "17%", opacity: 0.44, size: 1.2, top: "8%" },
  { left: "82%", opacity: 0.42, size: 1.2, top: "9%" },
  { left: "88%", opacity: 0.74, size: 2, top: "14%" },
  { left: "93%", opacity: 0.52, size: 1.4, top: "11%" },
  { left: "8%", opacity: 0.4, size: 1.1, top: "84%" },
  { left: "14%", opacity: 0.68, size: 1.8, top: "89%" },
  { left: "19%", opacity: 0.34, size: 1, top: "80%" },
  { left: "80%", opacity: 0.3, size: 1, top: "86%" },
  { left: "87%", opacity: 0.64, size: 1.8, top: "91%" },
  { left: "92%", opacity: 0.46, size: 1.2, top: "83%" },
] as const

function getManufacturerForComponent(
  scenario: SupplyScenario,
  component: SupplyScenarioComponentNode
) {
  return component.manufacturerIds
    .map((manufacturerId) =>
      scenario.manufacturers.find(
        (manufacturer) => manufacturer.id === manufacturerId
      )
    )
    .filter((manufacturer): manufacturer is SupplyScenarioManufacturerNode =>
      Boolean(manufacturer)
    )
}

function getLinkedComponentId(
  scenario: SupplyScenario,
  nodeId: SupplyScenarioSelectableNodeId | null
) {
  if (!nodeId) {
    return null
  }

  const component = scenario.components.find((item) => item.id === nodeId)

  if (component) {
    return component.id
  }

  const manufacturer = scenario.manufacturers.find((item) => item.id === nodeId)

  return manufacturer?.componentId ?? null
}

function getManufacturerStatusStyles(isCurrent: boolean) {
  return isCurrent
    ? {
        badgeClassName:
          "border border-amber-300/24 bg-amber-300/10 text-amber-200",
      }
    : {
        badgeClassName:
          "border border-slate-400/22 bg-slate-400/[0.08] text-slate-300/90",
      }
}

function ManufacturerRow({
  isFocused,
  isMostSustainable,
  isPinned,
  manufacturer,
  onHoverNode,
  onSelectNode,
}: {
  isFocused: boolean
  isMostSustainable: boolean
  isPinned: boolean
  manufacturer: SupplyScenarioManufacturerNode
  onHoverNode: (nodeId: SupplyScenarioSelectableNodeId | null) => void
  onSelectNode: (nodeId: SupplyScenarioSelectableNodeId | null) => void
}) {
  const statusStyles = getManufacturerStatusStyles(manufacturer.isCurrent)
  const ecoDotStyles = getEcoDotStyles(manufacturer.ecoScore)
  const ecoSelectionStyles = getEcoSelectionStyles(manufacturer.ecoScore)

  return (
    <button
      type="button"
      onClick={() => onSelectNode(manufacturer.id)}
      onMouseEnter={() => onHoverNode(manufacturer.id)}
      onMouseLeave={() => onHoverNode(null)}
      className={cn(
        "group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
        isFocused
          ? ""
          : isPinned
            ? ""
            : manufacturer.isCurrent
              ? "bg-transparent hover:bg-white/[0.04]"
              : "bg-transparent hover:bg-white/[0.03]"
      )}
      style={{
        background: isFocused
          ? ecoSelectionStyles.surfaceStrong
          : isPinned
            ? ecoSelectionStyles.surface
            : undefined,
        boxShadow:
          isFocused || isPinned
            ? `inset 2px 0 0 ${ecoSelectionStyles.edge}${isFocused ? `, ${ecoSelectionStyles.glow}` : ""}`
            : "none",
      }}
    >
      <span
        className="h-2 w-2 flex-shrink-0 rounded-full"
        style={{
          background: ecoDotStyles.background,
          boxShadow: ecoDotStyles.shadow,
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white/84">
          {manufacturer.name}
        </p>
        <p className="text-[11px] text-white/38">
          {manufacturer.location.city}, {manufacturer.location.country}
        </p>
      </div>
      <span
        className={cn(
          "rounded-full px-2 py-1 text-[10px] font-medium",
          statusStyles.badgeClassName
        )}
      >
        {manufacturer.isCurrent ? "Current" : "Alternate"}
      </span>
      {isMostSustainable ? (
        <span
          className="hidden rounded-full border px-2 py-1 text-[10px] font-medium md:inline-flex"
          style={{
            background: ecoSelectionStyles.surface,
            borderColor: ecoSelectionStyles.edge,
            color: ecoSelectionStyles.accent,
          }}
        >
          Most sustainable
        </span>
      ) : null}
      {isPinned ? (
        <span
          className="hidden rounded-full border px-2 py-1 text-[10px] font-medium md:inline-flex"
          style={{
            background: ecoSelectionStyles.surface,
            borderColor: ecoSelectionStyles.edge,
            color: ecoSelectionStyles.accent,
          }}
        >
          Selected
        </span>
      ) : null}
      <span className="hidden font-mono text-[10px] tracking-[0.14em] text-white/32 uppercase sm:block">
        {manufacturer.location.countryCode}
      </span>
    </button>
  )
}

export function GlobeView({
  bestEcoManufacturerByComponent,
  className,
  hoveredNodeId,
  onHoverNode,
  onSelectNode,
  pinnedManufacturerByComponent,
  scenario,
  selectedNodeId,
}: GlobeViewProps) {
  const selectedComponentId = getLinkedComponentId(scenario, selectedNodeId)
  const hoveredComponentId = getLinkedComponentId(scenario, hoveredNodeId)

  return (
    <section
      className={cn(
        "panel-surface flex min-h-0 flex-col overflow-hidden rounded-2xl",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              background: "color-mix(in oklab, var(--primary) 76%, white 8%)",
              boxShadow:
                "0 0 9px color-mix(in oklab, var(--primary) 44%, transparent)",
            }}
          />
          <div>
            <h2 className="text-sm font-medium text-white/85">
              Geographic Routes
            </h2>
            <p className="text-[11px] text-white/30">
              {scenario.destination.label},{" "}
              {scenario.destination.location.country}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="dashboard-chip-accent">
            {scenario.stats.siteCount} sites
          </span>
          <Button
            variant="ghost"
            size="xs"
            className="dashboard-control-surface text-white/70 hover:bg-white/[0.05] hover:text-white"
            onClick={() => {
              onHoverNode(null)
              onSelectNode(null)
            }}
          >
            <HugeiconsIcon
              icon={MapsGlobal01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Overview
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <div
          className="relative flex min-h-[27rem] flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] md:min-h-[31rem]"
          style={{
            background:
              "radial-gradient(circle at 50% 46%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 34%), radial-gradient(circle at 48% 52%, color-mix(in oklab, var(--foreground) 6%, transparent), transparent 52%), linear-gradient(180deg, rgba(6,10,14,0.98), rgba(4,7,10,1))",
          }}
        >
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 8% 12%, rgba(255,255,255,0.02), transparent 18%), radial-gradient(circle at 91% 13%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 16%), radial-gradient(circle at 10% 88%, rgba(255,255,255,0.014), transparent 16%), radial-gradient(circle at 89% 87%, color-mix(in oklab, var(--foreground) 8%, transparent), transparent 16%)",
              }}
            />
            {CORNER_STAR_DOTS.map((star, index) => (
              <span
                key={`${star.left}-${star.top}-${index}`}
                className="absolute rounded-full bg-white"
                style={{
                  boxShadow: `0 0 ${star.size * 5}px rgba(255,255,255,${Math.min(
                    star.opacity * 0.35,
                    0.24
                  )})`,
                  height: star.size,
                  left: star.left,
                  opacity: star.opacity,
                  top: star.top,
                  width: star.size,
                }}
              />
            ))}
          </div>
          <div className="absolute inset-5 rounded-full border border-white/[0.09]" />
          <div className="absolute inset-14 rounded-full border border-white/[0.06]" />

          <InteractiveGlobe
            bestEcoManufacturerByComponent={bestEcoManufacturerByComponent}
            className="relative z-10"
            hoveredNodeId={hoveredNodeId}
            onHoverNode={onHoverNode}
            onSelectNode={onSelectNode}
            pinnedManufacturerByComponent={pinnedManufacturerByComponent}
            scenario={scenario}
            selectedNodeId={selectedNodeId}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-white/42">
            <HugeiconsIcon icon={Route03Icon} strokeWidth={2} />
            Select a route or site to inspect the detail drawer in Supply Chain
            Graph.
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-white/74 sm:inline-flex">
              Route color = eco score
            </span>
            <span className="dashboard-chip-muted hidden sm:inline-flex">
              {scenario.stats.currentRouteCount} current routes
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="dashboard-section-label">Route Selector</p>
              <p className="mt-1 text-[11px] text-white/34">
                Only the active selected route for each component is drawn on
                the globe. Arc captions stay component-first and follow that
                active route. Current = default active route. Alternate =
                modeled fallback. Click a manufacturer to switch the visible
                route for its component.
              </p>
            </div>
            <span className="dashboard-chip-muted">Details in graph</span>
          </div>

          <div className="grid gap-2.5">
            {scenario.components.map((component) => {
              const manufacturers = getManufacturerForComponent(
                scenario,
                component
              )
              const currentManufacturer =
                manufacturers.find((manufacturer) => manufacturer.isCurrent) ??
                manufacturers[0]
              const activeManufacturer =
                manufacturers.find(
                  (manufacturer) =>
                    pinnedManufacturerByComponent[component.id] ===
                    manufacturer.id
                ) ?? currentManufacturer
              const componentDotStyles = activeManufacturer
                ? getEcoDotStyles(activeManufacturer.ecoScore)
                : null
              const componentSelectionStyles = activeManufacturer
                ? getEcoSelectionStyles(activeManufacturer.ecoScore)
                : null
              const isFocusedComponent =
                selectedComponentId === component.id ||
                hoveredComponentId === component.id
              const currentCount = manufacturers.filter(
                (manufacturer) => manufacturer.isCurrent
              ).length

              return (
                <div
                  key={component.id}
                  className={cn(
                    "rounded-xl border transition-colors",
                    isFocusedComponent
                      ? "border-white/[0.12]"
                      : "border-white/[0.07] hover:border-white/[0.09]"
                  )}
                  style={{
                    background: isFocusedComponent
                      ? `linear-gradient(180deg, ${componentSelectionStyles?.surfaceStrong ?? "rgba(255,255,255,0.06)"}, rgba(7,12,16,0.76))`
                      : "rgba(7,12,16,0.58)",
                    boxShadow: isFocusedComponent
                      ? `0 0 0 1px ${componentSelectionStyles?.edge ?? "rgba(255,255,255,0.12)"}, inset 0 1px 0 rgba(255,255,255,0.04), ${componentSelectionStyles?.glow ?? "none"}`
                      : "inset 0 1px 0 rgba(255,255,255,0.03)",
                  }}
                  onMouseEnter={() => onHoverNode(component.id)}
                  onMouseLeave={() => onHoverNode(null)}
                >
                  <button
                    type="button"
                    onClick={() => onSelectNode(component.id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background:
                              componentDotStyles?.background ??
                              "color-mix(in oklab, var(--primary) 82%, white 8%)",
                            boxShadow:
                              componentDotStyles?.shadow ??
                              "0 0 10px color-mix(in oklab, var(--primary) 26%, transparent)",
                          }}
                        />
                        <p className="truncate text-sm font-medium text-white/88">
                          {component.label}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-white/38">
                        {currentCount} current ·{" "}
                        {manufacturers.length - currentCount} alternate ·{" "}
                        {scenario.destination.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="dashboard-chip-muted">
                        {manufacturers.length} sites
                      </span>
                    </div>
                  </button>

                  <div className="px-3 pb-3">
                    <div className="overflow-hidden rounded-xl border border-white/[0.05] bg-[rgba(6,6,12,0.44)]">
                      {manufacturers.map((manufacturer, index) => {
                        const isFocusedManufacturer =
                          selectedNodeId === manufacturer.id ||
                          hoveredNodeId === manufacturer.id
                        const isPinnedManufacturer =
                          pinnedManufacturerByComponent[component.id] ===
                          manufacturer.id
                        const isMostSustainableManufacturer =
                          bestEcoManufacturerByComponent[component.id] ===
                          manufacturer.id

                        return (
                          <div
                            key={manufacturer.id}
                            className={cn(
                              index > 0 ? "border-t border-white/[0.05]" : ""
                            )}
                          >
                            <ManufacturerRow
                              isFocused={isFocusedManufacturer}
                              isMostSustainable={isMostSustainableManufacturer}
                              isPinned={isPinnedManufacturer}
                              manufacturer={manufacturer}
                              onHoverNode={(nodeId) =>
                                nodeId
                                  ? onHoverNode(nodeId)
                                  : onHoverNode(component.id)
                              }
                              onSelectNode={onSelectNode}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
