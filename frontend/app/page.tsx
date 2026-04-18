"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"

import { GreenChainLogo } from "@/components/green-chain-logo"
import { cn } from "@/lib/utils"

const IMG = {
  heroVid: "/landing/Video_Generation_Complete.mp4",
  heroBg:
    "/landing/Cinematic_top-down_aerial_photograph_of_an_expansi-1776490199103.png",
  warehouse:
    "/landing/Stunning_photorealistic_interior_view_of_a_futuris-1776490260857.png",
  circuit:
    "/landing/Epic_extreme_macro_photography_shot_of_a_vivid_gre-1776490265657.png",
  engineers:
    "/landing/High-quality_candid_photojournalistic_image_of_two-1776490282355.png",
  port: "/landing/Epic_high-altitude_aerial_drone_photograph_of_an_e-1776490293039.png",
  ai: "/landing/Stunning_abstract_conceptual_visualization_of_an_A-1776490301437.png",
  globe:
    "/landing/Stunning_translucent_dark-blue_globe_of_planet_Ear-1776490521137.png",
  ctaPush:
    "/landing/Cinematic_photograph_of_a_professional_engineer_st-1776490359376.png",
  team: "/landing/Candid_editorial_photograph_of_a_diverse_professio-1776490341439.png",
} as const

type Metric = {
  value: number
  suffix: string
  label: string
}

type Feature = {
  img: string
  label: string
  title: string
  body: string
  bullets: string[]
}

const HERO_SIGNALS = [
  {
    label: "Start with demand",
    value: "Product and destination",
    detail: "Define what you need to source, how much you need, and where it needs to arrive.",
  },
  {
    label: "Compare options",
    value: "Country and transport",
    detail: "Test manufacturing countries side by side and see how shipping mode changes the result.",
  },
  {
    label: "Make a decision",
    value: "Ranking and recommendation",
    detail: "Review the tradeoffs quickly and export a short memo with the strongest option.",
  },
] as const

const IMPACT_STATS: Metric[] = [
  { value: 5, suffix: "", label: "impact dimensions" },
  { value: 4, suffix: "", label: "shipping modes" },
  { value: 180, suffix: "+", label: "country data points" },
  { value: 60, suffix: "s", label: "comparison time" },
]

const FEATURES: Feature[] = [
  {
    img: IMG.warehouse,
    label: "Prototype Flow",
    title: "Compare sourcing scenarios quickly.",
    body:
      "The brief is intentionally focused: compare a few sourcing options quickly, show what drives the footprint, and make the transport tradeoff obvious.",
    bullets: [
      "Product, quantity, and destination input",
      "Country and transport mode comparison",
      "Quick ranked output for sourcing teams",
    ],
  },
  {
    img: IMG.engineers,
    label: "Supply Chain Graph",
    title: "See manufacturers and links as a live network.",
    body:
      "The graph view turns suppliers, facilities, and routes into a structure you can inspect instead of a list you have to mentally piece together.",
    bullets: [
      "Interactive nodes and connections",
      "Status-focused details",
      "Fast visual context for sourcing decisions",
    ],
  },
  {
    img: IMG.globe,
    label: "Geographic View",
    title: "Match the network with real-world location context.",
    body:
      "The geographic view makes transport tradeoffs easier to read by putting facilities and routes into a single global frame.",
    bullets: [
      "Location-driven exploration",
      "Graph + globe side by side",
      "Clearer context for transport choices",
    ],
  },
]

const MANIFESTO_BULLETS = [
  "Manufacturing emissions estimated from industry, country, and energy context",
  "Transport emissions compared directly across sea, air, rail, and road",
  "Grid intensity, certifications, and climate risk included in the score",
]

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

function useInView(threshold = 0.18) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true)
      },
      { threshold },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setPrefersReducedMotion(mediaQuery.matches)

    update()
    mediaQuery.addEventListener("change", update)
    return () => mediaQuery.removeEventListener("change", update)
  }, [])

  return prefersReducedMotion
}

function useCountUp(target: number, active: boolean, duration = 1400) {
  const [count, setCount] = useState(0)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (!active) return

    if (prefersReducedMotion) return

    let frame = 0
    const start = performance.now()

    const step = (now: number) => {
      const progress = clamp((now - start) / duration, 0, 1)
      const eased = 1 - (1 - progress) ** 3
      setCount(Math.round(target * eased))

      if (progress < 1) frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [active, duration, prefersReducedMotion, target])

  return active && prefersReducedMotion ? target : count
}

function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <p className={cn("eyebrow", className)}>{children}</p>
}

function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  const { ref, inView } = useInView()

  return (
    <div
      ref={ref}
      className={cn("transition-all duration-700 ease-out", className)}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0px)" : `translateY(${y}px)`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

function WordReveal({
  text,
  className,
  wordClass,
  delay = 0,
}: {
  text: string
  className?: string
  wordClass?: string
  delay?: number
}) {
  const { ref, inView } = useInView(0.15)

  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      <span>
        {text.split(" ").map((word, index) => (
          <span key={index} className="inline-block overflow-hidden">
            <span
              className={cn(
                "inline-block mr-[0.24em] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                wordClass,
              )}
              style={{
                transform: inView ? "translateY(0%)" : "translateY(115%)",
                transitionDelay: `${delay + index * 38}ms`,
              }}
            >
              {word}
            </span>
          </span>
        ))}
      </span>
    </div>
  )
}

function LineReveal({
  lines,
  active,
  className,
  lineClass,
  delay = 0,
}: {
  lines: React.ReactNode[]
  active: boolean
  className?: string
  lineClass?: string
  delay?: number
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {lines.map((line, index) => (
        <div key={index} className="overflow-hidden">
          <div
            className={cn(lineClass)}
            style={{
              opacity: active ? 1 : 0,
              transform: active ? "translateY(0%)" : "translateY(118%)",
              transition:
                "transform 0.95s cubic-bezier(0.16,1,0.3,1), opacity 0.7s ease",
              transitionDelay: `${delay + index * 120}ms`,
            }}
          >
            {line}
          </div>
        </div>
      ))}
    </div>
  )
}

function ParallaxMedia({
  src,
  alt,
  className,
  speed = 0.14,
  sizes,
  priority = false,
}: {
  src: string
  alt: string
  className?: string
  speed?: number
  sizes: string
  priority?: boolean
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  const syncTransform = useEffectEvent(() => {
    const frame = frameRef.current
    const media = mediaRef.current
    if (!frame || !media) return

    if (prefersReducedMotion) {
      media.style.transform = "translate3d(0,0,0) scale(1.04)"
      return
    }

    const rect = frame.getBoundingClientRect()
    const viewportHeight = window.innerHeight || 1
    const progress = clamp(
      (viewportHeight - rect.top) / (viewportHeight + rect.height),
      0,
      1,
    )
    const centered = progress * 2 - 1
    const translateY = clamp(centered * speed * -160, -72, 72)

    media.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0) scale(1.12)`
  })

  useEffect(() => {
    let frame = 0

    const onFrame = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(syncTransform)
    }

    onFrame()
    window.addEventListener("scroll", onFrame, { passive: true })
    window.addEventListener("resize", onFrame)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onFrame)
      window.removeEventListener("resize", onFrame)
    }
  }, [prefersReducedMotion])

  return (
    <div ref={frameRef} className={cn("relative overflow-hidden", className)}>
      <div ref={mediaRef} className="absolute inset-[-12%] will-change-transform">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      </div>
    </div>
  )
}

function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !ref.current) return

    const rect = ref.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5

    ref.current.style.transform = `perspective(1100px) rotateY(${(x * 7).toFixed(2)}deg) rotateX(${(-y * 7).toFixed(2)}deg) translate3d(0,-2px,0) scale3d(1.01,1.01,1.01)`
  }

  const onLeave = () => {
    if (!ref.current) return
    ref.current.style.transform =
      "perspective(1100px) rotateY(0deg) rotateX(0deg) translate3d(0,0,0) scale3d(1,1,1)"
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{
        transition: "transform 180ms ease-out",
        willChange: "transform",
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  )
}

function StatTile({
  value,
  suffix,
  label,
  active,
}: Metric & { active: boolean }) {
  const count = useCountUp(value, active)

  return (
    <div className="bg-black/20 px-5 py-6">
      <p className="text-4xl font-medium tracking-[-0.04em] text-white md:text-5xl">
        {count}
        <span className="text-primary/90">{suffix}</span>
      </p>
      <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/42">
        {label}
      </p>
    </div>
  )
}

function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [videoReady, setVideoReady] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => setMounted(true), 120)
    return () => window.clearTimeout(timeout)
  }, [])

  const syncGlow = useEffectEvent((event: MouseEvent) => {
    if (!sectionRef.current || !glowRef.current || prefersReducedMotion) return

    const rect = sectionRef.current.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100

    glowRef.current.style.background = `radial-gradient(circle at ${x.toFixed(1)}% ${y.toFixed(1)}%, oklch(0.73 0.11 164 / 0.18), transparent 45%), radial-gradient(circle at ${(x + 18).toFixed(1)}% ${(y + 10).toFixed(1)}%, oklch(0.71 0.1 72 / 0.12), transparent 50%)`
  })

  useEffect(() => {
    const element = sectionRef.current
    if (!element || prefersReducedMotion) return

    element.addEventListener("mousemove", syncGlow)
    return () => element.removeEventListener("mousemove", syncGlow)
  }, [prefersReducedMotion])

  const syncVideo = useEffectEvent(() => {
    const video = videoRef.current
    if (!video || prefersReducedMotion) return

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

    if (prefersReducedMotion) {
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
  }, [prefersReducedMotion])

  const fadeUp = (delay: number) => ({
    style: {
      opacity: mounted ? 1 : 0,
      transform: mounted ? "translate3d(0,0,0)" : "translate3d(0,30px,0)",
      transition:
        "opacity 0.8s ease, transform 0.9s cubic-bezier(0.16,1,0.3,1)",
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
    <section
      ref={sectionRef}
      className="relative min-h-[100svh] overflow-hidden border-b border-white/8"
    >
      <div className="absolute inset-0 -z-20">
        <Image
          src={IMG.heroBg}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover scale-110"
        />
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={IMG.heroBg}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms]",
            videoReady && !prefersReducedMotion ? "opacity-100" : "opacity-0",
          )}
        >
          <source src={IMG.heroVid} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,23,24,0.08),_rgba(5,9,12,0.78)_56%,_rgba(5,9,12,0.94)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(2,7,10,0.12)_0%,_rgba(2,7,10,0.18)_28%,_rgba(2,7,10,0.72)_72%,_rgba(2,7,10,0.96)_100%)]" />
      </div>

      <div className="landing-grid absolute inset-0 -z-10 opacity-55" />
      <div
        ref={glowRef}
        className="absolute inset-0 -z-10 pointer-events-none transition-opacity duration-500"
        style={{
          background:
            "radial-gradient(circle at 50% 28%, oklch(0.73 0.11 164 / 0.12), transparent 42%), radial-gradient(circle at 70% 20%, oklch(0.72 0.1 72 / 0.08), transparent 36%)",
          opacity: prefersReducedMotion ? 0.75 : 1,
        }}
      />

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-screen-2xl flex-col px-6 pb-8 pt-6 md:px-10">
        <header className="flex items-center justify-between gap-4">
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
              ["#platform", "Platform"],
              ["#capabilities", "Capabilities"],
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

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-5 py-2.5 text-sm text-white backdrop-blur-xl transition-all duration-300 hover:border-white/28 hover:bg-white/14"
            >
              Enter Dashboard
              <span aria-hidden>→</span>
            </Link>
          </nav>
        </header>

        <div className="grid min-h-[calc(100svh-5rem)] flex-1 gap-12 py-12 lg:grid-cols-[minmax(0,1.05fr)_360px] lg:items-end">
          <div className="max-w-4xl lg:self-center">
            <div {...fadeUp(40)}>
              <Eyebrow className="mb-6 text-primary/88">HackPrinceton Prototype</Eyebrow>
            </div>

            <LineReveal
              lines={heroLines}
              active={mounted}
              className="max-w-5xl"
              lineClass="landing-display text-[clamp(3.35rem,8vw,7.85rem)] leading-[0.92] tracking-[-0.055em] text-white"
              delay={120}
            />

            <div {...fadeUp(520)}>
              <p className="mt-8 max-w-xl text-base leading-relaxed text-white/68 md:text-lg">
                GreenChain helps sourcing teams compare manufacturers,
                countries, and transport modes through an environmental lens,
                using open data and fast supplier research.
              </p>
            </div>

            <div {...fadeUp(680)} className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-[#04110a] transition-transform duration-300 hover:-translate-y-0.5"
              >
                Open Platform
                <span aria-hidden>→</span>
              </Link>

              <a
                href="#platform"
                className="inline-flex items-center gap-2 text-sm text-white/62 transition-colors hover:text-white"
              >
                See the platform
                <span aria-hidden>↓</span>
              </a>
            </div>
          </div>

          <div {...fadeUp(480)} className="hidden flex-col gap-4 lg:flex">
            <div className="landing-panel rounded-[2rem] p-5 landing-float">
              <Eyebrow className="text-white/45">Global Coverage</Eyebrow>
              <div className="relative mt-4 aspect-[4/4.9] overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/24">
                <Image
                  src={IMG.globe}
                  alt=""
                  fill
                  sizes="360px"
                  className="object-cover scale-110 opacity-90 mix-blend-screen"
                />
                <div className="landing-grid absolute inset-0 opacity-30" />
                <div className="absolute inset-x-4 bottom-4 rounded-[1.25rem] border border-white/10 bg-black/36 px-4 py-3 backdrop-blur-xl">
                  <p className="text-[0.62rem] uppercase tracking-[0.28em] text-white/42">
                    Coverage
                  </p>
                  <p className="mt-1 text-2xl font-medium tracking-[-0.04em] text-white">
                    Graph + globe view
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-white/62">
                    A live network view on the left and geographic context on
                    the right.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="landing-panel rounded-[1.5rem] p-4 landing-float [animation-delay:120ms]">
                <Eyebrow className="text-white/42">Score Inputs</Eyebrow>
                <p className="mt-3 text-3xl font-medium tracking-[-0.05em] text-white">
                  5
                </p>
                <p className="mt-1 text-sm text-white/58">
                  Manufacturing, transport, grid, certifications, and climate
                  risk.
                </p>
              </div>
              <div className="landing-panel rounded-[1.5rem] p-4 landing-float [animation-delay:240ms]">
                <Eyebrow className="text-white/42">Transport Modes</Eyebrow>
                <p className="mt-3 text-3xl font-medium tracking-[-0.05em] text-white">
                  4
                </p>
                <p className="mt-1 text-sm text-white/58">
                  Sea, air, rail, and road are meant to rerank results fast.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          {...fadeUp(840)}
          className="grid gap-4 border-t border-white/10 pt-6 md:grid-cols-3"
        >
          {HERO_SIGNALS.map((item) => (
            <div key={item.label} className="landing-panel rounded-[1.35rem] p-4">
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

function Manifesto() {
  const { ref, inView } = useInView(0.22)

  return (
    <section className="px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <Eyebrow className="text-primary/82">Sourcing, Made Legible</Eyebrow>
        </Reveal>

        <WordReveal
          text="Compare sourcing options with clearer environmental tradeoffs."
          className="mt-6"
          wordClass="landing-display text-[clamp(2.45rem,5.2vw,4.95rem)] leading-[0.98] tracking-[-0.045em] text-white"
        />

        <Reveal delay={180}>
          <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-white/62 md:text-lg">
            Give it a product, a destination, and a few sourcing assumptions.
            GreenChain pulls scattered environmental signals into a comparison
            you can actually use.
          </p>
        </Reveal>
      </div>

      <Reveal className="mx-auto mt-16 max-w-screen-xl landing-panel rounded-[2rem] p-6 md:p-8">
          <Eyebrow className="text-primary/78">How It Scores</Eyebrow>
          <p className="landing-display mt-4 max-w-3xl text-3xl leading-[1.02] tracking-[-0.05em] text-white md:text-4xl">
            Every option is ranked on a few clear environmental drivers.
          </p>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/62">
            GreenChain is built for fast comparison. It helps answer which
            sourcing option looks greener and what factors are driving the gap.
          </p>

          <div
            ref={ref}
            className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 lg:grid-cols-4"
          >
            {IMPACT_STATS.map((stat) => (
              <StatTile key={stat.label} {...stat} active={inView} />
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {MANIFESTO_BULLETS.map((item) => (
              <div
                key={item}
                className="rounded-[1.25rem] border border-white/10 bg-black/16 p-4 text-sm leading-relaxed text-white/62"
              >
                {item}
              </div>
            ))}
          </div>
      </Reveal>
    </section>
  )
}

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
        <div
          className="relative h-64 overflow-hidden border-b border-white/10 md:h-72"
        >
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

function CapabilityGrid() {
  return (
    <section id="capabilities" className="px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-screen-xl">
        <Reveal className="max-w-3xl">
          <Eyebrow className="text-primary/82">Explore the Platform</Eyebrow>
          <h2 className="landing-display mt-4 text-4xl leading-[0.95] tracking-[-0.05em] text-white md:text-6xl">
            Graph, globe, and fast comparison context.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/62 md:text-lg">
            The graph and globe views make the supply chain easier to read,
            giving each sourcing decision both network context and geographic
            context.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <FeatureCard feature={FEATURES[0]} />
          <FeatureCard feature={FEATURES[1]} delay={80} />
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer id="about" className="px-6 pb-12 pt-4 md:px-10">
      <div className="mx-auto flex max-w-screen-xl flex-col gap-8 border-t border-white/8 pt-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/42">
            GreenChain
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/54">
            Compare sourcing options across manufacturers, countries, and
            transport modes through an environmental lens.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/52">
          {[
            ["/dashboard", "Dashboard"],
            ["#platform", "Platform"],
            ["#capabilities", "Capabilities"],
            ["#about", "About"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="transition-colors hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <main className="landing-page min-h-svh overflow-x-hidden text-foreground">
      <Hero />
      <Manifesto />
      <CapabilityGrid />
      <Footer />
    </main>
  )
}
