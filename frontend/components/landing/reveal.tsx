"use client"

import { cn } from "@/lib/utils"
import { useInView } from "@/hooks/use-in-view"

export function Reveal({
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
      className={cn(
        "transition-all duration-[1150ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        className
      )}
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
