"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  Cancel01Icon,
  Factory01Icon,
  Leaf01Icon,
  Maximize02Icon,
  PuzzleIcon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  type SupplyScenario,
  type SupplyScenarioGraphNode,
  type SupplyScenarioSelectableNodeId,
} from "@/lib/supply-chain-scenario"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Data + types
// ---------------------------------------------------------------------------

type GraphNodeState = SupplyScenarioGraphNode
const NODE_SNAP_DURATION_MS = 1100

interface GraphViewportSize {
  height: number
  width: number
}

// ---------------------------------------------------------------------------
// Design helpers
// ---------------------------------------------------------------------------

const CERT_LABELS: Record<string, string> = {
  iso14001: "ISO 14001",
  sbt: "SBT",
  cdp_a: "CDP A-List",
}

function getManufacturerStatusPresentation(isCurrent: boolean) {
  return isCurrent
    ? {
        badgeBackground: "rgba(252,211,77,0.1)",
        badgeBorder: "rgba(252,211,77,0.22)",
        badgeText: "#FCD34D",
        label: "CURRENT",
        pulseClassName: "bg-amber-300",
      }
    : {
        badgeBackground: "rgba(52,211,153,0.1)",
        badgeBorder: "rgba(52,211,153,0.22)",
        badgeText: "#34D399",
        label: "ALTERNATE",
        pulseClassName: "bg-emerald-400",
      }
}

function getEcoConfig(score: number) {
  if (score < 40)
    return {
      color: "#34d399",
      glow: "0 0 18px rgba(52,211,153,0.45)",
      ring: "rgba(52,211,153,0.35)",
      bg: "rgba(52,211,153,0.08)",
      text: "#34d399",
      label: "Low Impact",
    }
  if (score < 60)
    return {
      color: "#fbbf24",
      glow: "0 0 18px rgba(251,191,36,0.40)",
      ring: "rgba(251,191,36,0.35)",
      bg: "rgba(251,191,36,0.08)",
      text: "#fbbf24",
      label: "Moderate",
    }
  return {
    color: "#f87171",
    glow: "0 0 18px rgba(248,113,113,0.40)",
    ring: "rgba(248,113,113,0.35)",
    bg: "rgba(248,113,113,0.08)",
    text: "#f87171",
    label: "High Impact",
  }
}

function getNodeSize(node: GraphNodeState) {
  const d = node.data
  if (d.kind === "product") return { w: 136, h: 100 }
  if (d.kind === "manufacturer") return { w: 252, h: 120 }
  return { w: 168, h: 68 }
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getNodeMobility(node: GraphNodeState) {
  if (node.data.kind === "product") {
    return 0
  }

  if (node.data.kind === "component") {
    return 0.5
  }

  return 1
}

function getNodeCenter(
  node: GraphNodeState,
  position: { x: number; y: number } = node.position
) {
  const { w, h } = getNodeSize(node)

  return {
    x: position.x + w / 2,
    y: position.y + h / 2,
  }
}

function getLayoutConfig(viewport: GraphViewportSize | null) {
  const width = viewport?.width ?? 1200
  const height = viewport?.height ?? 900
  const compactness = clamp((960 - Math.min(width, height)) / 360, 0, 1)

  return {
    componentPull: 0.56 - compactness * 0.09,
    fitPaddingX: 112 - compactness * 34,
    fitPaddingY: 96 - compactness * 28,
    fitZoomBoost: 1.05 + compactness * 0.12,
    manufacturerPull: 0.44 - compactness * 0.12,
    paddingX: 26 - compactness * 8,
    paddingY: 24 - compactness * 7,
  }
}

function clonePositionsMap(nodes: GraphNodeState[]) {
  return new Map(nodes.map((node) => [node.id, { ...node.position }]))
}

function buildCompactGraphNodes(
  nodes: GraphNodeState[],
  viewport: GraphViewportSize | null
) {
  const productNode = nodes.find((node) => node.data.kind === "product")

  if (!productNode) {
    return nodes
  }

  const config = getLayoutConfig(viewport)
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const))
  const anchorPositions = new Map<string, { x: number; y: number }>()
  const productAnchor = { ...productNode.position }

  anchorPositions.set(productNode.id, productAnchor)

  nodes.forEach((node) => {
    if (node.data.kind !== "component") {
      return
    }

    anchorPositions.set(node.id, {
      x:
        productAnchor.x +
        (node.position.x - productAnchor.x) * config.componentPull,
      y:
        productAnchor.y +
        (node.position.y - productAnchor.y) * config.componentPull,
    })
  })

  nodes.forEach((node) => {
    if (node.data.kind !== "manufacturer") {
      return
    }

    const sourceComponent = nodeById.get(node.data.componentId)
    const sourceComponentPosition = sourceComponent?.position ?? productAnchor
    const compactComponentPosition =
      anchorPositions.get(node.data.componentId) ?? sourceComponentPosition

    anchorPositions.set(node.id, {
      x:
        compactComponentPosition.x +
        (node.position.x - sourceComponentPosition.x) * config.manufacturerPull,
      y:
        compactComponentPosition.y +
        (node.position.y - sourceComponentPosition.y) * config.manufacturerPull,
    })
  })

  const positionedNodes = nodes.map((node) => ({
    ...node,
    position: anchorPositions.get(node.id) ?? node.position,
  }))

  return relaxNodeLayout(positionedNodes, anchorPositions, config)
}

function relaxNodeLayout(
  nodes: GraphNodeState[],
  anchors: Map<string, { x: number; y: number }>,
  config: ReturnType<typeof getLayoutConfig>
) {
  const positions = clonePositionsMap(nodes)

  for (let iteration = 0; iteration < 20; iteration += 1) {
    let totalShift = 0

    for (let index = 0; index < nodes.length; index += 1) {
      for (
        let otherIndex = index + 1;
        otherIndex < nodes.length;
        otherIndex += 1
      ) {
        const node = nodes[index]
        const otherNode = nodes[otherIndex]
        const nodePosition = positions.get(node.id) ?? node.position
        const otherPosition = positions.get(otherNode.id) ?? otherNode.position
        const nodeCenter = getNodeCenter(node, nodePosition)
        const otherCenter = getNodeCenter(otherNode, otherPosition)
        const { w: nodeWidth, h: nodeHeight } = getNodeSize(node)
        const { w: otherWidth, h: otherHeight } = getNodeSize(otherNode)
        const deltaX = nodeCenter.x - otherCenter.x
        const deltaY = nodeCenter.y - otherCenter.y
        const overlapX =
          nodeWidth / 2 + otherWidth / 2 + config.paddingX - Math.abs(deltaX)
        const overlapY =
          nodeHeight / 2 + otherHeight / 2 + config.paddingY - Math.abs(deltaY)

        if (overlapX <= 0 || overlapY <= 0) {
          continue
        }

        const nodeMobility = getNodeMobility(node)
        const otherMobility = getNodeMobility(otherNode)
        const totalMobility = nodeMobility + otherMobility || 1
        const nodeAnchor = anchors.get(node.id) ?? node.position
        const otherAnchor = anchors.get(otherNode.id) ?? otherNode.position

        if (overlapX < overlapY) {
          const direction =
            deltaX === 0
              ? nodeAnchor.x >= otherAnchor.x
                ? 1
                : -1
              : Math.sign(deltaX)
          const shift = overlapX + 0.5

          if (nodeMobility > 0) {
            nodePosition.x += direction * shift * (nodeMobility / totalMobility)
          }

          if (otherMobility > 0) {
            otherPosition.x -=
              direction * shift * (otherMobility / totalMobility)
          }

          totalShift += shift
        } else {
          const direction =
            deltaY === 0
              ? nodeAnchor.y >= otherAnchor.y
                ? 1
                : -1
              : Math.sign(deltaY)
          const shift = overlapY + 0.5

          if (nodeMobility > 0) {
            nodePosition.y += direction * shift * (nodeMobility / totalMobility)
          }

          if (otherMobility > 0) {
            otherPosition.y -=
              direction * shift * (otherMobility / totalMobility)
          }

          totalShift += shift
        }

        positions.set(node.id, nodePosition)
        positions.set(otherNode.id, otherPosition)
      }
    }

    nodes.forEach((node) => {
      const mobility = getNodeMobility(node)

      if (mobility === 0) {
        return
      }

      const anchor = anchors.get(node.id)
      const position = positions.get(node.id) ?? node.position

      if (!anchor) {
        return
      }

      const spring = node.data.kind === "component" ? 0.1 : 0.06

      position.x += (anchor.x - position.x) * spring
      position.y += (anchor.y - position.y) * spring
      positions.set(node.id, position)
    })

    if (totalShift < 0.5) {
      break
    }
  }

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }))
}

function resolveNodeSettleTarget(
  nodeId: string,
  nodes: GraphNodeState[],
  anchors: Map<string, { x: number; y: number }>
) {
  const node = nodes.find((candidate) => candidate.id === nodeId)

  if (!node) {
    return null
  }

  const anchor = anchors.get(nodeId) ?? node.position
  const target = { ...node.position }
  const { w: nodeWidth, h: nodeHeight } = getNodeSize(node)

  for (let iteration = 0; iteration < 18; iteration += 1) {
    let shifted = false

    for (const otherNode of nodes) {
      if (otherNode.id === nodeId) {
        continue
      }

      const otherCenter = getNodeCenter(otherNode)
      const nodeCenter = getNodeCenter(node, target)
      const { w: otherWidth, h: otherHeight } = getNodeSize(otherNode)
      const deltaX = nodeCenter.x - otherCenter.x
      const deltaY = nodeCenter.y - otherCenter.y
      const overlapX = nodeWidth / 2 + otherWidth / 2 + 18 - Math.abs(deltaX)
      const overlapY = nodeHeight / 2 + otherHeight / 2 + 14 - Math.abs(deltaY)

      if (overlapX <= 0 || overlapY <= 0) {
        continue
      }

      shifted = true

      if (overlapX < overlapY) {
        const direction =
          deltaX === 0
            ? anchor.x >= otherNode.position.x
              ? 1
              : -1
            : Math.sign(deltaX)
        target.x += direction * (overlapX + 0.5)
      } else {
        const direction =
          deltaY === 0
            ? anchor.y >= otherNode.position.y
              ? 1
              : -1
            : Math.sign(deltaY)
        target.y += direction * (overlapY + 0.5)
      }
    }

    if (!shifted) {
      break
    }
  }

  return target
}

function getGraphBounds(nodes: GraphNodeState[]) {
  if (nodes.length === 0) {
    return {
      bottom: 0,
      centerX: 0,
      centerY: 0,
      height: 1,
      left: 0,
      right: 0,
      top: 0,
      width: 1,
    }
  }

  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  nodes.forEach((node) => {
    const { w, h } = getNodeSize(node)

    left = Math.min(left, node.position.x)
    top = Math.min(top, node.position.y)
    right = Math.max(right, node.position.x + w)
    bottom = Math.max(bottom, node.position.y + h)
  })

  return {
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    height: Math.max(1, bottom - top),
    left,
    right,
    top,
    width: Math.max(1, right - left),
  }
}

function getFitTransform(
  nodes: GraphNodeState[],
  viewport: GraphViewportSize | null
) {
  const width = viewport?.width ?? 0
  const height = viewport?.height ?? 0

  if (!width || !height) {
    return null
  }

  const config = getLayoutConfig(viewport)
  const bounds = getGraphBounds(nodes)
  const availableWidth = Math.max(1, width - config.fitPaddingX * 2)
  const availableHeight = Math.max(1, height - config.fitPaddingY * 2)
  const fittedScale = Math.min(
    availableWidth / bounds.width,
    availableHeight / bounds.height
  )
  const scale = clamp(fittedScale * config.fitZoomBoost, 0.52, 1.28)

  return {
    scale,
    x: width / 2 - bounds.centerX * scale,
    y: height / 2 - bounds.centerY * scale,
  }
}

// Intersection of a ray from node centre with its boundary
function getIntersection(node: GraphNodeState, dx: number, dy: number) {
  const { w, h } = getNodeSize(node)
  const cx = node.position.x + w / 2
  const cy = node.position.y + h / 2
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const pad = 10
  const d = node.data
  if (d.kind === "product") {
    const r = w / 2 + pad
    const dist = Math.hypot(dx, dy)
    return { x: cx + (dx / dist) * r, y: cy + (dy / dist) * r }
  }
  const hw = w / 2 + pad
  const hh = h / 2 + pad
  const sx = dx !== 0 ? Math.abs(hw / dx) : Infinity
  const sy = dy !== 0 ? Math.abs(hh / dy) : Infinity
  const s = Math.min(sx, sy)
  return { x: cx + dx * s, y: cy + dy * s }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EcoScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const cfg = getEcoConfig(score)
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const fill = circ * (1 - score / 100)
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={cfg.color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={fill}
        style={{
          filter: `drop-shadow(0 0 6px ${cfg.color})`,
          transition: "stroke-dashoffset 1s cubic-bezier(0.34,1.56,0.64,1)",
        }}
        className="eco-arc"
      />
    </svg>
  )
}

interface EdgeProps {
  drawDelay: number
  flowActive: boolean
  sourceNode: GraphNodeState
  targetNode: GraphNodeState
  selected: boolean
  hovered: boolean
}

function ConnectionEdge({
  drawDelay,
  flowActive,
  sourceNode,
  targetNode,
  selected,
  hovered,
}: EdgeProps) {
  const { w: sw, h: sh } = getNodeSize(sourceNode)
  const { w: tw, h: th } = getNodeSize(targetNode)
  const sc = {
    x: sourceNode.position.x + sw / 2,
    y: sourceNode.position.y + sh / 2,
  }
  const tc = {
    x: targetNode.position.x + tw / 2,
    y: targetNode.position.y + th / 2,
  }
  const dx = tc.x - sc.x
  const dy = tc.y - sc.y
  if (Math.hypot(dx, dy) < 10) return null
  const start = getIntersection(sourceNode, dx, dy)
  const end = getIntersection(targetNode, -dx, -dy)
  const path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`
  const markerId = selected ? "arrow-sel" : hovered ? "arrow-hov" : "arrow-def"

  return (
    <g>
      {/* Wide invisible hit area */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
      />
      {/* Glow layer when active */}
      {(selected || hovered) && (
        <path
          d={path}
          fill="none"
          stroke={
            selected ? "rgba(233,224,255,0.34)" : "rgba(226,220,235,0.16)"
          }
          strokeWidth={selected ? 9 : 6}
          style={{ filter: selected ? "blur(6px)" : "blur(3px)" }}
        />
      )}
      {/* Main stroke */}
      <path
        d={path}
        fill="none"
        stroke={
          selected
            ? "#F1E9FF"
            : hovered
              ? "rgba(228,219,250,0.88)"
              : "rgba(214,207,224,0.68)"
        }
        pathLength={100}
        strokeDasharray="100"
        strokeWidth={selected ? 2.6 : hovered ? 2.1 : 1.8}
        markerEnd={`url(#${markerId})`}
        className="edge-draw"
        style={{
          animationDelay: `${drawDelay}s`,
          transition: "stroke 0.2s, stroke-width 0.2s",
        }}
      />
      {/* Animated flow particles when selected */}
      <path
        d={path}
        fill="none"
        stroke="rgba(226,220,235,0.14)"
        strokeWidth={0.9}
        strokeDasharray="7 30"
        className="edge-flow-ambient"
      />
      {(selected || flowActive) && (
        <path
          d={path}
          fill="none"
          stroke={
            selected ? "rgba(255,250,255,0.94)" : "rgba(233,224,255,0.48)"
          }
          strokeWidth={selected ? 1.8 : 1.2}
          strokeDasharray={selected ? "5 14" : "6 18"}
          className={selected ? "edge-flow" : "edge-flow-subtle"}
        />
      )}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Main graph component
// ---------------------------------------------------------------------------

interface SupplyChainGraphProps {
  hoveredNodeId: SupplyScenarioSelectableNodeId | null
  onHoverNode: (nodeId: SupplyScenarioSelectableNodeId | null) => void
  onSelectNode: (nodeId: SupplyScenarioSelectableNodeId | null) => void
  scenario: SupplyScenario
  selectedNodeId: SupplyScenarioSelectableNodeId | null
}

export function SupplyChainGraph({
  hoveredNodeId,
  onHoverNode,
  onSelectNode,
  scenario,
  selectedNodeId,
}: SupplyChainGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const snapFrameRef = useRef<number | null>(null)
  const snapNodeIdRef = useRef<string | null>(null)
  const layoutAnchorsRef = useRef(new Map<string, { x: number; y: number }>())
  const velRef = useRef({ x: 0, y: 0, ts: 0, lx: 0, ly: 0 })
  const [viewportSize, setViewportSize] = useState<GraphViewportSize | null>(
    null
  )
  const layoutNodes = React.useMemo(
    () => buildCompactGraphNodes(scenario.graph.nodes, viewportSize),
    [scenario.graph.nodes, viewportSize]
  )
  const [nodes, setNodes] = useState<GraphNodeState[]>(layoutNodes)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [dragState, setDragState] = useState<{
    type: "canvas" | "node"
    id?: string
    sx: number
    sy: number
    ix: number
    iy: number
    moved: boolean
  } | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)

  // Measure graph viewport for responsive layout + fit
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateSize = () => {
      const { width, height } = el.getBoundingClientRect()
      setViewportSize((previous) =>
        previous?.width === width && previous?.height === height
          ? previous
          : { width, height }
      )
    }

    updateSize()

    const observer = new ResizeObserver(() => {
      updateSize()
    })

    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    layoutAnchorsRef.current = new Map(
      layoutNodes.map((node) => [node.id, { ...node.position }])
    )
    setNodes(layoutNodes)
  }, [layoutNodes])

  useEffect(() => {
    const fittedTransform = getFitTransform(layoutNodes, viewportSize)

    if (fittedTransform) {
      setTransform(fittedTransform)
    }
  }, [layoutNodes, viewportSize])

  // Show panel with a tick of delay for animation
  useEffect(() => {
    if (selectedNodeId) {
      const t = setTimeout(() => setPanelVisible(true), 10)
      return () => clearTimeout(t)
    } else {
      setPanelVisible(false)
    }
  }, [selectedNodeId])

  // Prevent page scroll on canvas
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const prevent = (e: WheelEvent) => e.preventDefault()
    el.addEventListener("wheel", prevent, { passive: false })
    return () => el.removeEventListener("wheel", prevent)
  }, [])

  const stopInertia = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const stopSnapAnimation = useCallback((nodeId?: string) => {
    if (
      snapFrameRef.current !== null &&
      (!nodeId || !snapNodeIdRef.current || snapNodeIdRef.current === nodeId)
    ) {
      cancelAnimationFrame(snapFrameRef.current)
      snapFrameRef.current = null
      snapNodeIdRef.current = null
    }
  }, [])

  const animateNodeToTarget = useCallback(
    (
      nodeId: string,
      from: { x: number; y: number },
      target: { x: number; y: number }
    ) => {
      if (Math.hypot(target.x - from.x, target.y - from.y) < 0.75) {
        return
      }

      stopSnapAnimation()

      const startTime = performance.now()

      const tick = (timestamp: number) => {
        const progress = Math.min(
          1,
          (timestamp - startTime) / NODE_SNAP_DURATION_MS
        )
        const eased = easeOutCubic(progress)

        setNodes((previousNodes) =>
          previousNodes.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  position: {
                    x: from.x + (target.x - from.x) * eased,
                    y: from.y + (target.y - from.y) * eased,
                  },
                }
              : node
          )
        )

        if (progress < 1) {
          snapFrameRef.current = requestAnimationFrame(tick)
        } else {
          snapFrameRef.current = null
          snapNodeIdRef.current = null
        }
      }

      snapNodeIdRef.current = nodeId
      snapFrameRef.current = requestAnimationFrame(tick)
    },
    [stopSnapAnimation]
  )

  // --- Wheel zoom/pan ---
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      stopInertia()
      setTransform((prev) => {
        if (e.ctrlKey || e.metaKey) {
          const newScale = Math.min(
            Math.max(0.15, prev.scale * Math.exp(-e.deltaY * 0.005)),
            4
          )
          const wx = (e.clientX - prev.x) / prev.scale
          const wy = (e.clientY - prev.y) / prev.scale
          return {
            x: e.clientX - wx * newScale,
            y: e.clientY - wy * newScale,
            scale: newScale,
          }
        }
        return { ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }
      })
    },
    [stopInertia]
  )

  const handleZoom = useCallback((dir: "in" | "out") => {
    setTransform((prev) => {
      const newScale = Math.max(
        0.15,
        Math.min(prev.scale * (dir === "in" ? 1.25 : 0.8), 4)
      )
      const cx = (containerRef.current?.clientWidth ?? 800) / 2
      const cy = (containerRef.current?.clientHeight ?? 600) / 2
      const wx = (cx - prev.x) / prev.scale
      const wy = (cy - prev.y) / prev.scale
      return { scale: newScale, x: cx - wx * newScale, y: cy - wy * newScale }
    })
  }, [])

  const handleFit = useCallback(() => {
    const fittedTransform = getFitTransform(nodes, viewportSize)

    if (fittedTransform) {
      setTransform(fittedTransform)
    }
  }, [nodes, viewportSize])

  // --- Pointer events ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    stopInertia()
    const target = e.target as HTMLElement
    const nodeEl = target.closest(".gc-node") as HTMLElement | null

    if (nodeEl) {
      const nodeId = nodeEl.dataset.nodeId!
      stopSnapAnimation(nodeId)
      const node = nodes.find((n) => n.id === nodeId)!
      setDragState({
        type: "node",
        id: nodeId,
        sx: e.clientX,
        sy: e.clientY,
        ix: node.position.x,
        iy: node.position.y,
        moved: false,
      })
      e.stopPropagation()
      return
    }

    velRef.current = {
      x: 0,
      y: 0,
      ts: performance.now(),
      lx: e.clientX,
      ly: e.clientY,
    }
    setDragState({
      type: "canvas",
      sx: e.clientX,
      sy: e.clientY,
      ix: transform.x,
      iy: transform.y,
      moved: false,
    })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return
    const dx = e.clientX - dragState.sx
    const dy = e.clientY - dragState.sy

    if (dragState.type === "canvas") {
      if (!dragState.moved && Math.hypot(dx, dy) > 4)
        setDragState((p) => p && { ...p, moved: true })
      const now = performance.now()
      const dt = now - velRef.current.ts
      if (dt > 0) {
        velRef.current.x = (e.clientX - velRef.current.lx) / dt
        velRef.current.y = (e.clientY - velRef.current.ly) / dt
      }
      velRef.current.ts = now
      velRef.current.lx = e.clientX
      velRef.current.ly = e.clientY
      setTransform((p) => ({
        ...p,
        x: dragState.ix + dx,
        y: dragState.iy + dy,
      }))
    } else if (dragState.type === "node") {
      if (!dragState.moved && Math.hypot(dx, dy) > 4)
        setDragState((p) => p && { ...p, moved: true })
      const wdx = dx / transform.scale
      const wdy = dy / transform.scale
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragState.id
            ? {
                ...n,
                position: { x: dragState.ix + wdx, y: dragState.iy + wdy },
              }
            : n
        )
      )
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState?.type === "canvas") {
      if (!dragState.moved) {
        onSelectNode(null)
      } else {
        let vx = velRef.current.x * 16
        let vy = velRef.current.y * 16
        const animate = () => {
          if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) return
          vx *= 0.92
          vy *= 0.92
          setTransform((p) => ({ ...p, x: p.x + vx, y: p.y + vy }))
          rafRef.current = requestAnimationFrame(animate)
        }
        if (Math.abs(vx) > 1 || Math.abs(vy) > 1)
          rafRef.current = requestAnimationFrame(animate)
      }
    } else if (dragState?.type === "node") {
      if (!dragState.moved) {
        onSelectNode(dragState.id ?? null)
      } else if (dragState.id) {
        const draggedNode = nodes.find((node) => node.id === dragState.id)

        if (draggedNode) {
          const settledTarget = resolveNodeSettleTarget(
            dragState.id,
            nodes,
            layoutAnchorsRef.current
          )

          if (settledTarget) {
            animateNodeToTarget(
              dragState.id,
              draggedNode.position,
              settledTarget
            )
          }
        }
      }
    }
    setDragState(null)
  }

  useEffect(
    () => () => {
      stopSnapAnimation()
    },
    [stopSnapAnimation]
  )

  // Keyboard: Escape deselects
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSelectNode(null)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onSelectNode])

  // --- Selected data ---
  const selectedNode = nodes.find((node) => node.id === selectedNodeId)
  const selectedMfr =
    selectedNode?.data.kind === "manufacturer" ? selectedNode.data : null
  const selectedBaseNode =
    selectedNode && selectedNode.data.kind !== "manufacturer"
      ? selectedNode.data
      : null
  const ecoConfig = selectedMfr ? getEcoConfig(selectedMfr.ecoScore) : null
  const productNode =
    nodes.find((node) => node.id === scenario.product.id) ??
    nodes[0]
  const productNodeSize = getNodeSize(productNode)

  // Cursor
  const cursor =
    dragState?.type === "canvas" ? "cursor-grabbing" : "cursor-grab"

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 52% 42%, color-mix(in oklab, var(--primary) 6%, transparent), transparent 36%), linear-gradient(180deg, rgba(7,7,12,0.98), rgba(5,5,8,1))",
      }}
    >
      {/* Keyframe styles */}
      <style>{`
        @keyframes edge-flow {
          from { stroke-dashoffset: 24; }
          to   { stroke-dashoffset: 0;  }
        }
        .edge-flow { animation: edge-flow 1.8s linear infinite; }

        @keyframes edge-flow-subtle {
          from { stroke-dashoffset: 36; }
          to   { stroke-dashoffset: 0;  }
        }
        .edge-flow-subtle { animation: edge-flow-subtle 4.2s linear infinite; }

        @keyframes edge-flow-ambient {
          from { stroke-dashoffset: 54; }
          to   { stroke-dashoffset: 0;  }
        }
        .edge-flow-ambient { animation: edge-flow-ambient 8.5s linear infinite; }

        @keyframes edge-draw {
          from { stroke-dashoffset: 100; }
          to   { stroke-dashoffset: 0; }
        }
        .edge-draw {
          animation: edge-draw 0.95s cubic-bezier(0.2,0.9,0.2,1) both;
        }

        @keyframes eco-pulse {
          0%, 100% { opacity: 1;   transform: scale(1);    }
          50%       { opacity: 0.6; transform: scale(1.08); }
        }
        .eco-pulse { animation: eco-pulse 4.8s ease-in-out infinite; }

        @keyframes node-signal {
          0%, 100% { opacity: 0.14; transform: scale(0.97); }
          50% { opacity: 0.34; transform: scale(1.04); }
        }
        .node-signal {
          animation: node-signal 5.8s ease-in-out infinite;
        }

        @keyframes node-idle-float {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -5px, 0); }
        }
        .node-idle-float {
          animation: node-idle-float 7.4s ease-in-out infinite;
          will-change: transform;
        }

        @keyframes node-surface-drift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.5; }
          50% { transform: translate3d(1.2%, -1.2%, 0) scale(1.02); opacity: 0.82; }
        }
        .node-surface-drift {
          animation: node-surface-drift 10.5s ease-in-out infinite;
        }

        @keyframes node-pop {
          0%   { transform: scale(0.6); opacity: 0; }
          55%  { transform: scale(1.06); opacity: 1; }
          80%  { transform: scale(0.97); }
          100% { transform: scale(1); opacity: 1; }
        }
        .node-pop { animation: node-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) backwards; }

        @keyframes ambient-breathe {
          0%, 100% { opacity: 0.22; }
          50%       { opacity: 0.38; }
        }
        .ambient-breathe { animation: ambient-breathe 8.2s ease-in-out infinite; }

        @keyframes focus-beacon {
          0%, 100% { opacity: 0.42; transform: scaleX(1); }
          50% { opacity: 0.92; transform: scaleX(1.04); }
        }
        .focus-beacon {
          animation: focus-beacon 5.6s ease-in-out infinite;
          transform-origin: center;
        }

        @keyframes emblem-pulse {
          0%, 100% { opacity: 0.88; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        .emblem-pulse {
          animation: emblem-pulse 6.2s ease-in-out infinite;
          transform-origin: center;
        }

        @keyframes panel-slide-in {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
        .panel-slide-in { animation: panel-slide-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `}</style>

      {/* Dot grid */}
      <div className="pointer-events-none absolute inset-0">
        <svg width="100%" height="100%">
          <pattern
            id="gc-grid-minor"
            x={transform.x % (26 * transform.scale)}
            y={transform.y % (26 * transform.scale)}
            width={26 * transform.scale}
            height={26 * transform.scale}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${26 * transform.scale} 0 L 0 0 0 ${26 * transform.scale}`}
              fill="none"
              stroke="rgba(226,223,218,0.12)"
              strokeWidth="1"
            />
          </pattern>
          <pattern
            id="gc-grid-major"
            x={transform.x % (104 * transform.scale)}
            y={transform.y % (104 * transform.scale)}
            width={104 * transform.scale}
            height={104 * transform.scale}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${104 * transform.scale} 0 L 0 0 0 ${104 * transform.scale}`}
              fill="none"
              stroke="rgba(246,244,240,0.18)"
              strokeWidth="1"
            />
          </pattern>
          <rect width="100%" height="100%" fill="url(#gc-grid-minor)" />
          <rect width="100%" height="100%" fill="url(#gc-grid-major)" />
        </svg>
      </div>

      {/* Ambient radial glow at product node */}
      <div
        className="ambient-breathe pointer-events-none absolute"
        style={{
          left:
            transform.x +
            (productNode.position.x + productNodeSize.w / 2) * transform.scale -
            300,
          top:
            transform.y +
            (productNode.position.y + productNodeSize.h / 2) * transform.scale -
            300,
          width: 600,
          height: 600,
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--primary) 11%, transparent) 0%, color-mix(in oklab, var(--primary) 2.5%, transparent) 48%, transparent 68%)",
          borderRadius: "50%",
        }}
      />

      {/* Canvas interaction area */}
      <div
        ref={containerRef}
        className={`absolute inset-0 ${cursor} select-none`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        {/* Transformed world layer */}
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            willChange: "transform",
          }}
        >
          {/* Edges SVG */}
          <svg
            className="pointer-events-none absolute overflow-visible"
            style={{ zIndex: 1 }}
          >
            <defs>
              <marker
                id="arrow-def"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 2 L 10 5 L 0 8 z" fill="rgba(255,255,255,0.07)" />
              </marker>
              <marker
                id="arrow-hov"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 2 L 10 5 L 0 8 z" fill="rgba(255,255,255,0.30)" />
              </marker>
              <marker
                id="arrow-sel"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 2 L 10 5 L 0 8 z" fill="#F1E9FF" />
              </marker>
            </defs>

            {scenario.graph.edges.map((edge, edgeIndex) => {
              const src = nodes.find((n) => n.id === edge.sourceId)
              const tgt = nodes.find((n) => n.id === edge.targetId)
              if (!src || !tgt) return null
              const isSelected =
                selectedNodeId === src.id || selectedNodeId === tgt.id
              const isHovered =
                hoveredEdgeId === edge.id ||
                hoveredNodeId === src.id ||
                hoveredNodeId === tgt.id
              const flowActive =
                src.data.kind === "product" ||
                (tgt.data.kind === "manufacturer" && tgt.data.isCurrent)
              return (
                <g
                  key={edge.id}
                  className="pointer-events-auto"
                  onPointerEnter={() => setHoveredEdgeId(edge.id)}
                  onPointerLeave={() => setHoveredEdgeId(null)}
                >
                  <ConnectionEdge
                    drawDelay={edgeIndex * 0.08}
                    flowActive={flowActive}
                    sourceNode={src}
                    targetNode={tgt}
                    selected={isSelected}
                    hovered={isHovered}
                  />
                </g>
              )
            })}
          </svg>

          {/* Nodes */}
          {nodes.map((node, index) => {
            const d = node.data
            const { w, h } = getNodeSize(node)
            const isSelected = selectedNodeId === node.id
            const isHovered = hoveredNodeId === node.id
            const isDragging =
              dragState?.type === "node" && dragState.id === node.id

            return (
              <div
                key={node.id}
                data-node-id={node.id}
                className="gc-node node-pop absolute"
                style={{
                  left: node.position.x,
                  top: node.position.y,
                  width: w,
                  height: h,
                  zIndex: isSelected || isDragging ? 50 : 10,
                }}
                onPointerEnter={() => onHoverNode(node.id)}
                onPointerLeave={() => onHoverNode(null)}
              >
                <NodeCard
                  isDragging={isDragging}
                  node={node}
                  isSelected={isSelected}
                  isHovered={isHovered}
                  motionIndex={index}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="dashboard-control-surface absolute bottom-5 left-5 z-20 flex flex-col gap-1 rounded-xl p-1.5 shadow-2xl">
        <button
          onClick={() => handleZoom("in")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white/80"
        >
          <HugeiconsIcon
            icon={ZoomInAreaIcon}
            className="h-4 w-4"
            strokeWidth={1.7}
          />
        </button>
        <button
          onClick={() => handleZoom("out")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white/80"
        >
          <HugeiconsIcon
            icon={ZoomOutAreaIcon}
            className="h-4 w-4"
            strokeWidth={1.7}
          />
        </button>
        <div className="my-0.5 h-px w-full bg-white/[0.06]" />
        <button
          onClick={handleFit}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white/80"
        >
          <HugeiconsIcon
            icon={Maximize02Icon}
            className="h-4 w-4"
            strokeWidth={1.7}
          />
        </button>
      </div>

      {/* Zoom level badge */}
      <div className="dashboard-control-surface absolute bottom-5 left-16 z-20 rounded-lg px-2 py-1">
        <span className="font-mono text-[10px] text-white/30">
          {Math.round(transform.scale * 100)}%
        </span>
      </div>

      {/* Detail panel */}
      {selectedNode && panelVisible && (
        <div
          className="dashboard-drawer panel-slide-in absolute top-4 right-4 bottom-4 z-30 flex w-72 flex-col"
          style={
            ecoConfig
              ? {
                  borderTop: `2px solid ${ecoConfig.color}`,
                }
              : {}
          }
        >
          {/* Panel header */}
          <div className="flex items-start justify-between gap-2 p-4 pb-3">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10px] font-medium tracking-[0.2em] text-white/30 uppercase">
                {selectedMfr
                  ? "Manufacturer"
                  : selectedBaseNode?.kind === "product"
                    ? "Product"
                    : "Component"}
              </p>
              <h3 className="text-sm leading-snug font-semibold text-white/90">
                {selectedMfr ? selectedMfr.name : selectedBaseNode?.label}
              </h3>
              {selectedMfr && (
                <p className="mt-0.5 text-xs text-white/35">
                  {selectedMfr.location.city}, {selectedMfr.location.country}
                </p>
              )}
            </div>
            <button
              onClick={() => onSelectNode(null)}
              className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/60"
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                className="h-3.5 w-3.5"
                strokeWidth={1.8}
              />
            </button>
          </div>

          {selectedMfr && ecoConfig && (
            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
              {(() => {
                const status = getManufacturerStatusPresentation(
                  selectedMfr.isCurrent
                )

                return (
                  <div className="flex items-center justify-end">
                    <span
                      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium tracking-[0.12em]"
                      style={{
                        background: status.badgeBackground,
                        borderColor: status.badgeBorder,
                        color: status.badgeText,
                      }}
                    >
                      <span
                        className={cn(
                          "eco-pulse inline-block h-1 w-1 rounded-full",
                          status.pulseClassName
                        )}
                      />
                      {status.label}
                    </span>
                  </div>
                )
              })()}

              {/* Eco score ring */}
              <div
                className="flex items-center gap-4 rounded-xl p-4"
                style={{
                  background: ecoConfig.bg,
                  border: `1px solid ${ecoConfig.ring}`,
                }}
              >
                <div className="relative flex-shrink-0">
                  <EcoScoreRing score={selectedMfr.ecoScore} size={72} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className="text-base font-bold"
                      style={{ color: ecoConfig.color }}
                    >
                      {selectedMfr.ecoScore}
                    </span>
                    <span className="text-[8px] leading-none text-white/35">
                      /100
                    </span>
                  </div>
                </div>
                <div>
                  <p
                    className="text-xs font-semibold"
                    style={{ color: ecoConfig.color }}
                  >
                    {ecoConfig.label}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-white/35">
                    Composite eco
                    <br />
                    impact score
                  </p>
                </div>
              </div>

              {/* Emissions grid */}
              <div>
                <p className="mb-2 text-[9px] font-medium tracking-[0.18em] text-white/25 uppercase">
                  Emissions
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    {
                      label: "Transport",
                      value: `${selectedMfr.transportEmissionsTco2e}`,
                      unit: "tCO₂e",
                    },
                    {
                      label: "Mfg Median",
                      value: `${selectedMfr.manufacturingEmissionsTco2e.q50}`,
                      unit: "tCO₂e",
                    },
                    {
                      label: "Grid Carbon",
                      value: `${selectedMfr.gridCarbonScore}`,
                      unit: "/100",
                    },
                    {
                      label: "Climate Risk",
                      value: `${selectedMfr.climateRiskScore}`,
                      unit: "/100",
                    },
                  ].map(({ label, value, unit }) => (
                    <div
                      key={label}
                      className="rounded-lg border border-white/[0.05] bg-white/[0.03] p-2.5"
                    >
                      <p className="mb-1 text-[9px] text-white/30">{label}</p>
                      <p className="text-sm font-semibold text-white/80">
                        {value}
                        <span className="ml-0.5 text-[9px] font-normal text-white/25">
                          {unit}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mfg range */}
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] p-3">
                <p className="mb-2 text-[9px] font-medium tracking-[0.15em] text-white/25 uppercase">
                  Mfg Emissions Range (tCO₂e)
                </p>
                <div className="flex h-8 items-end gap-1">
                  {[
                    {
                      label: "P10",
                      val: selectedMfr.manufacturingEmissionsTco2e.q10,
                    },
                    {
                      label: "P50",
                      val: selectedMfr.manufacturingEmissionsTco2e.q50,
                    },
                    {
                      label: "P90",
                      val: selectedMfr.manufacturingEmissionsTco2e.q90,
                    },
                  ].map(({ label, val }) => {
                    const max = selectedMfr.manufacturingEmissionsTco2e.q90
                    const pct = (val / max) * 100
                    return (
                      <div
                        key={label}
                        className="flex flex-1 flex-col items-center gap-1"
                      >
                        <div
                          className="w-full rounded-sm"
                          style={{
                            height: `${pct}%`,
                            background: ecoConfig.color,
                            opacity: label === "P50" ? 1 : 0.4,
                          }}
                        />
                        <span className="text-[8px] text-white/25">
                          {label}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-1 flex justify-between">
                  {[
                    selectedMfr.manufacturingEmissionsTco2e.q10,
                    selectedMfr.manufacturingEmissionsTco2e.q50,
                    selectedMfr.manufacturingEmissionsTco2e.q90,
                  ].map((v, i) => (
                    <span
                      key={i}
                      className="font-mono text-[9px] text-white/40"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>

              {/* Certifications */}
              {selectedMfr.certifications.length > 0 && (
                <div>
                  <p className="mb-2 text-[9px] font-medium tracking-[0.18em] text-white/25 uppercase">
                    Certifications
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMfr.certifications.map((cert) => (
                      <span key={cert} className="dashboard-chip-accent">
                        {CERT_LABELS[cert] ?? cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Location */}
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] p-3">
                <p className="mb-1.5 text-[9px] font-medium tracking-[0.15em] text-white/25 uppercase">
                  Location
                </p>
                <p className="text-xs text-white/70">
                  {selectedMfr.location.city}, {selectedMfr.location.country}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-white/25">
                  {selectedMfr.location.lat.toFixed(4)},{" "}
                  {selectedMfr.location.lng.toFixed(4)}
                </p>
              </div>
            </div>
          )}

          {!selectedMfr && (
            <div className="flex-1 px-4 pb-4">
              <div
                className="rounded-xl border p-4"
                style={{
                  background:
                    "color-mix(in oklab, var(--primary) 8%, rgba(10,10,18,0.94))",
                  borderColor:
                    "color-mix(in oklab, var(--primary) 16%, transparent)",
                }}
              >
                <p className="text-xs leading-relaxed text-white/50">
                  {selectedBaseNode?.kind === "product"
                    ? "End product node. Click connected component or manufacturer nodes to explore the supply chain."
                    : "Intermediate component. Two alternative manufacturers supply this material."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Node card renderer (extracted to keep JSX readable)
// ---------------------------------------------------------------------------

function NodeCard({
  isDragging,
  node,
  isSelected,
  isHovered,
  motionIndex,
}: {
  isDragging: boolean
  node: GraphNodeState
  isSelected: boolean
  isHovered: boolean
  motionIndex: number
}) {
  const d = node.data

  if (d.kind === "product") {
    return (
      <div
        className={cn(
          "relative flex h-full w-full flex-col items-center overflow-hidden rounded-[20px] px-3 pt-3.5 pb-4",
          isDragging ? "" : "node-idle-float"
        )}
        style={{
          animationDelay: `${motionIndex * 0.4}s`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.012) 16%, transparent 22%), linear-gradient(180deg, color-mix(in oklab, var(--primary) 6%, rgba(10,10,20,0.92)), rgba(10,10,20,0.9) 46%, rgba(8,8,14,0.96) 100%)",
          border: `1px solid ${isSelected ? "color-mix(in oklab, var(--primary) 42%, white 4%)" : isHovered ? "color-mix(in oklab, var(--accent) 24%, transparent)" : "rgba(255,255,255,0.07)"}`,
          boxShadow: isSelected
            ? "0 14px 30px rgba(0,0,0,0.42), 0 0 0 1px color-mix(in oklab, var(--primary) 14%, transparent), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -12px 22px rgba(0,0,0,0.18)"
            : isHovered
              ? "0 10px 22px rgba(0,0,0,0.38), 0 0 0 1px color-mix(in oklab, var(--accent) 10%, transparent), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -10px 18px rgba(0,0,0,0.16)"
              : "0 4px 16px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -10px 16px rgba(0,0,0,0.14)",
          transition: "border-color 0.3s, box-shadow 0.3s",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-3 top-0 h-px rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)",
            opacity: isSelected ? 0.82 : isHovered ? 0.58 : 0.38,
          }}
        />
        <div
          className="node-surface-drift pointer-events-none absolute inset-0 rounded-[20px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.038), transparent 34%)",
          }}
        />
        {/* Pulse ring */}
        {isSelected && (
          <div
            className="eco-pulse absolute inset-[2px] rounded-[18px]"
            style={{
              border:
                "1px solid color-mix(in oklab, var(--primary) 12%, transparent)",
              transform: "scale(1.02)",
            }}
          />
        )}
        <div className="text-[9px] tracking-[0.18em] text-white/30 uppercase">
          Product
        </div>
        <div className="mt-2 flex flex-1 flex-col items-center justify-center">
          <div
            className={cn(
              "mb-2 rounded-lg p-2",
              isSelected || isHovered ? "emblem-pulse" : ""
            )}
            style={{
              background: "color-mix(in oklab, var(--primary) 14%, transparent)",
              border:
                "1px solid color-mix(in oklab, var(--primary) 24%, transparent)",
            }}
          >
            <HugeiconsIcon
              icon={Leaf01Icon}
              className="h-4 w-4 text-white/80"
              strokeWidth={1.8}
            />
          </div>
          <p className="px-2 text-center text-xs leading-tight font-semibold text-white/88">
            {d.label}
          </p>
          <p className="mt-1 text-[10px] text-white/30">{d.subtitle}</p>
        </div>
      </div>
    )
  }

  if (d.kind === "component") {
    return (
      <div
        className={cn(
          "relative flex h-full w-full items-center gap-2.5 overflow-hidden rounded-xl px-3",
          isDragging ? "" : "node-idle-float"
        )}
        style={{
          animationDelay: `${motionIndex * 0.4}s`,
          background: isSelected
            ? "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.01) 16%, transparent 22%), linear-gradient(180deg, color-mix(in oklab, var(--primary) 5%, rgba(10,10,18,0.88)), rgba(10,10,18,0.84) 42%, rgba(8,8,14,0.9) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008) 16%, transparent 22%), linear-gradient(180deg, rgba(10,10,18,0.76), rgba(10,10,18,0.72) 44%, rgba(8,8,14,0.82) 100%)",
          border: `1px solid ${isSelected ? "color-mix(in oklab, var(--primary) 40%, white 4%)" : isHovered ? "color-mix(in oklab, var(--accent) 22%, transparent)" : "rgba(255,255,255,0.07)"}`,
          boxShadow: isSelected
            ? "0 12px 24px rgba(0,0,0,0.34), 0 0 0 1px color-mix(in oklab, var(--primary) 12%, transparent), inset 0 1px 0 rgba(255,255,255,0.045), inset 0 -10px 18px rgba(0,0,0,0.14)"
            : isHovered
              ? "0 8px 18px rgba(0,0,0,0.3), 0 0 0 1px color-mix(in oklab, var(--accent) 10%, transparent), inset 0 1px 0 rgba(255,255,255,0.035), inset 0 -8px 14px rgba(0,0,0,0.12)"
              : "0 4px 14px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -8px 14px rgba(0,0,0,0.1)",
          transition: "border-color 0.25s, box-shadow 0.25s",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-3 top-0 h-px rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
            opacity: isSelected ? 0.8 : isHovered ? 0.55 : 0.38,
          }}
        />
        <div
          className="node-surface-drift pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.038), transparent 34%)",
          }}
        />
        {/* Left accent stripe */}
        <div
          className="absolute top-3 bottom-3 left-0 w-[2px] rounded-full"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--primary) 82%, white 6%), color-mix(in oklab, var(--accent) 46%, transparent))",
          }}
        />
        <div
          className={cn(
            "absolute top-3 bottom-3 left-0 w-[2px] rounded-full",
            isSelected || isHovered ? "focus-beacon" : ""
          )}
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.18), color-mix(in oklab, var(--primary) 68%, transparent), transparent)",
            opacity: isSelected ? 0.8 : isHovered ? 0.56 : 0,
          }}
        />
        <div
          className={cn(
            "flex-shrink-0 rounded-lg p-1.5",
            isSelected || isHovered ? "emblem-pulse" : ""
          )}
          style={{
            background: "color-mix(in oklab, var(--primary) 10%, transparent)",
            border:
              "1px solid color-mix(in oklab, var(--primary) 18%, transparent)",
          }}
        >
          <HugeiconsIcon
            icon={PuzzleIcon}
            className="h-4 w-4 text-white/80"
            strokeWidth={1.8}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white/85">
            {d.label}
          </p>
          <p className="mt-0.5 text-[9px] tracking-wide text-white/30 uppercase">
            Component
          </p>
        </div>
      </div>
    )
  }

  if (d.kind === "manufacturer") {
    const eco = getEcoConfig(d.ecoScore)
    const status = getManufacturerStatusPresentation(d.isCurrent)
    return (
      <div
        className={cn(
          "relative flex h-full w-full flex-col justify-between overflow-hidden rounded-xl p-3",
          isDragging ? "" : "node-idle-float"
        )}
        style={{
          animationDelay: `${motionIndex * 0.4}s`,
          background: isSelected
            ? "linear-gradient(180deg, rgba(255,255,255,0.038), rgba(255,255,255,0.01) 16%, transparent 20%), linear-gradient(180deg, color-mix(in oklab, var(--primary) 4%, rgba(8,8,16,0.94)), rgba(8,8,16,0.94) 48%, rgba(6,6,12,0.98) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.024), rgba(255,255,255,0.008) 16%, transparent 20%), linear-gradient(180deg, rgba(8,8,16,0.94), rgba(8,8,16,0.92) 48%, rgba(6,6,12,0.98) 100%)",
          border: `1px solid ${isSelected ? eco.color : isHovered ? "color-mix(in oklab, var(--accent) 18%, transparent)" : "rgba(255,255,255,0.07)"}`,
          boxShadow: isSelected
            ? "0 14px 30px rgba(0,0,0,0.46), 0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.045), inset 0 -12px 22px rgba(0,0,0,0.2)"
            : isHovered
              ? "0 10px 22px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.035), inset 0 -10px 16px rgba(0,0,0,0.14)"
              : "0 4px 16px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.02), inset 0 -10px 16px rgba(0,0,0,0.12)",
          transition: "border-color 0.25s, box-shadow 0.25s",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-3 top-0 h-px rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)",
            opacity: isSelected ? 0.72 : isHovered ? 0.46 : 0.3,
          }}
        />
        <div
          className="node-surface-drift pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.03), transparent 34%)",
            }}
        />
        {/* Subtle inner gradient */}
        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--primary) 3%, transparent), transparent 38%)",
          }}
        />

        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xs leading-tight font-semibold text-white/88">
              {d.name}
            </p>
            <p className="mt-0.5 text-[10px] text-white/30">
              {d.location.city}, {d.location.country}
            </p>
          </div>
          <span
            className="flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wide"
            style={{
              background: status.badgeBackground,
              color: status.badgeText,
              border: `1px solid ${status.badgeBorder}`,
            }}
          >
            <span
              className={cn(
                "eco-pulse inline-block h-1 w-1 rounded-full",
                status.pulseClassName
              )}
            />
            {status.label}
          </span>
        </div>

        <div
          className="relative flex items-center gap-2 pt-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="flex-1">
            <p className="mb-0.5 text-[9px] text-white/25">Eco Score</p>
            <div className="flex items-center gap-1.5">
              {/* Mini bar */}
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${d.ecoScore}%`,
                    background: eco.color,
                    boxShadow: `0 0 4px ${eco.color}`,
                  }}
                />
              </div>
              <span
                className="text-[10px] font-bold tabular-nums"
                style={{ color: eco.color }}
              >
                {d.ecoScore}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: eco.bg, border: `1px solid ${eco.ring}` }}
            >
              <HugeiconsIcon
                icon={Factory01Icon}
                className="h-3.5 w-3.5"
                strokeWidth={1.8}
                style={{ color: eco.color }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
