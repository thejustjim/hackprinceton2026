"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { AiGenerativeIcon, Message02Icon } from "@hugeicons/core-free-icons"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"

export function PromptBar() {
  return (
    <div className="rounded-xl border border-border/70 bg-background/92 p-2">
      <InputGroup className="h-11 rounded-lg border-border/70 bg-transparent">
        <InputGroupAddon>
          <InputGroupText>
            <HugeiconsIcon icon={AiGenerativeIcon} strokeWidth={2} />
            Prompt
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          readOnly
          value="Explain upstream risk propagation if Leipzig Pack Forge loses another coating line."
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton variant="default" size="sm">
            <HugeiconsIcon
              icon={Message02Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Run
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
