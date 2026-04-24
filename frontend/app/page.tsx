"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { CTAFooter } from "@/components/landing/cta-footer"
import { FeaturesSection } from "@/components/landing/features-section"
import { HeroSection } from "@/components/landing/hero-section"
import { DashboardLaunchOverlay } from "@/components/launch/dashboard-launch-overlay"
import { usePrefersReducedMotionSnapshot } from "@/hooks/use-prefers-reduced-motion"

export default function LandingPage() {
  const router = useRouter()
  const prefersReducedMotion = usePrefersReducedMotionSnapshot()
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchOverlayRunId, setLaunchOverlayRunId] = useState(0)

  useEffect(() => {
    router.prefetch("/launch")
  }, [router])

  useEffect(() => {
    if (!isLaunching) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isLaunching])

  const handleLaunchDashboard = useCallback(() => {
    if (isLaunching) return
    setLaunchOverlayRunId((id) => id + 1)
    setIsLaunching(true)
  }, [isLaunching])

  const handleLaunchOverlayComplete = useCallback(() => {
    router.push("/launch")
  }, [router])

  return (
    <main className="landing-page min-h-svh overflow-x-hidden text-foreground">
      <DashboardLaunchOverlay
        active={isLaunching}
        key={launchOverlayRunId}
        onComplete={handleLaunchOverlayComplete}
        reducedMotion={prefersReducedMotion}
      />
      <HeroSection
        introReady
        isLaunching={isLaunching}
        onLaunchDashboard={handleLaunchDashboard}
      />
      <FeaturesSection
        isLaunching={isLaunching}
        onLaunchDashboard={handleLaunchDashboard}
      />
      <CTAFooter
        isLaunching={isLaunching}
        onLaunchDashboard={handleLaunchDashboard}
      />
    </main>
  )
}
