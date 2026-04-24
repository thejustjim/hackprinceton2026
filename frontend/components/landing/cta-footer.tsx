"use client"

import {
  DashboardLaunchButton,
} from "@/components/landing/hero-section"

export function CTAFooter({
  isLaunching,
  onLaunchDashboard,
}: {
  isLaunching: boolean
  onLaunchDashboard: () => void
}) {
  return (
    <footer id="about" className="px-6 pt-4 pb-12 md:px-10">
      <div className="mx-auto flex max-w-screen-xl flex-col gap-8 border-t border-white/8 pt-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm tracking-[0.3em] text-white/42 uppercase">
            GreenChain
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/54">
            Compare sourcing options across manufacturers, countries, and
            transport modes through an environmental lens.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/52">
          {[
            ["/launch", "Launch"],
            ["#platform", "Platform"],
            ["#capabilities", "Capabilities"],
            ["#about", "About"],
          ].map(([href, label]) =>
            href === "/launch" ? (
              <DashboardLaunchButton
                key={href}
                onLaunch={onLaunchDashboard}
                disabled={isLaunching}
                className="transition-colors hover:text-white"
              >
                {label}
              </DashboardLaunchButton>
            ) : (
              <a
                key={href}
                href={href}
                className="transition-colors hover:text-white"
              >
                {label}
              </a>
            )
          )}
        </nav>
      </div>
    </footer>
  )
}
