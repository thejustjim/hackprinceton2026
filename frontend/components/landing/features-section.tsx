"use client"

import {
  DashboardLaunchButton,
  Eyebrow,
} from "@/components/landing/hero-section"
import { ParallaxMedia } from "@/components/landing/parallax-media"
import { Reveal } from "@/components/landing/reveal"
import { TiltCard } from "@/components/landing/tilt-card"
import { FEATURES, type Feature } from "@/components/landing/landing-constants"

function FeatureCard({
  feature,
  delay = 0,
}: {
  feature: Feature
  delay?: number
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <TiltCard className="landing-panel h-full overflow-hidden rounded-[1.8rem]">
        <div className="relative h-64 overflow-hidden border-b border-white/10 md:h-72">
          <ParallaxMedia
            src={feature.img}
            alt={feature.title}
            speed={0.08}
            sizes="(min-width: 1024px) 44vw, 100vw"
            className="h-full"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(4,9,13,0)_0%,_rgba(4,9,13,0.08)_38%,_rgba(4,9,13,0.72)_100%)]" />
        </div>

        <div className="p-6 md:p-7">
          <Eyebrow className="text-primary/78">{feature.label}</Eyebrow>
          <h3 className="landing-display mt-4 text-3xl leading-[0.98] tracking-[-0.045em] text-white">
            {feature.title}
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-white/62 md:text-base">
            {feature.body}
          </p>

          <div className="mt-6 grid gap-2">
            {feature.bullets.map((item) => (
              <div key={item} className="flex gap-3 text-sm text-white/60">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </TiltCard>
    </Reveal>
  )
}

export function FeaturesSection({
  isLaunching,
  onLaunchDashboard,
}: {
  isLaunching: boolean
  onLaunchDashboard: () => void
}) {
  return (
    <section id="features" className="px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-screen-xl">
        <Reveal className="max-w-3xl">
          <Eyebrow className="text-primary/82">What you get</Eyebrow>
          <h2 className="landing-display mt-4 text-4xl leading-[0.95] tracking-[-0.05em] text-white md:text-6xl">
            A fast way to compare sourcing options.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/62 md:text-lg">
            Input a product and destination, compare a few countries and
            shipping assumptions, then review a ranked recommendation.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <FeatureCard
              key={feature.label}
              feature={feature}
              delay={index * 80}
            />
          ))}
        </div>

        <Reveal delay={220} className="mt-12">
          <div className="landing-panel flex flex-col items-start justify-between gap-6 rounded-[2rem] border border-white/10 bg-black/16 p-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <p className="text-sm tracking-[0.3em] text-white/42 uppercase">
                Ready to try it?
              </p>
              <p className="mt-3 text-2xl font-medium tracking-[-0.04em] text-white md:text-3xl">
                Choose a CSV intake or continue into the demo dashboard.
              </p>
            </div>
            <DashboardLaunchButton
              onLaunch={onLaunchDashboard}
              disabled={isLaunching}
              className="landing-button landing-button--solid inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-[#04110a] hover:-translate-y-0.5"
            >
              Open launch options
              <span aria-hidden>→</span>
            </DashboardLaunchButton>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
