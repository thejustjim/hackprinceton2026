"use client"

import { cn } from "@/lib/utils"
import { SupplyChainGraph } from "@/components/dashboard/supply-chain-graph"

interface GraphViewProps {
  className?: string
}

export function GraphView({ className }: GraphViewProps) {
  return (
    <section
      className={cn(
        "panel-surface flex min-h-0 flex-col rounded-2xl overflow-hidden",
        className
      )}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 flex-shrink-0">
        <div className="min-w-0 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-indigo-400/70 shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
          <div>
            <h2 className="text-sm font-medium text-white/85">Supply Chain Graph</h2>
            <p className="text-[11px] text-white/30">Lint Roller · 10,000 units</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-1 rounded-md text-[10px] font-medium bg-emerald-400/[0.08] text-emerald-300/70 border border-emerald-400/[0.15]">
            Live
          </span>
          <span className="px-2 py-1 rounded-md text-[10px] font-medium bg-white/[0.04] text-white/30 border border-white/[0.07]">
            10 nodes · 9 edges
          </span>
        </div>
      </div>

      {/* Graph canvas — fills all remaining height */}
      <div className="flex-1 min-h-0 relative">
        <SupplyChainGraph />
      </div>
    </section>
  )
}
