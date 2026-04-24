"use client"

import Link from "next/link"

import { GreenChainLogo } from "@/components/green-chain-logo"
import {
  DashboardLaunchButton,
} from "@/components/landing/hero-section"
import { Reveal } from "@/components/landing/reveal"

const DATA_SOURCES = ["EPA USEEIO", "Ember", "GLEC", "ND-GAIN", "CDP"]

export function CTAFooter({
  isLaunching,
  onLaunchDashboard,
}: {
  isLaunching: boolean
  onLaunchDashboard: () => void
}) {
  return (
    <>
      <section
        id="cta"
        className="relative overflow-hidden border-t border-white/8 px-6 py-32 md:px-10 md:py-40"
      >
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_40%,_rgba(29,158,117,0.16),_transparent_55%),radial-gradient(circle_at_50%_85%,_rgba(14,23,24,0)_0%,_rgba(2,7,10,0.85)_100%)]"
        />
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm tracking-[0.4em] text-white/42 uppercase">
            Ready to try it?
          </p>
          <h2 className="landing-display mt-5 text-5xl leading-[0.95] tracking-[-0.05em] text-white md:text-7xl">
            See your first comparison in under a minute.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-white/62 md:text-lg">
            The demo loads a pre-seeded 20-node graph over 16 routes. Flip the
            transport mode and watch the rankings re-settle client-side.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <DashboardLaunchButton
              onLaunch={onLaunchDashboard}
              disabled={isLaunching}
              className="landing-button landing-button--solid inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-medium text-[#04110a] hover:-translate-y-0.5"
            >
              Open Platform
              <span aria-hidden>→</span>
            </DashboardLaunchButton>
          </div>
        </Reveal>
      </section>

      <footer id="about" className="px-6 pt-4 pb-12 md:px-10">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-8 border-t border-white/8 pt-8 md:flex-row md:items-start md:justify-between">
          <div>
            <GreenChainLogo variant="onDark" className="h-8 w-auto" />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/54">
              Compare sourcing options across manufacturers, countries, and
              transport modes through an environmental lens.
            </p>
            <div className="mt-5">
              <p className="text-[10px] tracking-[0.3em] text-white/32 uppercase">
                Built on
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/48">
                {DATA_SOURCES.join(" · ")}
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/52">
            <DashboardLaunchButton
              onLaunch={onLaunchDashboard}
              disabled={isLaunching}
              className="transition-colors hover:text-white"
            >
              Launch
            </DashboardLaunchButton>
            <Link
              href="#features"
              className="transition-colors hover:text-white"
            >
              Features
            </Link>
            <Link
              href="#product"
              className="transition-colors hover:text-white"
            >
              How it works
            </Link>
            <Link
              href="#about"
              className="transition-colors hover:text-white"
            >
              About
            </Link>
          </nav>
        </div>
      </footer>
    </>
  )
}
