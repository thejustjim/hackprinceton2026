"use client"

import { startTransition, useDeferredValue, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiGenerativeIcon,
  AlertDiamondIcon,
  Analytics02Icon,
  DashboardCircleSettingsIcon,
  Globe02Icon,
  Search02Icon,
} from "@hugeicons/core-free-icons"

import { GlobeView } from "@/components/dashboard/globe-view"
import { GraphView } from "@/components/dashboard/graph-view"
import { MetricChip } from "@/components/dashboard/metric-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { type SupplyChainSnapshot } from "@/lib/mock-supply-chain"

interface DashboardShellProps {
  data: SupplyChainSnapshot
}

export function DashboardShell({ data }: DashboardShellProps) {
  const [selectedEntityId, setSelectedEntityId] = useState(
    data.entities[2]?.id ?? data.entities[0]?.id
  )
  const [commandOpen, setCommandOpen] = useState(false)
  const deferredEntityId = useDeferredValue(selectedEntityId)

  function handleSelectEntity(entityId: string) {
    startTransition(() => {
      setSelectedEntityId(entityId)
    })
  }

  return (
    <main className="dashboard-shell">
      <div className="relative z-10 flex min-h-svh flex-col px-4 py-4 lg:px-6">
        <header className="panel-surface panel-glow mb-4 rounded-[1.6rem] px-4 py-4 lg:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className="rounded-full border border-border/80 bg-card/80 px-2.5 py-1"
                >
                  Supply chain graph
                </Badge>
                <Badge className="rounded-full px-2.5 py-1">
                  {data.updatedAt}
                </Badge>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="truncate text-2xl font-medium tracking-tight text-foreground lg:text-3xl">
                  {data.title}
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Dark-first analyst console for graph and globe exploration.
                  Selection state is shared across both panes.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCommandOpen(true)}
              >
                <HugeiconsIcon
                  icon={Search02Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Command
              </Button>
              <Button variant="outline" size="sm">
                <HugeiconsIcon
                  icon={AiGenerativeIcon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Copilot ready
              </Button>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <HugeiconsIcon
                      icon={DashboardCircleSettingsIcon}
                      strokeWidth={2}
                      data-icon="inline-start"
                    />
                    Brief
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Mission brief</SheetTitle>
                    <SheetDescription>
                      Compact mobile context for the current graph and globe
                      shell.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex flex-col gap-4 px-6 pb-6">
                    {data.metrics.map((metric) => (
                      <MetricChip
                        key={metric.id}
                        label={metric.label}
                        value={metric.value}
                        delta={metric.delta}
                      />
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:hidden">
          <GraphView
            data={data}
            selectedEntityId={deferredEntityId}
            onSelectEntity={handleSelectEntity}
          />
          <GlobeView
            data={data}
            selectedEntityId={deferredEntityId}
            onSelectEntity={handleSelectEntity}
          />
        </section>

        <section className="hidden min-h-0 flex-1 lg:block">
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-h-[calc(100svh-10.5rem)] rounded-[1.75rem]"
          >
            <ResizablePanel defaultSize={62} minSize={45}>
              <GraphView
                data={data}
                className="h-full"
                selectedEntityId={deferredEntityId}
                onSelectEntity={handleSelectEntity}
              />
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="mx-2 rounded-full bg-border/70"
            />
            <ResizablePanel defaultSize={38} minSize={28}>
              <GlobeView
                data={data}
                className="h-full"
                selectedEntityId={deferredEntityId}
                onSelectEntity={handleSelectEntity}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </section>
      </div>

      <CommandDialog
        open={commandOpen}
        onOpenChange={setCommandOpen}
        title="Dashboard Command Palette"
        description="Search controls and canned actions for the supply chain dashboard."
        className="border-border/80 bg-card/95"
      >
        <Command>
          <CommandInput placeholder="Search dashboard actions..." />
          <CommandList>
            <CommandEmpty>No matching actions.</CommandEmpty>
            <CommandGroup heading="Views">
              <CommandItem onSelect={() => setCommandOpen(false)}>
                <HugeiconsIcon icon={Globe02Icon} strokeWidth={2} />
                Focus globe pane
              </CommandItem>
              <CommandItem onSelect={() => setCommandOpen(false)}>
                <HugeiconsIcon icon={Analytics02Icon} strokeWidth={2} />
                Open route ledger
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Alerts">
              {data.alerts.map((alert) => (
                <CommandItem
                  key={alert}
                  onSelect={() => setCommandOpen(false)}
                  className={cn("items-start", "py-3")}
                >
                  <HugeiconsIcon
                    icon={AlertDiamondIcon}
                    strokeWidth={2}
                    className="mt-0.5 text-primary"
                  />
                  <span className="line-clamp-2">{alert}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </main>
  )
}
