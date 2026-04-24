"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"

import { GreenChainLogo } from "@/components/green-chain-logo"
import {
  HERO_SIGNALS,
  IMG,
} from "@/components/landing/landing-constants"
import { LineReveal } from "@/components/landing/line-reveal"
import { ThreeField } from "@/components/landing/three-field"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"

export function DashboardLaunchButton({
  children,
  className,
  disabled = false,
  onLaunch,
}: {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  onLaunch: () => void
}) {
  return (
    <button
      type="button"
      onClick={onLaunch}
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        className,
        "disabled:pointer-events-none disabled:cursor-progress disabled:opacity-70"
      )}
    >
      {children}
    </button>
  )
}

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <p className={cn("eyebrow", className)}>{children}</p>
}

export function HeroSection({
  introReady,
  isLaunching,
  onLaunchDashboard,
}: {
  introReady: boolean
  isLaunching: boolean
  onLaunchDashboard: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [navFade, setNavFade] = useState(1)

  useEffect(() => {
    if (!introReady) return
    const timeout = window.setTimeout(() => setMounted(true), 120)
    return () => window.clearTimeout(timeout)
  }, [introReady])

  useEffect(() => {
    let frame = 0
    const update = () => {
      const y = window.scrollY
      const threshold = window.innerHeight * 0.6
      setNavFade(y > threshold ? 0 : 1)
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
    }
  }, [])

  const syncVideo = useEffectEvent(() => {
    const video = videoRef.current
    if (!video) return

    if (prefersReducedMotion || isLaunching || !introReady) {
      video.pause()
      return
    }

    video.defaultMuted = true
    video.muted = true

    const playPromise = video.play()
    playPromise?.catch(() => {
      setVideoReady(false)
    })
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (prefersReducedMotion || isLaunching || !introReady) {
      video.pause()
      return
    }

    const onCanPlay = () => {
      setVideoReady(true)
      syncVideo()
    }

    const onLoadedData = () => setVideoReady(true)
    const onError = () => setVideoReady(false)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncVideo()
      else video.pause()
    }

    video.addEventListener("canplay", onCanPlay)
    video.addEventListener("loadeddata", onLoadedData)
    video.addEventListener("error", onError)
    document.addEventListener("visibilitychange", onVisibilityChange)

    syncVideo()

    return () => {
      video.removeEventListener("canplay", onCanPlay)
      video.removeEventListener("loadeddata", onLoadedData)
      video.removeEventListener("error", onError)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [introReady, isLaunching, prefersReducedMotion])

  const fadeUp = (delay: number) => ({
    style: {
      opacity: mounted ? 1 : 0,
      transform: mounted ? "translate3d(0,0,0)" : "translate3d(0,30px,0)",
      transition:
        "opacity 1.05s ease, transform 1.3s cubic-bezier(0.16,1,0.3,1)",
      transitionDelay: `${delay}ms`,
    },
  })

  const heroLines = [
    <>Compare sourcing options</>,
    <>
      before you <span className="text-primary">place the order</span>.
    </>,
  ]

  return (
    <section className="relative min-h-[100svh] overflow-hidden border-b border-white/8">
      <div className="absolute inset-0 -z-20">
        <Image
          src={IMG.heroBg}
          alt=""
          fill
          priority
          sizes="100vw"
          className={cn(
            "object-cover transition-transform duration-[3400ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
            introReady ? "scale-100" : "scale-[1.14]"
          )}
        />
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={IMG.heroBg}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-[2400ms]",
            videoReady && !prefersReducedMotion ? "opacity-100" : "opacity-0"
          )}
        >
          <source src={IMG.heroVid} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,23,24,0.08),_rgba(5,9,12,0.78)_56%,_rgba(5,9,12,0.94)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(2,7,10,0.12)_0%,_rgba(2,7,10,0.18)_28%,_rgba(2,7,10,0.72)_72%,_rgba(2,7,10,0.96)_100%)]" />
      </div>

      <ThreeField disabled={prefersReducedMotion || isLaunching} />
      <div className="landing-grid absolute inset-0 -z-10 opacity-55" />

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-screen-2xl flex-col px-6 pt-6 pb-8 md:px-10">
        <header
          className="flex items-center justify-between gap-4"
          style={{ opacity: navFade, transition: "opacity 320ms ease" }}
        >
          <Link
            href="/"
            className="inline-flex shrink-0 items-center transition-opacity hover:opacity-90"
          >
            <GreenChainLogo
              variant="onDark"
              className="h-8 w-auto sm:h-9 md:h-10"
            />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {[
              ["#features", "Features"],
              ["#about", "About"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-sm text-white/58 transition-colors hover:text-white"
              >
                {label}
              </a>
            ))}

            <DashboardLaunchButton
              onLaunch={onLaunchDashboard}
              disabled={isLaunching}
              className="landing-button landing-button--ghost inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-5 py-2.5 text-sm text-white backdrop-blur-xl hover:border-white/28 hover:bg-white/14"
            >
              Launch Platform
              <span aria-hidden>→</span>
            </DashboardLaunchButton>
          </nav>
        </header>

        <div className="flex min-h-[calc(100svh-5rem)] flex-1 flex-col justify-center gap-12 py-12">
          <div className="max-w-[80rem]">
            <LineReveal
              lines={heroLines}
              active={mounted}
              className="max-w-[80rem]"
              lineClass="landing-display text-[clamp(3.35rem,8vw,7.85rem)] leading-[1] tracking-[-0.055em] text-white"
              delay={120}
            />

            <div {...fadeUp(520)}>
              <p className="mt-8 max-w-xl text-base leading-relaxed text-white/68 md:text-lg">
                GreenChain helps sourcing teams compare manufacturers,
                countries, and transport modes through an environmental lens,
                using open data and fast supplier research.
              </p>
            </div>

            <div
              {...fadeUp(680)}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              <DashboardLaunchButton
                onLaunch={onLaunchDashboard}
                disabled={isLaunching}
                className="landing-button landing-button--solid inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-[#04110a] hover:-translate-y-0.5"
              >
                Open Platform
                <span aria-hidden>→</span>
              </DashboardLaunchButton>

              <a
                href="#features"
                className="inline-flex items-center gap-2 text-sm text-white/62 transition-colors hover:text-white"
              >
                See the features
                <span aria-hidden>↓</span>
              </a>
            </div>
          </div>
        </div>

        <div
          {...fadeUp(840)}
          className="grid gap-4 border-t border-white/10 pt-6 md:grid-cols-3"
        >
          {HERO_SIGNALS.map((item) => (
            <div
              key={item.label}
              className="landing-panel rounded-[1.35rem] p-4"
            >
              <Eyebrow className="text-white/42">{item.label}</Eyebrow>
              <p className="mt-3 text-xl font-medium tracking-[-0.03em] text-white md:text-2xl">
                {item.value}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/58">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
