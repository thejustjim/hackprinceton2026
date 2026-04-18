"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertDiamondIcon,
  Analytics02Icon,
  Clock01Icon,
  Location02Icon,
  MapPinpoint02Icon,
  MapsGlobal01Icon,
  Route03Icon,
  Satellite01Icon,
  ShareLocation01Icon,
} from "@hugeicons/core-free-icons"

import { MetricChip } from "@/components/dashboard/metric-chip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

const riskTone = {
  stable: "bg-emerald-400",
  watch: "bg-amber-400",
  critical: "bg-rose-400",
} as const

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
        "panel-surface panel-glow min-h-[36rem] rounded-[1.75rem]",
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--dashboard-glow-soft)_28%,transparent),transparent_60%)]" />
      <div className="relative flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="eyebrow">Globe context</span>
            <h2 className="text-xl font-medium tracking-tight">
              Geo-intel overlay
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Routes, regional throughput, and location risk around the
              currently selected manufacturing chain.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="rounded-full border border-border/80 bg-card/80 px-2.5 py-1"
            >
              {selectedLocation?.region ?? "Global"}
            </Badge>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <HugeiconsIcon
                    icon={MapsGlobal01Icon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Legend
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end">
                <PopoverHeader>
                  <PopoverTitle>Overlay legend</PopoverTitle>
                  <PopoverDescription>
                    Stylized shell for v1. Geographic nodes share the same typed
                    data as the graph pane.
                  </PopoverDescription>
                </PopoverHeader>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="size-2 rounded-full bg-primary" />
                    <span>Selected route corridor</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="size-2 rounded-full bg-chart-3" />
                    <span>Stable throughput location</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="size-2 rounded-full bg-chart-4" />
                    <span>Constrained or delayed node</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.metrics.map((metric) => (
            <MetricChip
              key={metric.id}
              label={metric.label}
              value={metric.value}
              delta={metric.delta}
            />
          ))}
        </div>

        <div className="panel-glow relative min-h-[17rem] rounded-[1.5rem] border border-border/80 bg-background/65 p-4">
          <div className="absolute inset-0 rounded-[1.5rem] bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--dashboard-glow)_20%,transparent),transparent_58%)]" />
          <div className="absolute inset-6 rounded-full border border-primary/15" />
          <div className="absolute inset-10 rounded-full border border-primary/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative aspect-square w-full max-w-[18rem] rounded-full border border-border/70 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.09),transparent_32%),radial-gradient(circle_at_50%_50%,rgba(130,84,255,0.18),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] shadow-[inset_0_0_80px_rgba(124,88,255,0.1),0_0_80px_rgba(111,78,255,0.1)]">
              <div className="absolute inset-[14%] rounded-full border border-border/40" />
              <div className="absolute inset-[28%] rounded-full border border-border/30" />
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
                    r="1.8"
                    fill={
                      location.id === selectedLocation?.id
                        ? "var(--primary)"
                        : "color-mix(in oklab, var(--foreground) 60%, transparent)"
                    }
                  />
                ))}
                <path
                  d="M 20 62 C 38 40, 55 26, 74 34"
                  fill="none"
                  stroke="color-mix(in oklab, var(--primary) 75%, white)"
                  strokeWidth="1"
                  strokeDasharray="3 2"
                />
                <path
                  d="M 74 34 C 80 30, 84 30, 80 32"
                  fill="none"
                  stroke="color-mix(in oklab, var(--chart-3) 75%, white)"
                  strokeWidth="1"
                />
                <path
                  d="M 28 31 C 48 28, 70 29, 80 32"
                  fill="none"
                  stroke="color-mix(in oklab, var(--chart-4) 60%, white)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
              </svg>
            </div>
          </div>

          <Card className="absolute top-4 right-4 w-60 border-border/80 bg-card/90 backdrop-blur">
            <CardHeader className="gap-2">
              <span className="eyebrow">Focused region</span>
              <CardTitle className="text-base">
                {selectedLocation?.name}
              </CardTitle>
              <CardDescription>{selectedLocation?.country}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/65 p-3">
                <span className="text-sm text-muted-foreground">
                  Throughput
                </span>
                <span className="text-sm font-medium">
                  {selectedLocation?.throughput}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/65 p-3">
                <span className="text-sm text-muted-foreground">
                  Risk state
                </span>
                <Badge className="rounded-full capitalize">
                  {selectedLocation?.risk}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="routes" className="min-h-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList variant="line">
              <TabsTrigger value="routes">
                <HugeiconsIcon
                  icon={Route03Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Routes
              </TabsTrigger>
              <TabsTrigger value="locations">
                <HugeiconsIcon
                  icon={MapPinpoint02Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Locations
              </TabsTrigger>
              <TabsTrigger value="intel">
                <HugeiconsIcon
                  icon={Satellite01Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Intel
              </TabsTrigger>
            </TabsList>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              <HugeiconsIcon
                icon={ShareLocation01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Shared context
            </Badge>
          </div>

          <TabsContent value="routes" className="min-h-0">
            <Card className="border-border/80 bg-card/70">
              <CardHeader className="gap-2">
                <CardTitle className="text-base">Route ledger</CardTitle>
                <CardDescription>
                  Primary movement lanes mapped from the selected entity
                  outward.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 pr-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lane</TableHead>
                        <TableHead>Lead time</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.links.map((link) => (
                        <TableRow key={link.id}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-foreground">
                                {link.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {link.volume}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{link.leadTimeDays} days</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className="rounded-full capitalize"
                            >
                              {link.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locations" className="min-h-0">
            <Card className="border-border/80 bg-card/70">
              <CardHeader className="gap-2">
                <CardTitle className="text-base">Regional nodes</CardTitle>
                <CardDescription>
                  Quick-switch context cards that can drive both panes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 pr-4">
                  <div className="flex flex-col gap-3">
                    {data.locations.map((location) => (
                      <button
                        key={location.id}
                        type="button"
                        onClick={() => {
                          const entity = data.entities.find(
                            (item) => item.locationId === location.id
                          )

                          if (entity) {
                            onSelectEntity?.(entity.id)
                          }
                        }}
                        className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-3 py-3 text-left transition-colors hover:bg-background/80"
                      >
                        <Avatar size="lg">
                          <AvatarFallback>
                            {location.country.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium text-foreground">
                              {location.name}
                            </p>
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                riskTone[location.risk]
                              )}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {location.region} / {location.country}
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          {location.throughput}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="intel" className="min-h-0">
            <Card className="border-border/80 bg-card/70">
              <CardHeader className="gap-2">
                <CardTitle className="text-base">Analyst notes</CardTitle>
                <CardDescription>
                  Structured context reserved for future live ingest and agent
                  output.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricChip label="Globe layer" value="Trade routes" />
                  <MetricChip
                    label="Watch region"
                    value={selectedLocation?.region ?? "Global"}
                  />
                  <MetricChip label="Window" value={data.updatedAt} />
                </div>
                <Separator />
                <Empty className="rounded-2xl border-border/70 bg-background/60 p-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <HugeiconsIcon icon={AlertDiamondIcon} strokeWidth={2} />
                    </EmptyMedia>
                    <EmptyTitle>No new region-level exceptions</EmptyTitle>
                    <EmptyDescription>
                      GlobeView is ready for live intel cards, sanctions
                      overlays, or shipment anomaly summaries.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent className="max-w-full">
                    <div className="grid w-full gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border/70 bg-card/70 p-4 text-left">
                        <HugeiconsIcon
                          icon={Analytics02Icon}
                          strokeWidth={2}
                          className="mb-3 text-primary"
                        />
                        <p className="font-medium">Traffic model</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Reserve space for lane forecasts and probabilistic
                          rerouting.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/70 p-4 text-left">
                        <HugeiconsIcon
                          icon={Clock01Icon}
                          strokeWidth={2}
                          className="mb-3 text-primary"
                        />
                        <p className="font-medium">Time series</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Add lead-time or congestion playback without changing
                          the shell.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-card/70 p-4 text-left">
                        <HugeiconsIcon
                          icon={Location02Icon}
                          strokeWidth={2}
                          className="mb-3 text-primary"
                        />
                        <p className="font-medium">Geo feeds</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Connect customs, weather, and port feeds into the
                          location model.
                        </p>
                      </div>
                    </div>
                  </EmptyContent>
                </Empty>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
