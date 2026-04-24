"use client"

import { useEffect } from "react"
import Lenis from "lenis"

export function useLenis({ disabled }: { disabled: boolean }) {
  useEffect(() => {
    if (disabled) return
    if (typeof window === "undefined") return
    if (window.innerWidth < 768) return

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
    })

    let frame = 0
    const raf = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frame)
      lenis.destroy()
    }
  }, [disabled])
}
