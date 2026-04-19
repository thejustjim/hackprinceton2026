"use client"

import {
  type ComponentProps,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

function ResizablePanelGroup({
  className,
  ...props
}: ComponentProps<typeof ResizablePrimitive.Group>) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel({
  ...props
}: ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:h-1 [&[aria-orientation=horizontal]>div]:w-6",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
      )}
    </ResizablePrimitive.Separator>
  )
}

function useSmoothedHandleIndicator(
  containerRef: RefObject<HTMLElement | null>
) {
  const MAX_VISUAL_LAG_PX = 6
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  )
  const [targetPosition, setTargetPosition] = useState<{
    x: number
    y: number
  } | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const animateRef = useRef<() => void>(() => {})
  const currentRef = useRef<{ x: number; y: number } | null>(null)
  const targetRef = useRef<{ x: number; y: number } | null>(null)

  const animate = useCallback(() => {
    const current = currentRef.current
    const target = targetRef.current

    if (!current || !target) {
      animationFrameRef.current = null
      return
    }

    const deltaX = target.x - current.x
    const deltaY = target.y - current.y
    const nextPosition =
      Math.abs(deltaX) < 0.35 && Math.abs(deltaY) < 0.35
        ? target
        : {
            x: current.x + deltaX * 0.22,
            y: current.y + deltaY * 0.22,
          }
    const clampedPosition = {
      x: Math.min(
        target.x + MAX_VISUAL_LAG_PX,
        Math.max(target.x - MAX_VISUAL_LAG_PX, nextPosition.x)
      ),
      y: Math.min(
        target.y + MAX_VISUAL_LAG_PX,
        Math.max(target.y - MAX_VISUAL_LAG_PX, nextPosition.y)
      ),
    }

    currentRef.current = clampedPosition
    setPosition(clampedPosition)

    if (
      Math.abs(target.x - clampedPosition.x) >= 0.35 ||
      Math.abs(target.y - clampedPosition.y) >= 0.35
    ) {
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animateRef.current()
      })
      return
    }

    animationFrameRef.current = null
  }, [])

  useEffect(() => {
    animateRef.current = animate
  }, [animate])

  const measure = useCallback(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const handle = container.querySelector(
      "[data-group] > [data-slot='resizable-handle']"
    ) as HTMLElement | null

    if (!handle) {
      return
    }

    const containerBounds = container.getBoundingClientRect()
    const handleBounds = handle.getBoundingClientRect()
    const nextTarget = {
      x: handleBounds.left - containerBounds.left + handleBounds.width / 2,
      y: handleBounds.top - containerBounds.top + handleBounds.height / 2,
    }

    targetRef.current = nextTarget
    setTargetPosition(nextTarget)

    if (!currentRef.current) {
      currentRef.current = nextTarget
      setPosition(nextTarget)
      return
    }

    if (animationFrameRef.current === null) {
      animationFrameRef.current = window.requestAnimationFrame(animate)
    }
  }, [animate, containerRef])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(measure)

    return () => window.cancelAnimationFrame(frameId)
  }, [measure])

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const observer = new ResizeObserver(() => {
      measure()
    })

    observer.observe(container)
    window.addEventListener("resize", measure)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [containerRef, measure])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return {
    measure,
    position,
    targetPosition,
  }
}

export {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useSmoothedHandleIndicator,
}
