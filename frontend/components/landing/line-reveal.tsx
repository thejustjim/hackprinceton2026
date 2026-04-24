"use client"

import { cn } from "@/lib/utils"

export function LineReveal({
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
        <div key={index} className="overflow-hidden pr-[0.04em]">
          <div
            className={cn(lineClass, "pb-[0.42em]")}
            style={{
              opacity: active ? 1 : 0,
              transform: active ? "translateY(0%)" : "translateY(118%)",
              transition:
                "transform 1.45s cubic-bezier(0.16,1,0.3,1), opacity 1.05s ease",
              transitionDelay: `${delay + index * 180}ms`,
            }}
          >
            {line}
          </div>
        </div>
      ))}
    </div>
  )
}
