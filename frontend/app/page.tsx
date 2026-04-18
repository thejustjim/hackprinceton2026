"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ─── data ─────────────────────────────────────────────────────────────────────

const stackCards = [
  {
    image: "/landing/feature-ai.jpg",
    eyebrow: "AI-Powered Analysis",
    headline: "See every link in your chain.",
  },
  {
    image: "/landing/feature-globe.jpg",
    eyebrow: "Global Coverage",
    headline: "Track 180+ countries in real time.",
  },
  {
    image: "/landing/feature-risk.jpg",
    eyebrow: "Risk Intelligence",
    headline: "Spot disruptions before they hit.",
  },
  {
    image: "/landing/cta-push.jpg",
    eyebrow: "Built for Scale",
    headline: "Your supply chain, at a glance.",
    body: "From factory floor to final mile, GreenChain gives you a live map of every dependency.",
    cta: true,
  },
] as const

const featureTiles = [
  {
    image: "/landing/feature-ai.jpg",
    label: "AI Graph Analysis",
    title: "Connections your team can't see alone.",
    body: "Our AI maps supplier relationships multiple tiers deep, surfacing hidden dependencies before they become vulnerabilities.",
  },
  {
    image: "/landing/feature-globe.jpg",
    label: "Global Intelligence",
    title: "Every node. Every country. Live.",
    body: "Real-time data from 180+ countries gives you ground truth on where your materials are and what risks lie ahead.",
  },
  {
    image: "/landing/feature-risk.jpg",
    label: "Risk Alerts",
    title: "Disruption warning before it reaches you.",
    body: "Geopolitical shifts, weather events, and supplier outages — GreenChain flags them the moment they appear on the map.",
  },
]

// ─── shared components ────────────────────────────────────────────────────────

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("eyebrow", className)}>{children}</p>
  )
}

function RevealBlock({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true) },
      { threshold: 0.1 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  const anim = (delay: number) => ({
    className: cn(
      "transition-all duration-700",
      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
    ),
    style: { transitionDelay: `${delay}ms` },
  })

  return (
    <section className="relative h-svh min-h-[600px] flex flex-col overflow-hidden">
      {/* background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-background/80 to-background">
        <img
          src="/landing/hero-bg.jpg"
          alt=""
          className="w-full h-full object-cover opacity-50 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-background" />
      </div>

      {/* nav */}
      <header className="flex items-center justify-between px-8 py-6 max-w-screen-xl mx-auto w-full z-10">
        <span className="eyebrow text-foreground/90 tracking-widest">GreenChain</span>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            About
          </a>
          <Link
            href="/dashboard"
            className="text-sm px-5 py-2 rounded-full border border-border bg-card/60 backdrop-blur-sm hover:bg-primary/20 hover:border-primary/50 transition-all"
          >
            Dashboard →
          </Link>
        </nav>
      </header>

      {/* content */}
      <div className="flex-1 flex flex-col items-start justify-center px-8 md:px-16 max-w-screen-xl mx-auto w-full">
        <div {...anim(0)}>
          <Eyebrow className="mb-6 text-primary/80">Supply Chain Intelligence</Eyebrow>
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-semibold tracking-tight leading-[1.04] max-w-4xl">
          {["See", "every", "link", "in", "your", "chain."].map((word, i) => (
            <span
              key={i}
              className={cn(
                "inline-block mr-[0.22em] transition-all duration-700",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
              )}
              style={{ transitionDelay: `${120 + i * 80}ms` }}
            >
              {word}
            </span>
          ))}
        </h1>

        <div {...anim(720)}>
          <p className="mt-6 text-lg text-muted-foreground max-w-lg leading-relaxed">
            AI-powered visibility across your entire supplier network. Track dependencies, surface risks, and act before disruptions reach you.
          </p>
        </div>

        <div {...anim(860)} className="mt-10 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="px-7 py-3 rounded-full bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            Launch Dashboard
          </Link>
          <a
            href="#features"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            Learn more <span className="text-xs">↓</span>
          </a>
        </div>
      </div>

      {/* scroll hint */}
      <div
        {...anim(1000)}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40"
      >
        <span className="text-[0.6rem] tracking-[0.3em] uppercase">Scroll to explore</span>
        <span className="animate-bounce text-xs">↓</span>
      </div>
    </section>
  )
}

// ─── IntroQuote ───────────────────────────────────────────────────────────────

function IntroQuote() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section className="my-24 md:my-36 px-8">
      <div
        ref={ref}
        className={cn(
          "max-w-2xl mx-auto text-center transition-all duration-1000",
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12",
        )}
      >
        <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
          GreenChain is a new standard in supply chain visibility — where AI-grade graph analysis meets the reality of global logistics. We turn complex supplier data into a live, navigable map of your entire operation.
        </p>
      </div>
    </section>
  )
}

// ─── ImageGrid ────────────────────────────────────────────────────────────────

function ImageGrid() {
  return (
    <section className="px-6 md:px-10 my-12 md:my-20">
      <div className="grid grid-cols-3 gap-3 max-w-screen-xl mx-auto">
        {/* left column */}
        <div className="flex flex-col gap-3">
          <RevealBlock delay={0} className="h-52 md:h-72 rounded-2xl overflow-hidden bg-card border border-border/40">
            <img src="/landing/grid-1.jpg" alt="Automated warehouse" className="w-full h-full object-cover" />
          </RevealBlock>
          <RevealBlock delay={120} className="h-40 md:h-56 rounded-2xl overflow-hidden bg-card border border-border/40">
            <img src="/landing/grid-2.jpg" alt="Circuit board detail" className="w-full h-full object-cover" />
          </RevealBlock>
        </div>

        {/* center — tagline */}
        <RevealBlock delay={60} className="flex items-center justify-center px-4 md:px-8 text-center">
          <p className="text-xl md:text-2xl lg:text-3xl font-semibold leading-tight text-muted-foreground">
            Built for the complexity of modern supply chains.
          </p>
        </RevealBlock>

        {/* right column */}
        <div className="flex flex-col gap-3">
          <RevealBlock delay={120} className="h-40 md:h-56 rounded-2xl overflow-hidden bg-card border border-border/40">
            <img src="/landing/grid-3.jpg" alt="Engineering team" className="w-full h-full object-cover" />
          </RevealBlock>
          <RevealBlock delay={0} className="h-52 md:h-72 rounded-2xl overflow-hidden bg-card border border-border/40">
            <img src="/landing/grid-4.jpg" alt="Container port" className="w-full h-full object-cover" />
          </RevealBlock>
        </div>
      </div>
    </section>
  )
}

// ─── StackingCards ────────────────────────────────────────────────────────────

function StackingCards() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let rafId: number
    const handleScroll = () => {
      rafId = requestAnimationFrame(() => {
        if (!sectionRef.current) return
        const rect = sectionRef.current.getBoundingClientRect()
        const total = sectionRef.current.offsetHeight - window.innerHeight
        setProgress(Math.max(0, Math.min(1, -rect.top / total)))
      })
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => {
      window.removeEventListener("scroll", handleScroll)
      cancelAnimationFrame(rafId)
    }
  }, [])

  const numCards = stackCards.length
  const step = 1 / numCards

  return (
    <section
      id="features"
      ref={sectionRef}
      style={{ height: `${(numCards + 1.2) * 100}vh` }}
    >
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* section eyebrow */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <Eyebrow>Platform Capabilities</Eyebrow>
        </div>

        {stackCards.map((card, i) => {
          const cardProgress = Math.max(0, Math.min(1, (progress - i * step) / step))
          const translateY = (1 - cardProgress) * 100

          // Cards behind the active one scale slightly down
          const buriedFraction = Math.max(0, progress - (i + 1) * step) / step
          const scale = 1 - Math.min(buriedFraction, 1) * 0.05

          return (
            <div
              key={i}
              className="absolute inset-0 mx-4 md:mx-10 my-14 rounded-2xl overflow-hidden bg-card"
              style={{
                transform: `translateY(${translateY.toFixed(2)}%) scale(${scale.toFixed(4)})`,
                zIndex: i + 1,
                willChange: "transform",
                transformOrigin: "top center",
              }}
            >
              <img
                src={card.image}
                alt={card.eyebrow}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

              {card.cta ? (
                <div className="absolute bottom-8 md:bottom-12 left-8 md:left-12 right-8 md:right-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <Eyebrow className="text-white/50 mb-3">{card.eyebrow}</Eyebrow>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white max-w-sm leading-tight">
                      {card.headline}
                    </h2>
                    <p className="text-white/55 mt-3 max-w-sm text-sm leading-relaxed">{card.body}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    className="shrink-0 px-7 py-3.5 rounded-full bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors"
                  >
                    Launch Dashboard →
                  </Link>
                </div>
              ) : (
                <div className="absolute bottom-8 md:bottom-12 left-8 md:left-12">
                  <Eyebrow className="text-white/50 mb-3">{card.eyebrow}</Eyebrow>
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white max-w-md leading-tight">
                    {card.headline}
                  </h2>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── FeatureCarousel ──────────────────────────────────────────────────────────

function FeatureCarousel() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(true)

  const updateState = () => {
    const el = containerRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  const scrollBy = (dir: 1 | -1) => {
    containerRef.current?.scrollBy({ left: dir * 600, behavior: "smooth" })
  }

  return (
    <section className="my-24 md:my-36 overflow-hidden">
      <RevealBlock className="text-center mb-14 px-8">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight">
          Intelligent by Design.
        </h2>
        <div className="mt-5">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Explore the platform <span>→</span>
          </Link>
        </div>
      </RevealBlock>

      <div
        ref={containerRef}
        onScroll={updateState}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-8 pb-2 scrollbar-none"
      >
        {featureTiles.map((tile, i) => (
          <RevealBlock
            key={tile.title}
            delay={i * 100}
            className="flex-none w-[85vw] md:w-[560px] snap-start"
          >
            <article className="relative rounded-2xl overflow-hidden bg-card border border-border/50 group">
              <div className="relative h-60 overflow-hidden">
                <img
                  src={tile.image}
                  alt={tile.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
              </div>
              <div className="p-6">
                <Eyebrow className="mb-2">{tile.label}</Eyebrow>
                <h3 className="text-lg font-semibold mb-2 leading-snug">{tile.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{tile.body}</p>
              </div>
            </article>
          </RevealBlock>
        ))}
      </div>

      <div className="flex items-center gap-3 px-8 mt-6">
        <button
          onClick={() => scrollBy(-1)}
          disabled={!canLeft}
          aria-label="Previous"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-sm hover:bg-card disabled:opacity-25 transition-all"
        >
          ←
        </button>
        <button
          onClick={() => scrollBy(1)}
          disabled={!canRight}
          aria-label="Next"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-sm hover:bg-card disabled:opacity-25 transition-all"
        >
          →
        </button>
      </div>
    </section>
  )
}

// ─── CtaPush ──────────────────────────────────────────────────────────────────

function CtaPush() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section className="px-6 md:px-10 my-16 md:my-24">
      <div
        ref={ref}
        className={cn(
          "relative rounded-3xl overflow-hidden min-h-[440px] flex items-end bg-card border border-border/40 transition-all duration-1000",
          inView ? "opacity-100 scale-100" : "opacity-0 scale-[0.97]",
        )}
      >
        <img src="/landing/cta-push.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        <div className="relative z-10 p-8 md:p-14 flex flex-col md:flex-row md:items-end md:justify-between gap-8 w-full">
          <div>
            <p className="eyebrow text-white/50 mb-4">Explore GreenChain</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white max-w-lg leading-tight">
              The analysis starts with a closer look.
            </h2>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 px-8 py-4 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm text-white font-medium text-sm hover:bg-white/20 transition-colors"
          >
            Launch Dashboard →
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── EditorialBlock ───────────────────────────────────────────────────────────

function EditorialBlock() {
  return (
    <section id="about" className="px-6 md:px-10 my-20 md:my-32">
      <div className="max-w-screen-xl mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <RevealBlock className="flex flex-col gap-6">
          <Eyebrow>Our Mission</Eyebrow>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-md">
            We built GreenChain because modern supply chains are opaque by default. Tier-2 and tier-3 suppliers are invisible until they fail. Our platform changes that — giving procurement and risk teams a real-time view of every dependency, so you can move from reactive to proactive.
          </p>
          <Link
            href="/dashboard"
            className="self-start px-5 py-2.5 rounded-full border border-border text-sm hover:bg-card transition-colors"
          >
            Try the platform
          </Link>
        </RevealBlock>

        <RevealBlock delay={150} className="rounded-2xl overflow-hidden h-72 md:h-96 bg-card border border-border/40">
          <img src="/landing/about-team.jpg" alt="GreenChain team" className="w-full h-full object-cover" />
        </RevealBlock>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border/50 mt-16 px-8 py-12">
      <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row md:items-start md:justify-between gap-8">
        <div>
          <p className="text-base font-semibold tracking-wide">GreenChain</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
            AI-powered supply chain intelligence for teams that can&apos;t afford surprises.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <a href="#features" className="hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#about" className="hover:text-foreground transition-colors">
            About
          </a>
        </nav>

        <p className="text-xs text-muted-foreground/60">© 2026 GreenChain.</p>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main className="min-h-svh bg-background text-foreground overflow-x-hidden">
      <Hero />
      <IntroQuote />
      <ImageGrid />
      <StackingCards />
      <FeatureCarousel />
      <CtaPush />
      <EditorialBlock />
      <Footer />
    </main>
  )
}
