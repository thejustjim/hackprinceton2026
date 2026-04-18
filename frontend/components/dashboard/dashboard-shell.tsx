"use client"

import { startTransition, useDeferredValue, useState } from "react"
import Link from "next/link"

import { GlobeView } from "@/components/dashboard/globe-view"
import { GraphView } from "@/components/dashboard/graph-view"
import { GreenChainLogo } from "@/components/green-chain-logo"
import { type SupplyChainSnapshot } from "@/lib/mock-supply-chain"

interface DashboardShellProps {
  data: SupplyChainSnapshot
}

export function DashboardShell({ data }: DashboardShellProps) {
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
        <header className="flex flex-col gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
            <Link
              href="/"
              className="inline-flex shrink-0 self-start transition-opacity hover:opacity-90"
            >
              <GreenChainLogo className="h-7 w-auto sm:h-8 md:h-9" />
            </Link>
            <p className="text-sm text-muted-foreground sm:max-w-md sm:border-l sm:border-border/70 sm:pl-5">
              Interactive supply chain graph · geographic intelligence
            </p>
          </div>
          <div className="shrink-0 text-sm text-muted-foreground">
            {data.updatedAt}
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
