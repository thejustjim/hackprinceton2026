"use client"

import { useScrollProgress } from "@/hooks/use-scroll-progress"

export function ScrollScene({
  totalVh = 300,
  className,
  children,
}: {
  totalVh?: number
  className?: string
  children: (progress: number) => React.ReactNode
}) {
  const { ref, progress } = useScrollProgress<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={className}
      style={{ height: `${totalVh}vh`, position: "relative" }}
    >
      <div
        className="sticky top-0 flex h-[100svh] w-full items-center justify-center overflow-hidden"
        style={{ contain: "paint" }}
      >
        {children(progress)}
      </div>
    </div>
  )
}
