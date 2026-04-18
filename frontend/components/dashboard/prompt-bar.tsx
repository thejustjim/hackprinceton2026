"use client"

import { type ComponentProps, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Message02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface PromptBarProps extends ComponentProps<"div"> {
  prompt?: string
}

export function PromptBar({
  className,
  prompt = "Ask the graph what breaks first if a node drops, which route carries the highest carbon risk, or where to reroute for the cleanest recovery.",
  ...props
}: PromptBarProps) {
  const [value, setValue] = useState(prompt)

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/8 bg-black/24 p-2 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-11 flex-1 rounded-xl border-white/8 bg-black/22 shadow-none"
        />
        <Button size="default" className="shrink-0 rounded-xl shadow-none">
          <HugeiconsIcon
            icon={Message02Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Submit
        </Button>
      </div>
    </div>
  )
}
