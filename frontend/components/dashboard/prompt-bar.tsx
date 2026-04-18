"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiGenerativeIcon,
  Message02Icon,
  SearchList01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"

export function PromptBar() {
  return (
    <div className="panel-glow rounded-[1.65rem] border border-border/80 bg-background/75 p-2 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
        <Button variant="outline" size="xs">
          <HugeiconsIcon
            icon={AiGenerativeIcon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Route simulation
        </Button>
        <Button variant="ghost" size="xs">
          <HugeiconsIcon
            icon={SearchList01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Trace tier-one dependencies
        </Button>
        <Button variant="ghost" size="xs">
          <HugeiconsIcon
            icon={Message02Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Surface hidden constraints
        </Button>
      </div>
      <InputGroup className="h-12 rounded-[1.35rem] border-border/80 bg-card/70">
        <InputGroupAddon>
          <InputGroupText>
            <HugeiconsIcon icon={AiGenerativeIcon} strokeWidth={2} />
            Analyst copilot
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          readOnly
          value="Explain upstream risk propagation if Leipzig Pack Forge loses another coating line."
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            variant="secondary"
            size="icon-sm"
            aria-label="Attach context"
          >
            <HugeiconsIcon icon={SearchList01Icon} strokeWidth={2} />
          </InputGroupButton>
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
