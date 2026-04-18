"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertDiamondIcon,
  DatabaseIcon,
  Factory01Icon,
  Globe02Icon,
  Layers01Icon,
  Link01Icon,
  PackageMoving01Icon,
  Route03Icon,
  Search02Icon,
  Settings02Icon,
  Target03Icon,
} from "@hugeicons/core-free-icons"

import { PromptBar } from "@/components/dashboard/prompt-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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

const statusStyles = {
  stable: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  watch: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  critical: "border-rose-400/30 bg-rose-400/10 text-rose-100",
} as const

function getEntity(
  entityId: string | undefined,
  entities: SupplyChainEntity[]
) {
  return entities.find((entity) => entity.id === entityId) ?? entities[0]
}

export function GraphView({
  data,
  className,
  selectedEntityId,
  onSelectEntity,
}: GraphViewProps) {
  const selectedEntity = getEntity(selectedEntityId, data.entities)
  const selectedLinks = data.links.filter(
    (link) =>
      link.sourceId === selectedEntity.id || link.targetId === selectedEntity.id
  )

  return (
    <section
      className={cn(
        "panel-surface panel-grid panel-glow min-h-[36rem] rounded-[1.75rem]",
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--dashboard-glow)_32%,transparent),transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.16)_72%,rgba(0,0,0,0.42))]" />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="rounded-full border border-border/80 bg-card/80 px-2.5 py-1"
              >
                Live graph
              </Badge>
              <Badge className="rounded-full px-2.5 py-1">Palantir mode</Badge>
            </div>
            <div className="panel-glow flex flex-wrap items-center gap-2 rounded-[1.35rem] border border-border/80 bg-card/75 p-2">
              <Select defaultValue="obsidian-core">
                <SelectTrigger className="min-w-44 bg-background/60">
                  <SelectValue placeholder="Select preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Mission presets</SelectLabel>
                    <SelectItem value="obsidian-core">Obsidian Core</SelectItem>
                    <SelectItem value="risk-trace">Risk Trace</SelectItem>
                    <SelectItem value="supplier-heat">
                      Supplier Heatmap
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <ToggleGroup
                type="single"
                defaultValue="graph"
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="graph">
                  <HugeiconsIcon
                    icon={Target03Icon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Graph
                </ToggleGroupItem>
                <ToggleGroupItem value="lanes">
                  <HugeiconsIcon
                    icon={Route03Icon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Lanes
                </ToggleGroupItem>
                <ToggleGroupItem value="risk">
                  <HugeiconsIcon
                    icon={AlertDiamondIcon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Risk
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Search graph"
                >
                  <HugeiconsIcon icon={Search02Icon} strokeWidth={2} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Search entities</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <HugeiconsIcon
                    icon={Layers01Icon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Layers
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Overlay layers</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuCheckboxItem checked>
                    Tier visibility
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked>
                    Delay pulse
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked>
                    Route confidence
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem>
                    Regulatory watchlist
                  </DropdownMenuCheckboxItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Configure view"
                >
                  <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Configure graph surface
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="relative flex-1 px-5 pt-4 pb-5">
          <svg
            className="absolute inset-x-5 top-4 bottom-36 h-[calc(100%-11rem)] w-[calc(100%-2.5rem)]"
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
                selectedEntity.id === source.id ||
                selectedEntity.id === target.id

              return (
                <g key={link.id}>
                  <path
                    d={`M ${source.graph.x} ${source.graph.y} C ${(source.graph.x + target.graph.x) / 2} ${source.graph.y - 12} ${(source.graph.x + target.graph.x) / 2} ${target.graph.y + 12} ${target.graph.x} ${target.graph.y}`}
                    fill="none"
                    stroke={
                      isSelected
                        ? "color-mix(in oklab, var(--primary) 88%, white)"
                        : "color-mix(in oklab, var(--foreground) 16%, transparent)"
                    }
                    strokeOpacity={isSelected ? 0.9 : 0.5}
                    strokeWidth={isSelected ? 1.5 : 0.8}
                    strokeDasharray={link.status === "stable" ? "0" : "3 3"}
                  />
                  <circle
                    cx={(source.graph.x + target.graph.x) / 2}
                    cy={(source.graph.y + target.graph.y) / 2}
                    r="0.9"
                    fill={
                      isSelected ? "var(--primary)" : "var(--muted-foreground)"
                    }
                  />
                </g>
              )
            })}
          </svg>

          <div className="absolute inset-x-5 top-4 bottom-36">
            {data.entities.map((entity) => {
              const entityIcon = kindIcons[entity.kind]
              const isSelected = selectedEntity.id === entity.id

              return (
                <div
                  key={entity.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${entity.graph.x}%`,
                    top: `${entity.graph.y}%`,
                  }}
                >
                  <HoverCard openDelay={120}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSelectEntity?.(entity.id)}
                        className={cn(
                          "panel-glow flex w-44 flex-col gap-2 rounded-2xl border bg-card/90 px-3 py-3 text-left backdrop-blur transition-transform hover:-translate-y-0.5",
                          isSelected
                            ? "border-primary/70 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_50%,transparent)]"
                            : "border-border/70"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex size-8 items-center justify-center rounded-xl border border-border/70 bg-background/70">
                            <HugeiconsIcon
                              icon={entityIcon}
                              strokeWidth={2}
                              className="text-primary"
                            />
                          </span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "rounded-full border px-2 py-0.5",
                              statusStyles[entity.status]
                            )}
                          >
                            {entity.status}
                          </Badge>
                        </div>
                        <div className="flex min-w-0 flex-col gap-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {entity.name}
                          </p>
                          <p className="text-xs tracking-[0.24em] text-muted-foreground uppercase">
                            {entity.tier}
                          </p>
                        </div>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80 border border-border/80 bg-card/95 p-0">
                      <Card className="border-0 bg-transparent shadow-none">
                        <CardHeader className="gap-3">
                          <div className="flex items-center justify-between gap-3">
                            <CardTitle>{entity.name}</CardTitle>
                            <Badge className="rounded-full">
                              {entity.throughput}
                            </Badge>
                          </div>
                          <CardDescription>{entity.summary}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                              <span className="eyebrow">Confidence</span>
                              <p className="mt-2 text-lg font-medium">
                                {entity.confidence}%
                              </p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                              <span className="eyebrow">Location</span>
                              <p className="mt-2 text-sm text-foreground">
                                {
                                  data.locations.find(
                                    (location) =>
                                      location.id === entity.locationId
                                  )?.name
                                }
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {entity.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="rounded-full"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              )
            })}
          </div>

          <div className="absolute right-5 bottom-36 left-5">
            <Card className="panel-glow border-border/80 bg-background/70">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="eyebrow">Selected node</span>
                  <CardTitle className="truncate text-base">
                    {selectedEntity.name}
                  </CardTitle>
                  <CardDescription>{selectedEntity.summary}</CardDescription>
                </div>
                <Badge className="rounded-full px-3 py-1">
                  {selectedEntity.throughput}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-[1.2fr_auto_1fr]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                    <span className="eyebrow">Confidence</span>
                    <p className="mt-2 text-lg font-medium">
                      {selectedEntity.confidence}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                    <span className="eyebrow">Neighbors</span>
                    <p className="mt-2 text-lg font-medium">
                      {selectedLinks.length}
                    </p>
                  </div>
                </div>
                <Separator
                  orientation="vertical"
                  className="hidden h-auto md:block"
                />
                <div className="flex flex-wrap gap-2">
                  {selectedLinks.map((link) => (
                    <Badge
                      key={link.id}
                      variant="outline"
                      className="rounded-full px-2.5 py-1"
                    >
                      <HugeiconsIcon
                        icon={Link01Icon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      {link.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="absolute right-5 bottom-5 left-5">
            <PromptBar />
          </div>
        </div>
      </div>
    </section>
  )
}
