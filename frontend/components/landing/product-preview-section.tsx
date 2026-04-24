"use client"

import { useEffect, useRef } from "react"

import { Counter } from "@/components/landing/counter"
import { Eyebrow } from "@/components/landing/hero-section"
import { clamp } from "@/components/landing/landing-constants"
import { ScrollScene } from "@/components/landing/scroll-scene"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

const ACTS = [
  {
    label: "01",
    title: "A request arrives",
    body: "Product, destination, candidate countries, transport mode.",
  },
  {
    label: "02",
    title: "Agents discover in parallel",
    body: "A Dedalus swarm fans out — discovery, certifications, memo.",
  },
  {
    label: "03",
    title: "The score composes",
    body: "Five dimensions. Manufacturing, transport, grid, certs, risk.",
  },
  {
    label: "04",
    title: "A memo lands",
    body: "Rank-one manufacturer, five bullets, cited sources.",
  },
] as const

function actProgress(progress: number, index: number): number {
  const actStart = index * 0.25
  const actEnd = actStart + 0.3
  return clamp((progress - actStart) / (actEnd - actStart), 0, 1)
}

function actVisibility(progress: number, index: number): number {
  const center = index * 0.25 + 0.125
  const distance = Math.abs(progress - center)
  return clamp(1 - distance / 0.2, 0, 1)
}

export function ProductPreviewSection() {
  const prefersReducedMotion = usePrefersReducedMotion()

  if (prefersReducedMotion) {
    return (
      <section
        id="product"
        className="px-6 py-24 md:px-10"
        aria-label="How GreenChain works"
      >
        <div className="mx-auto grid max-w-screen-xl gap-6 md:grid-cols-2">
          {ACTS.map((act) => (
            <div key={act.label} className="landing-panel rounded-[1.5rem] p-8">
              <p className="eyebrow text-primary/78">{act.label}</p>
              <h3 className="landing-display mt-3 text-3xl tracking-[-0.04em] text-white">
                {act.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/62">
                {act.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section
      id="product"
      aria-label="How GreenChain works"
      className="relative"
    >
      <ScrollScene totalVh={360}>
        {(progress) => <PreviewStage progress={progress} />}
      </ScrollScene>
    </section>
  )
}

function PreviewStage({ progress }: { progress: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(progress)
  progressRef.current = progress

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const context = canvas.getContext("2d")
    if (!context) return

    let frame = 0
    let width = 1
    let height = 1

    const NODES = Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * Math.PI * 2
      const radiusBias = ((i * 37) % 100) / 800
      const seedOffset = ((i * 131) % 100) / 200 - 0.25
      return {
        angle,
        radiusBias,
        wobble: seedOffset,
        rating: i % 5 === 0 ? "red" : i % 3 === 0 ? "amber" : "green",
      }
    })

    const AGENTS = [
      { angle: -Math.PI / 2 },
      { angle: Math.PI / 6 },
      { angle: (Math.PI * 5) / 6 },
    ]

    const resize = () => {
      const rect = container.getBoundingClientRect()
      width = rect.width
      height = rect.height
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const tick = () => {
      const p = progressRef.current
      context.clearRect(0, 0, width, height)

      const cx = width * 0.5
      const cy = height * 0.5
      const R = Math.min(width, height) * 0.32

      const pulse = actVisibility(p, 0)
      const pulseR = 12 + pulse * 16
      const orb = context.createRadialGradient(cx, cy, 0, cx, cy, pulseR * 3)
      orb.addColorStop(0, `rgba(148,255,209,${0.35 + pulse * 0.35})`)
      orb.addColorStop(1, "rgba(148,255,209,0)")
      context.fillStyle = orb
      context.beginPath()
      context.arc(cx, cy, pulseR * 3, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = `rgba(148,255,209,${0.55 + pulse * 0.3})`
      context.beginPath()
      context.arc(cx, cy, 6, 0, Math.PI * 2)
      context.fill()

      const fanP = actProgress(p, 1)
      for (const agent of AGENTS) {
        const dist = R * 0.5 * fanP
        const ax = cx + Math.cos(agent.angle) * dist
        const ay = cy + Math.sin(agent.angle) * dist
        context.strokeStyle = `rgba(148,255,209,${0.22 * fanP})`
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(cx, cy)
        context.lineTo(ax, ay)
        context.stroke()
        context.fillStyle = `rgba(148,255,209,${0.6 * fanP})`
        context.beginPath()
        context.arc(ax, ay, 4, 0, Math.PI * 2)
        context.fill()
      }

      const leavesP = actProgress(p, 1)
      const scoreP = actProgress(p, 2)
      for (let i = 0; i < NODES.length; i++) {
        const node = NODES[i]
        const perNodeStart = i / NODES.length
        if (leavesP < perNodeStart * 0.9) continue
        const appear = clamp((leavesP - perNodeStart * 0.9) / 0.1, 0, 1)
        const nx = cx + Math.cos(node.angle) * R * (0.8 + node.wobble)
        const ny = cy + Math.sin(node.angle) * R * (0.8 + node.wobble) * 0.72
        const showScore = scoreP > perNodeStart
        const color = showScore
          ? node.rating === "green"
            ? "29,158,117"
            : node.rating === "amber"
              ? "186,117,23"
              : "226,75,74"
          : "180,178,169"
        context.fillStyle = `rgba(${color},${0.85 * appear})`
        context.beginPath()
        context.arc(nx, ny, 3 + appear * 2, 0, Math.PI * 2)
        context.fill()
      }

      const ringP = actProgress(p, 2)
      if (ringP > 0) {
        const top = NODES[0]
        const rx = cx + Math.cos(top.angle) * R * (0.8 + top.wobble)
        const ry = cy + Math.sin(top.angle) * R * (0.8 + top.wobble) * 0.72
        const segments = 5
        for (let s = 0; s < segments; s++) {
          const segStart = -Math.PI / 2 + (s / segments) * Math.PI * 2
          const segEnd = segStart + (Math.PI * 2) / segments - 0.08
          context.strokeStyle = `rgba(148,255,209,${0.35 * ringP})`
          context.lineWidth = 3
          context.beginPath()
          context.arc(
            rx,
            ry,
            14 + s * 1.5,
            segStart,
            segEnd * ringP + segStart * (1 - ringP)
          )
          context.stroke()
        }
      }

      frame = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener("resize", resize)
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
    }
  }, [])

  const activeIndex = Math.min(3, Math.floor(progress * 4))
  const act = ACTS[activeIndex]
  const memoP = actProgress(progress, 3)

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full bg-[radial-gradient(circle_at_50%_45%,_rgba(29,158,117,0.08),_transparent_60%)]"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="relative z-10 mx-auto flex h-full max-w-screen-xl flex-col justify-between px-6 py-12 md:px-10 md:py-20">
        <div className="max-w-md">
          <Eyebrow className="text-primary/82">
            {act.label} · How it works
          </Eyebrow>
          <h2 className="landing-display mt-4 text-4xl leading-[1] tracking-[-0.045em] text-white md:text-6xl">
            {act.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/62 md:text-base">
            {act.body}
          </p>
        </div>

        <div
          className="landing-panel ml-auto w-full max-w-sm rounded-[1.5rem] p-6 transition-opacity duration-500"
          style={{ opacity: memoP }}
          aria-hidden={memoP < 0.5}
        >
          <p className="eyebrow text-primary/78">Memo draft</p>
          <p className="mt-3 text-lg font-medium tracking-[-0.03em] text-white">
            Rank 1 · Alentejo Têxtil · Portugal
          </p>
          <p className="mt-2 text-sm text-white/62">Composite score</p>
          <p className="landing-display mt-1 text-5xl tracking-[-0.04em] text-primary">
            <Counter to={82} progress={memoP} />
            <span className="ml-1 text-xl text-white/40">/ 100</span>
          </p>
        </div>
      </div>
    </div>
  )
}
