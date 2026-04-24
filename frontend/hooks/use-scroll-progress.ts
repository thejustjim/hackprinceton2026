"use client"

import { useEffect, useRef, useState } from "react"

import { clamp } from "@/components/landing/landing-constants"

export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let frame = 0

    const update = () => {
      const rect = element.getBoundingClientRect()
      const viewportHeight = window.innerHeight || 1
      const total = rect.height + viewportHeight
      const traveled = viewportHeight - rect.top
      setProgress(clamp(traveled / total, 0, 1))
    }

    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  return { ref, progress }
}
