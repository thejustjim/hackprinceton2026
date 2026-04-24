"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { GreenChainLogo } from "@/components/green-chain-logo"
import {
  DashboardLaunchButton,
} from "@/components/landing/hero-section"
import { cn } from "@/lib/utils"

export function ChromeNav({
  isLaunching,
  onLaunchDashboard,
}: {
  isLaunching: boolean
  onLaunchDashboard: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [past, setPast] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    let frame = 0

    const update = () => {
      const y = window.scrollY
      const threshold = window.innerHeight * 0.6
      const isPast = y > threshold
      setPast(isPast)

      if (!isPast) {
        setVisible(false)
      } else {
        setVisible(y < lastY)
      }
      lastY = y
    }

    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
    }
  }, [])

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        past ? "pointer-events-auto" : "pointer-events-none",
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      )}
    >
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 border-b border-white/8 bg-black/50 px-6 py-3 backdrop-blur-xl md:px-10">
        <Link href="/" className="inline-flex items-center">
          <GreenChainLogo variant="onDark" className="h-7 w-auto" />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="#product"
            className="text-sm text-white/58 transition-colors hover:text-white"
          >
            How it works
          </Link>
          <Link
            href="#features"
            className="text-sm text-white/58 transition-colors hover:text-white"
          >
            Features
          </Link>
          <Link
            href="#about"
            className="text-sm text-white/58 transition-colors hover:text-white"
          >
            About
          </Link>
          <DashboardLaunchButton
            onLaunch={onLaunchDashboard}
            disabled={isLaunching}
            className="landing-button landing-button--ghost inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-5 py-2 text-sm text-white backdrop-blur-xl hover:border-white/28 hover:bg-white/14"
          >
            Launch Platform
            <span aria-hidden>→</span>
          </DashboardLaunchButton>
        </nav>
      </div>
    </div>
  )
}
