"use client"

import { startTransition, useState } from "react"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { sampleSupplyScenario } from "@/lib/supply-chain-scenario"

export function OnboardingFlow() {
  const [isComplete, setIsComplete] = useState(false)

  function startDashboard() {
    startTransition(() => {
      setIsComplete(true)
    })
  }

  function restartOnboarding() {
    startTransition(() => {
      setIsComplete(false)
    })
  }

  if (isComplete) {
    return (
      <DashboardShell
        onRestartOnboarding={restartOnboarding}
        scenario={sampleSupplyScenario}
      />
    )
  }

  return (
    <main className="dashboard-shell">
      <div className="mx-auto flex min-h-svh w-full max-w-5xl items-center justify-center px-6 py-12">
        <section className="panel-surface w-full rounded-[2rem] border border-white/8 px-8 py-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[0.7rem] tracking-[0.28em] text-white/40 uppercase">
              GreenChain Demo Intake
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              Build the story before the dashboard opens.
            </h1>
            <p className="mt-4 text-base leading-7 text-white/60">
              A lightweight onboarding entry point that hands off to the current
              scenario-based dashboard. The live dashboard behavior remains the
              source of truth.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                type="button"
                size="lg"
                onClick={startDashboard}
                className="rounded-full px-6"
              >
                Open dashboard
              </Button>
              <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/45">
                {sampleSupplyScenario.title}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
