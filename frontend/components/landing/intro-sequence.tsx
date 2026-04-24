"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { GreenChainLogo } from "@/components/green-chain-logo"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"

const DURATION_MS = 2500
const SESSION_KEY = "gc:intro-seen"

const PINS: Array<{ x: number; y: number; color: string; delay: number }> = [
  { x: 0.18, y: 0.42, color: "148,255,209", delay: 0.22 },
  { x: 0.27, y: 0.55, color: "235,196,124", delay: 0.28 },
  { x: 0.34, y: 0.36, color: "148,255,209", delay: 0.32 },
  { x: 0.41, y: 0.48, color: "148,255,209", delay: 0.38 },
  { x: 0.49, y: 0.62, color: "235,196,124", delay: 0.44 },
  { x: 0.55, y: 0.4, color: "148,255,209", delay: 0.5 },
  { x: 0.62, y: 0.52, color: "148,255,209", delay: 0.56 },
  { x: 0.69, y: 0.38, color: "235,196,124", delay: 0.62 },
  { x: 0.75, y: 0.6, color: "226,75,74", delay: 0.68 },
  { x: 0.81, y: 0.45, color: "148,255,209", delay: 0.74 },
  { x: 0.87, y: 0.52, color: "148,255,209", delay: 0.8 },
  { x: 0.93, y: 0.36, color: "235,196,124", delay: 0.86 },
]

const ARCS: Array<[number, number]> = [
  [0, 5],
  [2, 8],
  [4, 10],
  [6, 11],
]

type IntroSequenceProps = {
  onComplete: () => void
}

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [showSkip, setShowSkip] = useState(false)
  const [exiting, setExiting] = useState(false)
  const completedRef = useRef(false)

  const complete = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    setExiting(true)
    window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1")
      } catch {
        // ignore
      }
      onComplete()
    }, 420)
  }, [onComplete])

  useEffect(() => {
    if (prefersReducedMotion) {
      complete()
      return
    }

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const context = canvas.getContext("2d")
    if (!context) {
      complete()
      return
    }

    let frame = 0
    let width = 1
    let height = 1
    const start = performance.now()

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

    resize()
    window.addEventListener("resize", resize)

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      context.clearRect(0, 0, width, height)

      const cx = width * 0.5
      const cy = height * 0.5
      const globeR = Math.min(width, height) * 0.34

      const fadeIn = t < 0.24 ? t / 0.24 : 1
      const fadeOut = t > 0.82 ? Math.max(0, 1 - (t - 0.82) / 0.18) : 1
      const globeOpacity = fadeIn * fadeOut

      context.save()
      context.globalAlpha = Math.max(0, globeOpacity)
      context.strokeStyle = "rgba(148,255,209,0.28)"
      context.lineWidth = 1
      context.beginPath()
      context.ellipse(cx, cy, globeR, globeR * 0.62, 0, 0, Math.PI * 2)
      context.stroke()
      for (let i = -2; i <= 2; i++) {
        const yy = cy + i * globeR * 0.22
        const band = Math.max(0, 1 - Math.abs(i) * 0.35)
        const halfW = globeR * band
        if (halfW <= 0) continue
        context.beginPath()
        context.moveTo(cx - halfW, yy)
        context.lineTo(cx + halfW, yy)
        context.strokeStyle = "rgba(148,255,209,0.12)"
        context.stroke()
      }
      context.restore()

      if (t > 0.22 && t < 0.9) {
        const scanT = (t - 0.22) / 0.68
        const scanX = cx - globeR + scanT * globeR * 2
        const scanGrad = context.createLinearGradient(
          scanX - 60,
          0,
          scanX + 60,
          0
        )
        scanGrad.addColorStop(0, "rgba(148,255,209,0)")
        scanGrad.addColorStop(0.5, "rgba(148,255,209,0.55)")
        scanGrad.addColorStop(1, "rgba(148,255,209,0)")
        context.fillStyle = scanGrad
        context.fillRect(scanX - 60, cy - globeR * 0.62, 120, globeR * 1.24)
      }

      const bounds = {
        left: cx - globeR,
        top: cy - globeR * 0.62,
        w: globeR * 2,
        h: globeR * 1.24,
      }
      for (const pin of PINS) {
        if (t < pin.delay) continue
        const pinT = Math.min(1, (t - pin.delay) / 0.14)
        const px = bounds.left + pin.x * bounds.w
        const py = bounds.top + pin.y * bounds.h
        const size = 2 + pinT * 3
        const bloom = context.createRadialGradient(
          px,
          py,
          0,
          px,
          py,
          size * 4.5
        )
        bloom.addColorStop(0, `rgba(${pin.color},${0.55 * pinT})`)
        bloom.addColorStop(1, `rgba(${pin.color},0)`)
        context.fillStyle = bloom
        context.beginPath()
        context.arc(px, py, size * 4.5, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = `rgba(${pin.color},${0.95 * pinT})`
        context.beginPath()
        context.arc(px, py, size, 0, Math.PI * 2)
        context.fill()
      }

      for (let i = 0; i < ARCS.length; i++) {
        const [a, b] = ARCS[i]
        const arcStart = 0.55 + i * 0.06
        if (t < arcStart) continue
        const arcT = Math.min(1, (t - arcStart) / 0.28)
        const ax = bounds.left + PINS[a].x * bounds.w
        const ay = bounds.top + PINS[a].y * bounds.h
        const bx = bounds.left + PINS[b].x * bounds.w
        const by = bounds.top + PINS[b].y * bounds.h
        const mx = (ax + bx) / 2
        const my = (ay + by) / 2 - 40
        context.strokeStyle = `rgba(148,255,209,${0.35 * arcT})`
        context.lineWidth = 1.4
        context.beginPath()
        context.moveTo(ax, ay)
        const endX = ax + (bx - ax) * arcT
        const endY = ay + (by - ay) * arcT
        context.quadraticCurveTo(mx, my, endX, endY)
        context.stroke()
      }

      if (t >= 1) {
        complete()
        return
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)

    const skipTimer = window.setTimeout(() => setShowSkip(true), 800)
    const onAnyKey = () => complete()
    window.addEventListener("keydown", onAnyKey)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
      window.clearTimeout(skipTimer)
      window.removeEventListener("keydown", onAnyKey)
    }
  }, [complete, prefersReducedMotion])

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center bg-[#05090c] transition-opacity duration-[420ms]",
        exiting ? "pointer-events-none opacity-0" : "opacity-100"
      )}
      onClick={() => complete()}
      aria-hidden
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <GreenChainLogo variant="onDark" className="h-10 w-auto md:h-12" />
      </div>
      {showSkip && !exiting && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            complete()
          }}
          className="absolute right-6 bottom-6 text-xs tracking-[0.3em] text-white/50 uppercase transition-colors hover:text-white"
        >
          Skip intro
        </button>
      )}
    </div>
  )
}

export function hasSeenIntro(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1"
  } catch {
    return false
  }
}
