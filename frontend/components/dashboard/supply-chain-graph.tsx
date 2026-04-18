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
import rawData from "@/lib/sampledata.json"

// ---------------------------------------------------------------------------
// Data + types
// ---------------------------------------------------------------------------

// Node positions are computed for this specific dataset
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  product_lint_roller:  { x: -55,  y: -55  },
  component_plastic:    { x: 220,  y: -35  },
  component_cardboard:  { x: -230, y: 225  },
  component_adhesive:   { x: -230, y: -295 },
  mfr_pla_1:            { x: 442,  y: -380 },
  mfr_pla_2:            { x: 442,  y: 270  },
  mfr_car_1:            { x: -120, y: 595  },
  mfr_car_2:            { x: -682, y: 270  },
  mfr_adh_1:            { x: -682, y: -380 },
  mfr_adh_2:            { x: -120, y: -705 },
}

interface BaseNodeData {
  id: string
  nodeKind: "base"
  baseType: "product" | "component"
  label: string
  subtitle?: string
}

interface ManufacturerNodeData {
  id: string
  nodeKind: "manufacturer"
  name: string
  component: string
  isCurrent: boolean
  location: { country: string; city: string; lat: number; lng: number }
  ecoScore: number
  gridCarbonScore: number
  climateRiskScore: number
  transportEmissionsTco2e: number
  manufacturingEmissionsTco2e: { q10: number; q50: number; q90: number }
  certifications: string[]
}

type RawNode = BaseNodeData | ManufacturerNodeData

interface GraphNode {
  id: string
  position: { x: number; y: number }
  data: RawNode
}

interface GraphEdge {
  id: string
  source: string
  target: string
}

// Merge JSON data with positions
function buildGraphData() {
  const raw = rawData as unknown as { nodes: RawNode[]; edges: GraphEdge[] }
  const nodes: GraphNode[] = raw.nodes.map((n) => ({
    id: n.id,
    position: NODE_POSITIONS[n.id] ?? { x: 0, y: 0 },
    data: n,
  }))
  return { nodes, edges: raw.edges }
}

// ---------------------------------------------------------------------------
// Design helpers
// ---------------------------------------------------------------------------

const CERT_LABELS: Record<string, string> = {
  iso14001: "ISO 14001",
  sbt:      "SBT",
  cdp_a:    "CDP A-List",
}

function getEcoConfig(score: number) {
  if (score < 40) return {
    color: "#34d399",
    glow: "0 0 18px rgba(52,211,153,0.45)",
    ring: "rgba(52,211,153,0.35)",
    bg: "rgba(52,211,153,0.08)",
    text: "#34d399",
    label: "Low Impact",
  }
  if (score < 60) return {
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

function getNodeSize(node: GraphNode) {
  const d = node.data
  if (d.nodeKind === "base" && d.baseType === "product") return { w: 120, h: 120 }
  if (d.nodeKind === "manufacturer") return { w: 252, h: 120 }
  return { w: 168, h: 68 }
}

// Intersection of a ray from node centre with its boundary
function getIntersection(node: GraphNode, dx: number, dy: number) {
  const { w, h } = getNodeSize(node)
  const cx = node.position.x + w / 2
  const cy = node.position.y + h / 2
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const pad = 10
  const d = node.data
  if (d.nodeKind === "base" && d.baseType === "product") {
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
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
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
  sourceNode: GraphNode
  targetNode: GraphNode
  selected: boolean
  hovered: boolean
}

function ConnectionEdge({ sourceNode, targetNode, selected, hovered }: EdgeProps) {
  const { w: sw, h: sh } = getNodeSize(sourceNode)
  const { w: tw, h: th } = getNodeSize(targetNode)
  const sc = { x: sourceNode.position.x + sw / 2, y: sourceNode.position.y + sh / 2 }
  const tc = { x: targetNode.position.x + tw / 2, y: targetNode.position.y + th / 2 }
  const dx = tc.x - sc.x
  const dy = tc.y - sc.y
  if (Math.hypot(dx, dy) < 10) return null
  const start = getIntersection(sourceNode, dx, dy)
  const end   = getIntersection(targetNode, -dx, -dy)
  const path  = `M ${start.x} ${start.y} L ${end.x} ${end.y}`
  const markerId = selected ? "arrow-sel" : hovered ? "arrow-hov" : "arrow-def"

  return (
    <g>
      {/* Wide invisible hit area */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={20} className="cursor-pointer" />
      {/* Glow layer when active */}
      {(selected || hovered) && (
        <path
          d={path}
          fill="none"
          stroke={selected ? "rgba(233,224,255,0.34)" : "rgba(226,220,235,0.16)"}
          strokeWidth={selected ? 9 : 6}
          style={{ filter: selected ? "blur(6px)" : "blur(3px)" }}
        />
      )}
      {/* Main stroke */}
      <path
        d={path}
        fill="none"
        stroke={selected ? "#F1E9FF" : hovered ? "rgba(228,219,250,0.88)" : "rgba(214,207,224,0.68)"}
        strokeWidth={selected ? 2.6 : hovered ? 2.1 : 1.8}
        markerEnd={`url(#${markerId})`}
        style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
      />
      {/* Animated flow particles when selected */}
      {selected && (
        <path
          d={path}
          fill="none"
          stroke="rgba(255,250,255,0.94)"
          strokeWidth={1.8}
          strokeDasharray="5 14"
          className="edge-flow"
        />
      )}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Main graph component
// ---------------------------------------------------------------------------

export function SupplyChainGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const velRef = useRef({ x: 0, y: 0, ts: 0, lx: 0, ly: 0 })

  const { nodes: NODES, edges: EDGES } = React.useMemo(() => buildGraphData(), [])

  const [nodes, setNodes] = useState<GraphNode[]>(NODES)
  const [edges]           = useState<GraphEdge[]>(EDGES)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.9 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId]   = useState<string | null>(null)
  const [dragState, setDragState] = useState<{
    type: "canvas" | "node"
    id?: string
    sx: number; sy: number
    ix: number; iy: number
    moved: boolean
  } | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)

  // Centre graph on mount
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setTransform({ x: width / 2, y: height / 2, scale: 0.85 })
  }, [])

  // Show panel with a tick of delay for animation
  useEffect(() => {
    if (selectedId) {
      const t = setTimeout(() => setPanelVisible(true), 10)
      return () => clearTimeout(t)
    } else {
      setPanelVisible(false)
    }
  }, [selectedId])

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

  const screenToWorld = useCallback((sx: number, sy: number) => ({
    x: (sx - transform.x) / transform.scale,
    y: (sy - transform.y) / transform.scale,
  }), [transform])

  // --- Wheel zoom/pan ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    stopInertia()
    setTransform((prev) => {
      if (e.ctrlKey || e.metaKey) {
        const newScale = Math.min(Math.max(0.15, prev.scale * Math.exp(-e.deltaY * 0.005)), 4)
        const wx = (e.clientX - prev.x) / prev.scale
        const wy = (e.clientY - prev.y) / prev.scale
        return { x: e.clientX - wx * newScale, y: e.clientY - wy * newScale, scale: newScale }
      }
      return { ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }
    })
  }, [stopInertia])

  const handleZoom = useCallback((dir: "in" | "out") => {
    setTransform((prev) => {
      const newScale = Math.max(0.15, Math.min(prev.scale * (dir === "in" ? 1.25 : 0.8), 4))
      const cx = (containerRef.current?.clientWidth ?? 800) / 2
      const cy = (containerRef.current?.clientHeight ?? 600) / 2
      const wx = (cx - prev.x) / prev.scale
      const wy = (cy - prev.y) / prev.scale
      return { scale: newScale, x: cx - wx * newScale, y: cy - wy * newScale }
    })
  }, [])

  const handleFit = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setTransform({ x: width / 2, y: height / 2, scale: 0.85 })
  }, [])

  // --- Pointer events ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    stopInertia()
    const target = e.target as HTMLElement
    const nodeEl = target.closest(".gc-node") as HTMLElement | null

    if (nodeEl) {
      const nodeId = nodeEl.dataset.nodeId!
      const node = nodes.find((n) => n.id === nodeId)!
      setDragState({ type: "node", id: nodeId, sx: e.clientX, sy: e.clientY, ix: node.position.x, iy: node.position.y, moved: false })
      e.stopPropagation()
      return
    }

    velRef.current = { x: 0, y: 0, ts: performance.now(), lx: e.clientX, ly: e.clientY }
    setDragState({ type: "canvas", sx: e.clientX, sy: e.clientY, ix: transform.x, iy: transform.y, moved: false })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return
    const dx = e.clientX - dragState.sx
    const dy = e.clientY - dragState.sy

    if (dragState.type === "canvas") {
      if (!dragState.moved && Math.hypot(dx, dy) > 4) setDragState((p) => p && ({ ...p, moved: true }))
      const now = performance.now()
      const dt = now - velRef.current.ts
      if (dt > 0) {
        velRef.current.x = (e.clientX - velRef.current.lx) / dt
        velRef.current.y = (e.clientY - velRef.current.ly) / dt
      }
      velRef.current.ts = now; velRef.current.lx = e.clientX; velRef.current.ly = e.clientY
      setTransform((p) => ({ ...p, x: dragState.ix + dx, y: dragState.iy + dy }))
    } else if (dragState.type === "node") {
      if (!dragState.moved && Math.hypot(dx, dy) > 4) setDragState((p) => p && ({ ...p, moved: true }))
      const wdx = dx / transform.scale
      const wdy = dy / transform.scale
      setNodes((prev) => prev.map((n) =>
        n.id === dragState.id ? { ...n, position: { x: dragState.ix + wdx, y: dragState.iy + wdy } } : n
      ))
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState?.type === "canvas") {
      if (!dragState.moved) {
        setSelectedId(null)
      } else {
        let vx = velRef.current.x * 16
        let vy = velRef.current.y * 16
        const animate = () => {
          if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) return
          vx *= 0.92; vy *= 0.92
          setTransform((p) => ({ ...p, x: p.x + vx, y: p.y + vy }))
          rafRef.current = requestAnimationFrame(animate)
        }
        if (Math.abs(vx) > 1 || Math.abs(vy) > 1) rafRef.current = requestAnimationFrame(animate)
      }
    } else if (dragState?.type === "node" && !dragState.moved) {
      setSelectedId(dragState.id ?? null)
    }
    setDragState(null)
  }

  // Keyboard: Escape deselects
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // --- Selected data ---
  const selectedNode = nodes.find((n) => n.id === selectedId)
  const selectedMfr  = selectedNode?.data.nodeKind === "manufacturer" ? selectedNode.data : null
  const ecoConfig    = selectedMfr ? getEcoConfig(selectedMfr.ecoScore) : null

  // Cursor
  const cursor = dragState?.type === "canvas" ? "cursor-grabbing" : "cursor-grab"

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="relative w-full h-full overflow-hidden bg-[#050508]">
      {/* Keyframe styles */}
      <style>{`
        @keyframes edge-flow {
          from { stroke-dashoffset: 19; }
          to   { stroke-dashoffset: 0;  }
        }
        .edge-flow { animation: edge-flow 0.7s linear infinite; }

        @keyframes eco-pulse {
          0%, 100% { opacity: 1;   transform: scale(1);    }
          50%       { opacity: 0.6; transform: scale(1.08); }
        }
        .eco-pulse { animation: eco-pulse 2.6s ease-in-out infinite; }

        @keyframes node-pop {
          0%   { transform: scale(0.6); opacity: 0; }
          55%  { transform: scale(1.06); opacity: 1; }
          80%  { transform: scale(0.97); }
          100% { transform: scale(1); opacity: 1; }
        }
        .node-pop { animation: node-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) backwards; }

        @keyframes ambient-breathe {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.55; }
        }
        .ambient-breathe { animation: ambient-breathe 4s ease-in-out infinite; }

        @keyframes panel-slide-in {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
        .panel-slide-in { animation: panel-slide-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `}</style>

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none">
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
        className="absolute pointer-events-none ambient-breathe"
        style={{
          left: transform.x + (NODE_POSITIONS.product_lint_roller.x + 60) * transform.scale - 300,
          top:  transform.y + (NODE_POSITIONS.product_lint_roller.y + 60) * transform.scale - 300,
          width: 600,
          height: 600,
          background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.04) 50%, transparent 70%)",
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
          <svg className="absolute overflow-visible pointer-events-none" style={{ zIndex: 1 }}>
            <defs>
              <marker id="arrow-def" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 2 L 10 5 L 0 8 z" fill="rgba(214,207,224,0.7)" />
              </marker>
              <marker id="arrow-hov" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 2 L 10 5 L 0 8 z" fill="rgba(228,219,250,0.9)" />
              </marker>
              <marker id="arrow-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 2 L 10 5 L 0 8 z" fill="#F1E9FF" />
              </marker>
            </defs>

            {edges.map((edge) => {
              const src = nodes.find((n) => n.id === edge.source)
              const tgt = nodes.find((n) => n.id === edge.target)
              if (!src || !tgt) return null
              const isSelected = selectedId === edge.id || selectedId === src.id || selectedId === tgt.id
              const isHovered  = hoveredId  === edge.id
              return (
                <g
                  key={edge.id}
                  className="pointer-events-auto"
                  onPointerEnter={() => setHoveredId(edge.id)}
                  onPointerLeave={() => setHoveredId(null)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(edge.id) }}
                >
                  <ConnectionEdge
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
          {nodes.map((node) => {
            const d = node.data
            const { w, h } = getNodeSize(node)
            const isSelected = selectedId === node.id
            const isHovered  = hoveredId  === node.id
            const isDragging = dragState?.type === "node" && dragState.id === node.id

            return (
              <div
                key={node.id}
                data-node-id={node.id}
                className="gc-node absolute node-pop"
                style={{
                  left: node.position.x,
                  top:  node.position.y,
                  width:  w,
                  height: h,
                  zIndex: isSelected || isDragging ? 50 : 10,
                }}
                onPointerEnter={() => setHoveredId(node.id)}
                onPointerLeave={() => setHoveredId(null)}
              >
                <NodeCard node={node} isSelected={isSelected} isHovered={isHovered} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-5 left-5 z-20 flex flex-col gap-1 rounded-xl border border-white/[0.07] bg-[rgba(10,10,18,0.85)] p-1.5 backdrop-blur-xl shadow-2xl">
        <button
          onClick={() => handleZoom("in")}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.07] transition-colors"
        >
          <HugeiconsIcon icon={ZoomInAreaIcon} className="w-4 h-4" strokeWidth={1.7} />
        </button>
        <button
          onClick={() => handleZoom("out")}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.07] transition-colors"
        >
          <HugeiconsIcon icon={ZoomOutAreaIcon} className="w-4 h-4" strokeWidth={1.7} />
        </button>
        <div className="w-full h-px bg-white/[0.06] my-0.5" />
        <button
          onClick={handleFit}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.07] transition-colors"
        >
          <HugeiconsIcon icon={Maximize02Icon} className="w-4 h-4" strokeWidth={1.7} />
        </button>
      </div>

      {/* Zoom level badge */}
      <div className="absolute bottom-5 left-16 z-20 px-2 py-1 rounded-lg border border-white/[0.06] bg-[rgba(10,10,18,0.7)] backdrop-blur-md">
        <span className="text-[10px] font-mono text-white/30">{Math.round(transform.scale * 100)}%</span>
      </div>

      {/* Detail panel */}
      {selectedNode && panelVisible && (
        <div
          className="absolute top-4 right-4 bottom-4 z-30 w-72 rounded-2xl border border-white/[0.07] bg-[rgba(8,8,14,0.92)] backdrop-blur-2xl shadow-2xl panel-slide-in flex flex-col overflow-hidden"
          style={ecoConfig ? { borderTop: `2px solid ${ecoConfig.color}`, boxShadow: `0 0 0 1px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)` } : {}}
        >
          {/* Panel header */}
          <div className="flex items-start justify-between gap-2 p-4 pb-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-white/30 mb-1">
                {selectedMfr ? "Manufacturer" : (selectedNode.data as BaseNodeData).baseType === "product" ? "Product" : "Component"}
              </p>
              <h3 className="text-sm font-semibold text-white/90 leading-snug">
                {selectedMfr ? selectedMfr.name : (selectedNode.data as BaseNodeData).label}
              </h3>
              {selectedMfr && (
                <p className="text-xs text-white/35 mt-0.5">{selectedMfr.location.city}, {selectedMfr.location.country}</p>
              )}
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="flex-shrink-0 mt-0.5 flex items-center justify-center w-6 h-6 rounded-md text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="w-3.5 h-3.5" strokeWidth={1.8} />
            </button>
          </div>

          {selectedMfr && ecoConfig && (
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
              {/* Eco score ring */}
              <div
                className="rounded-xl p-4 flex items-center gap-4"
                style={{ background: ecoConfig.bg, border: `1px solid ${ecoConfig.ring}` }}
              >
                <div className="relative flex-shrink-0">
                  <EcoScoreRing score={selectedMfr.ecoScore} size={72} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-base font-bold" style={{ color: ecoConfig.color }}>{selectedMfr.ecoScore}</span>
                    <span className="text-[8px] text-white/35 leading-none">/100</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: ecoConfig.color }}>{ecoConfig.label}</p>
                  <p className="text-[10px] text-white/35 mt-0.5 leading-relaxed">
                    Composite eco<br />impact score
                  </p>
                  {selectedMfr.isCurrent && (
                    <span className="inline-flex items-center gap-1 mt-2 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-400/10 text-emerald-300 border border-emerald-400/20">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 eco-pulse inline-block" />
                      ACTIVE
                    </span>
                  )}
                </div>
              </div>

              {/* Emissions grid */}
              <div>
                <p className="text-[9px] font-medium tracking-[0.18em] uppercase text-white/25 mb-2">Emissions</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "Transport", value: `${selectedMfr.transportEmissionsTco2e}`, unit: "tCO₂e" },
                    { label: "Mfg Median", value: `${selectedMfr.manufacturingEmissionsTco2e.q50}`, unit: "tCO₂e" },
                    { label: "Grid Carbon", value: `${selectedMfr.gridCarbonScore}`, unit: "/100" },
                    { label: "Climate Risk", value: `${selectedMfr.climateRiskScore}`, unit: "/100" },
                  ].map(({ label, value, unit }) => (
                    <div key={label} className="rounded-lg p-2.5 bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-[9px] text-white/30 mb-1">{label}</p>
                      <p className="text-sm font-semibold text-white/80">
                        {value}
                        <span className="text-[9px] font-normal text-white/25 ml-0.5">{unit}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mfg range */}
              <div className="rounded-lg p-3 bg-white/[0.03] border border-white/[0.05]">
                <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-white/25 mb-2">Mfg Emissions Range (tCO₂e)</p>
                <div className="flex items-end gap-1 h-8">
                  {[
                    { label: "P10", val: selectedMfr.manufacturingEmissionsTco2e.q10 },
                    { label: "P50", val: selectedMfr.manufacturingEmissionsTco2e.q50 },
                    { label: "P90", val: selectedMfr.manufacturingEmissionsTco2e.q90 },
                  ].map(({ label, val }) => {
                    const max = selectedMfr.manufacturingEmissionsTco2e.q90
                    const pct = (val / max) * 100
                    return (
                      <div key={label} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-sm"
                          style={{ height: `${pct}%`, background: ecoConfig.color, opacity: label === "P50" ? 1 : 0.4 }}
                        />
                        <span className="text-[8px] text-white/25">{label}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  {[selectedMfr.manufacturingEmissionsTco2e.q10, selectedMfr.manufacturingEmissionsTco2e.q50, selectedMfr.manufacturingEmissionsTco2e.q90].map((v, i) => (
                    <span key={i} className="text-[9px] font-mono text-white/40">{v}</span>
                  ))}
                </div>
              </div>

              {/* Certifications */}
              {selectedMfr.certifications.length > 0 && (
                <div>
                  <p className="text-[9px] font-medium tracking-[0.18em] uppercase text-white/25 mb-2">Certifications</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMfr.certifications.map((cert) => (
                      <span
                        key={cert}
                        className="px-2 py-1 rounded-md text-[10px] font-medium text-indigo-300 border border-indigo-400/25 bg-indigo-400/[0.07]"
                      >
                        {CERT_LABELS[cert] ?? cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Location */}
              <div className="rounded-lg p-3 bg-white/[0.03] border border-white/[0.05]">
                <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-white/25 mb-1.5">Location</p>
                <p className="text-xs text-white/70">{selectedMfr.location.city}, {selectedMfr.location.country}</p>
                <p className="text-[10px] font-mono text-white/25 mt-0.5">{selectedMfr.location.lat.toFixed(4)}, {selectedMfr.location.lng.toFixed(4)}</p>
              </div>
            </div>
          )}

          {!selectedMfr && (
            <div className="px-4 pb-4 flex-1">
              <div className="rounded-xl p-4 bg-indigo-500/[0.06] border border-indigo-400/[0.12]">
                <p className="text-xs text-white/50 leading-relaxed">
                  {(selectedNode.data as BaseNodeData).baseType === "product"
                    ? "End product node. Click connected component or manufacturer nodes to explore the supply chain."
                    : "Intermediate component. Two alternative manufacturers supply this material."
                  }
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

function NodeCard({ node, isSelected, isHovered }: { node: GraphNode; isSelected: boolean; isHovered: boolean }) {
  const d = node.data

  if (d.nodeKind === "base" && d.baseType === "product") {
    return (
      <div
        className="w-full h-full rounded-full flex flex-col items-center justify-center relative"
        style={{
          background: "radial-gradient(circle at 40% 35%, rgba(99,102,241,0.22), rgba(10,10,24,0.95))",
          border: `1.5px solid ${isSelected ? "rgba(139,92,246,0.8)" : isHovered ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.2)"}`,
          boxShadow: isSelected
            ? "0 0 0 3px rgba(139,92,246,0.15), 0 0 40px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.08)"
            : isHovered
            ? "0 0 25px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.05)"
            : "0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
          transition: "border-color 0.3s, box-shadow 0.3s",
        }}
      >
        {/* Pulse ring */}
        {isSelected && (
          <div
            className="absolute inset-0 rounded-full eco-pulse"
            style={{ border: "1.5px solid rgba(139,92,246,0.25)", transform: "scale(1.12)" }}
          />
        )}
        <div
          className="mb-1.5 p-2 rounded-full"
          style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)" }}
        >
          <HugeiconsIcon icon={Leaf01Icon} className="w-4 h-4 text-indigo-400" strokeWidth={1.8} />
        </div>
        <p className="text-[11px] font-semibold text-white/85 text-center leading-tight px-2">{d.label}</p>
        <p className="text-[9px] text-white/30 mt-0.5">{d.subtitle}</p>
      </div>
    )
  }

  if (d.nodeKind === "base" && d.baseType === "component") {
    return (
      <div
        className="w-full h-full rounded-xl flex items-center gap-2.5 px-3 relative overflow-hidden"
        style={{
          background: "rgba(10,10,20,0.88)",
          border: `1px solid ${isSelected ? "rgba(96,165,250,0.6)" : isHovered ? "rgba(96,165,250,0.25)" : "rgba(255,255,255,0.07)"}`,
          boxShadow: isSelected
            ? "0 0 0 2px rgba(96,165,250,0.12), 0 0 24px rgba(59,130,246,0.2)"
            : "0 4px 16px rgba(0,0,0,0.4)",
          transition: "border-color 0.25s, box-shadow 0.25s",
        }}
      >
        {/* Left accent stripe */}
        <div
          className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full"
          style={{ background: "linear-gradient(180deg, rgba(96,165,250,0.8), rgba(59,130,246,0.3))" }}
        />
        <div
          className="flex-shrink-0 p-1.5 rounded-lg"
          style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          <HugeiconsIcon icon={PuzzleIcon} className="w-4 h-4 text-blue-400" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white/85 truncate">{d.label}</p>
          <p className="text-[9px] text-white/30 mt-0.5 uppercase tracking-wide">Component</p>
        </div>
      </div>
    )
  }

  if (d.nodeKind === "manufacturer") {
    const eco = getEcoConfig(d.ecoScore)
    return (
      <div
        className="w-full h-full rounded-xl p-3 flex flex-col justify-between relative overflow-hidden"
        style={{
          background: "rgba(8,8,16,0.92)",
          border: `1px solid ${isSelected ? eco.color : isHovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
          boxShadow: isSelected
            ? `0 0 0 1px rgba(0,0,0,0.5), ${eco.glow}, 0 16px 40px rgba(0,0,0,0.5)`
            : "0 4px 20px rgba(0,0,0,0.5)",
          transition: "border-color 0.25s, box-shadow 0.25s",
        }}
      >
        {/* Subtle inner gradient */}
        <div
          className="absolute inset-0 pointer-events-none rounded-xl"
          style={{ background: `radial-gradient(ellipse at top left, ${eco.bg}, transparent 65%)` }}
        />

        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white/88 leading-tight line-clamp-2">{d.name}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{d.location.city}, {d.location.country}</p>
          </div>
          {d.isCurrent && (
            <span
              className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide"
              style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.22)" }}
            >
              <span className="w-1 h-1 rounded-full bg-emerald-400 eco-pulse inline-block" />
              ACTIVE
            </span>
          )}
        </div>

        <div className="relative flex items-center gap-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex-1">
            <p className="text-[9px] text-white/25 mb-0.5">Eco Score</p>
            <div className="flex items-center gap-1.5">
              {/* Mini bar */}
              <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${d.ecoScore}%`, background: eco.color, boxShadow: `0 0 4px ${eco.color}` }}
                />
              </div>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: eco.color }}>{d.ecoScore}</span>
            </div>
          </div>
          <div className="flex-shrink-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: eco.bg, border: `1px solid ${eco.ring}` }}
            >
              <HugeiconsIcon
                icon={Factory01Icon}
                className="w-3.5 h-3.5"
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
