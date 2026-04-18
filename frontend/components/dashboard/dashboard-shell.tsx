"use client"

import { startTransition, useDeferredValue, useState } from "react"

import { GlobeView } from "@/components/dashboard/globe-view"
import { GraphView } from "@/components/dashboard/graph-view"
import { Button } from "@/components/ui/button"
import { type SupplyChainSnapshot } from "@/lib/mock-supply-chain"

interface DashboardShellProps {
  data: SupplyChainSnapshot
  onRestartOnboarding?: () => void
}

export function DashboardShell({
  data,
  onRestartOnboarding,
}: DashboardShellProps) {
  const [selectedEntityId, setSelectedEntityId] = useState(
    data.entities[2]?.id ?? data.entities[0]?.id
  )
  const deferredEntityId = useDeferredValue(selectedEntityId)

  function handleSelectEntity(entityId: string) {
    startTransition(() => {
      setSelectedEntityId(entityId)
    })
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
            <div className="text-sm text-muted-foreground">{data.updatedAt}</div>
          </div>
        </header>

        <section className="grid flex-1 gap-4 lg:grid-cols-[1.45fr_minmax(360px,0.9fr)]">
          <GraphView className="min-h-[32rem] lg:min-h-0" />
          <GlobeView
            data={data}
            className="min-h-[32rem] lg:min-h-0"
            selectedEntityId={deferredEntityId}
            onSelectEntity={handleSelectEntity}
          />
        </section>
      </div>
    </main>
  )
}
