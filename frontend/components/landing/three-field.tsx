"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

export function ThreeField({ disabled }: { disabled: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (disabled) return

    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    const randomBetween = (min: number, max: number) =>
      min + Math.random() * (max - min)
    const lerp = (from: number, to: number, amount: number) =>
      from + (to - from) * amount

    const orbiters = Array.from({ length: 16 }, (_, index) => ({
      radiusX: randomBetween(110, 270),
      radiusY: randomBetween(60, 185),
      size: randomBetween(1.8, 4.8),
      speed: randomBetween(0.12, 0.36) * (index % 2 === 0 ? 1 : -1),
      phase: randomBetween(0, Math.PI * 2),
      alpha: randomBetween(0.24, 0.58),
      color:
        index % 3 === 0
          ? "148,255,209"
          : index % 3 === 1
            ? "110,214,255"
            : "200,255,235",
    }))
    const dust = Array.from({ length: 180 }, () => ({
      radiusX: randomBetween(130, 520),
      radiusY: randomBetween(90, 310),
      size: randomBetween(0.6, 2.2),
      speed: randomBetween(0.03, 0.11),
      phase: randomBetween(0, Math.PI * 2),
      offset: randomBetween(-0.8, 0.8),
      alpha: randomBetween(0.08, 0.22),
    }))

    const pointerTarget = { x: 0, y: 0 }
    const pointerCurrent = { x: 0, y: 0 }
    let width = 1
    let height = 1
    let frame = 0
    let start = performance.now()

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      pointerTarget.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointerTarget.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    }

    const onPointerLeave = () => {
      pointerTarget.x = 0
      pointerTarget.y = 0
    }

    const resize = () => {
      const rect = container.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      width = rect.width
      height = rect.height

      const dpr = Math.min(window.devicePixelRatio || 1, 1.8)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener("resize", resize)
    container.addEventListener("pointermove", onPointerMove)
    container.addEventListener("pointerleave", onPointerLeave)

    const tick = (now: number) => {
      const elapsed = (now - start) / 1000
      pointerCurrent.x = lerp(pointerCurrent.x, pointerTarget.x, 0.075)
      pointerCurrent.y = lerp(pointerCurrent.y, pointerTarget.y, 0.075)

      context.clearRect(0, 0, width, height)

      const centerX = width * 0.5 + pointerCurrent.x * 28
      const centerY = height * 0.38 - pointerCurrent.y * 18
      const radius = Math.min(width, height) * 0.14

      const glow = context.createRadialGradient(
        centerX,
        centerY,
        radius * 0.08,
        centerX,
        centerY,
        radius * 4.2
      )
      glow.addColorStop(0, "rgba(145,255,208,0.24)")
      glow.addColorStop(0.34, "rgba(86,231,173,0.10)")
      glow.addColorStop(0.7, "rgba(85,170,255,0.06)")
      glow.addColorStop(1, "rgba(0,0,0,0)")
      context.fillStyle = glow
      context.fillRect(0, 0, width, height)

      for (const mote of dust) {
        const angle = mote.phase + elapsed * mote.speed
        const x =
          centerX +
          Math.cos(angle) * mote.radiusX +
          pointerCurrent.x * mote.radiusX * 0.05
        const y =
          centerY +
          Math.sin(angle * 1.3 + mote.offset) * mote.radiusY +
          pointerCurrent.y * mote.radiusY * 0.04

        context.beginPath()
        context.fillStyle = `rgba(148,255,209,${mote.alpha})`
        context.arc(x, y, mote.size, 0, Math.PI * 2)
        context.fill()
      }

      context.save()
      context.translate(centerX, centerY)
      context.rotate(elapsed * 0.12 + pointerCurrent.x * 0.18)
      context.strokeStyle = "rgba(172,255,224,0.16)"
      context.lineWidth = 1.2
      context.beginPath()
      context.ellipse(0, 0, radius * 1.85, radius * 1.18, 0.35, 0, Math.PI * 2)
      context.stroke()

      context.rotate(-elapsed * 0.2 + 0.7)
      context.strokeStyle = "rgba(108,214,255,0.16)"
      context.beginPath()
      context.ellipse(0, 0, radius * 1.42, radius * 2.1, 0.2, 0, Math.PI * 2)
      context.stroke()
      context.restore()

      const layers = [
        {
          scale: 1.1,
          stroke: "rgba(184,255,226,0.22)",
          rotation: elapsed * 0.42,
        },
        {
          scale: 0.9,
          stroke: "rgba(98,245,174,0.28)",
          rotation: -elapsed * 0.58 + 0.5,
        },
        {
          scale: 0.7,
          stroke: "rgba(95,208,255,0.18)",
          rotation: elapsed * 0.75 + 1.1,
        },
      ] as const

      for (const layer of layers) {
        context.save()
        context.translate(centerX, centerY)
        context.rotate(layer.rotation + pointerCurrent.x * 0.12)
        context.beginPath()

        for (let index = 0; index <= 10; index += 1) {
          const angle = (index / 10) * Math.PI * 2
          const wobble =
            1 + Math.sin(angle * 3 + elapsed * 1.2 + layer.scale) * 0.14
          const currentRadius = radius * layer.scale * wobble
          const x = Math.cos(angle) * currentRadius
          const y = Math.sin(angle) * currentRadius * 0.84

          if (index === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        }

        context.closePath()
        context.strokeStyle = layer.stroke
        context.lineWidth = 1
        context.stroke()
        context.restore()
      }

      for (const orbiter of orbiters) {
        const angle = orbiter.phase + elapsed * orbiter.speed
        const x =
          centerX +
          Math.cos(angle) * orbiter.radiusX +
          pointerCurrent.x * orbiter.radiusX * 0.08
        const y =
          centerY +
          Math.sin(angle * 1.2) * orbiter.radiusY +
          pointerCurrent.y * orbiter.radiusY * 0.06

        const bloom = context.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          orbiter.size * 4.8
        )
        bloom.addColorStop(0, `rgba(${orbiter.color},${orbiter.alpha})`)
        bloom.addColorStop(
          0.35,
          `rgba(${orbiter.color},${orbiter.alpha * 0.45})`
        )
        bloom.addColorStop(1, `rgba(${orbiter.color},0)`)

        context.fillStyle = bloom
        context.beginPath()
        context.arc(x, y, orbiter.size * 4.8, 0, Math.PI * 2)
        context.fill()

        context.fillStyle = `rgba(${orbiter.color},${Math.min(orbiter.alpha + 0.2, 0.9)})`
        context.beginPath()
        context.arc(x, y, orbiter.size, 0, Math.PI * 2)
        context.fill()
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame((now) => {
      start = now
      tick(now)
    })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
      container.removeEventListener("pointermove", onPointerMove)
      container.removeEventListener("pointerleave", onPointerLeave)
    }
  }, [disabled])

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className={cn(
          "h-full w-full transition-opacity duration-700 ease-out",
          disabled ? "opacity-45" : "opacity-100"
        )}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,_rgba(147,255,210,0.12),_transparent_42%),radial-gradient(circle_at_68%_24%,_rgba(126,190,255,0.08),_transparent_36%)]" />
    </div>
  )
}
