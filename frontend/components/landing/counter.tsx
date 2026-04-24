"use client"

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

export function Counter({
  from = 0,
  to,
  progress,
  decimals = 0,
  suffix = "",
  className,
}: {
  from?: number
  to: number
  progress: number
  decimals?: number
  suffix?: string
  className?: string
}) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const effective = prefersReducedMotion
    ? 1
    : Math.max(0, Math.min(1, progress))
  const value = from + (to - from) * effective
  return (
    <span className={className}>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  )
}
