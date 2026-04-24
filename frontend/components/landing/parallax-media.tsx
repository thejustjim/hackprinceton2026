"use client"

import { useEffect, useEffectEvent, useRef } from "react"
import Image from "next/image"

import { clamp } from "@/components/landing/landing-constants"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"

export function ParallaxMedia({
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
      1
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
      <div
        ref={mediaRef}
        className="absolute inset-[-12%] will-change-transform"
      >
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
