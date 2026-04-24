"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { CTAFooter } from "@/components/landing/cta-footer"
import { FeaturesSection } from "@/components/landing/features-section"
import { HeroSection } from "@/components/landing/hero-section"
import {
  IntroSequence,
  hasSeenIntro,
} from "@/components/landing/intro-sequence"
import { ProductPreviewSection } from "@/components/landing/product-preview-section"
import { DashboardLaunchOverlay } from "@/components/launch/dashboard-launch-overlay"
import { useLenis } from "@/hooks/use-lenis"
import { usePrefersReducedMotionSnapshot } from "@/hooks/use-prefers-reduced-motion"

export default function LandingPage() {
  const router = useRouter()
  const prefersReducedMotion = usePrefersReducedMotionSnapshot()
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchOverlayRunId, setLaunchOverlayRunId] = useState(0)
  const [introReady, setIntroReady] = useState(false)
  const [showIntro, setShowIntro] = useState(false)

  useLenis({ disabled: prefersReducedMotion || isLaunching || !introReady })

  useEffect(() => {
    router.prefetch("/launch")
  }, [router])

  useEffect(() => {
    if (hasSeenIntro()) {
      setIntroReady(true)
      return
    }
    setShowIntro(true)
  }, [])

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false)
    setIntroReady(true)
  }, [])

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
      {showIntro && <IntroSequence onComplete={handleIntroComplete} />}
      <DashboardLaunchOverlay
        active={isLaunching}
        key={launchOverlayRunId}
        onComplete={handleLaunchOverlayComplete}
        reducedMotion={prefersReducedMotion}
      />
      <HeroSection
        introReady={introReady}
        isLaunching={isLaunching}
        onLaunchDashboard={handleLaunchDashboard}
      />
      <ProductPreviewSection />
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
