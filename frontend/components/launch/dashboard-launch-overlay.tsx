"use client"

import { useEffect, useId, useRef, useState, type CSSProperties } from "react"

import { GreenChainLogo } from "@/components/green-chain-logo"
import { Badge } from "@/components/ui/badge"
import { getEcoRoutePalette, withAlpha } from "@/lib/eco-visuals"
import { cn } from "@/lib/utils"

export type DashboardLaunchStatus = {
  detail: string
  title: string
}

type DashboardLaunchPhase = "priming" | "shell" | "sync" | "entering"
type RouteTone = "balanced" | "eco" | "risk"

type GlobeRoute = {
  d: string
  delay: string
  duration: string
  key: string
  pulseBegin: string
  pulseDuration: string
  tone: RouteTone
}

type GlobeNode = {
  delay: string
  key: string
  tone: RouteTone
  x: number
  y: number
}

type HandoffBranch = {
  d: string
  delay: string
  key: string
  variant: "csv" | "demo"
}

type DashboardLaunchOverlayProps = {
  active: boolean
  onComplete: () => void
  reducedMotion: boolean
}

const DASHBOARD_LAUNCH_STATUSES: Record<
  DashboardLaunchPhase,
  DashboardLaunchStatus
> = {
  entering: {
    detail:
      "Docking the launch hub into the CSV intake and live demo surfaces.",
    title: "Opening launch options",
  },
  priming: {
    detail:
      "Bringing the route globe online so the handoff starts inside the product world.",
    title: "Aligning route globe",
  },
  shell: {
    detail:
      "Tracing eco, balanced, and at-risk lanes across the globe before the split.",
    title: "Tracing live routes",
  },
  sync: {
    detail:
      "Collapsing the route globe into a single hub and branching toward both choices.",
    title: "Collapsing into handoff",
  },
}

const DASHBOARD_LAUNCH_PHASES: DashboardLaunchPhase[] = [
  "priming",
  "shell",
  "sync",
  "entering",
]

const ECO_ROUTE_PALETTES: Record<RouteTone, ReturnType<typeof getEcoRoutePalette>> =
  {
    balanced: getEcoRoutePalette(52),
    eco: getEcoRoutePalette(22),
    risk: getEcoRoutePalette(74),
  }

const GLOBE_CENTER = {
  r: 148,
  x: 742,
  y: 412,
} as const

const GLOBE_ROUTES: GlobeRoute[] = [
  {
    d: "M622 372C666 320 752 306 816 330C850 344 876 366 890 398",
    delay: "240ms",
    duration: "980ms",
    key: "route-eco-north",
    pulseBegin: "0.95s",
    pulseDuration: "2.8s",
    tone: "eco",
  },
  {
    d: "M604 456C654 494 732 510 802 486C848 470 878 438 892 392",
    delay: "560ms",
    duration: "1060ms",
    key: "route-balanced-mid",
    pulseBegin: "1.22s",
    pulseDuration: "3.1s",
    tone: "balanced",
  },
  {
    d: "M688 298C742 302 812 334 846 392C872 436 872 488 848 524",
    delay: "820ms",
    duration: "1120ms",
    key: "route-risk-spine",
    pulseBegin: "1.48s",
    pulseDuration: "3.3s",
    tone: "risk",
  },
  {
    d: "M592 426C642 404 706 408 762 440C806 464 834 500 842 548",
    delay: "1040ms",
    duration: "1020ms",
    key: "route-eco-south",
    pulseBegin: "1.74s",
    pulseDuration: "2.9s",
    tone: "eco",
  },
] as const

const GLOBE_NODES: GlobeNode[] = [
  {
    delay: "520ms",
    key: "node-1",
    tone: "eco",
    x: 626,
    y: 374,
  },
  {
    delay: "720ms",
    key: "node-2",
    tone: "balanced",
    x: 802,
    y: 486,
  },
  {
    delay: "960ms",
    key: "node-3",
    tone: "risk",
    x: 846,
    y: 392,
  },
  {
    delay: "1180ms",
    key: "node-4",
    tone: "eco",
    x: 842,
    y: 548,
  },
] as const

const HANDOFF_BRANCHES: HandoffBranch[] = [
  {
    d: "M736 430C814 394 888 354 962 308C1012 278 1054 252 1094 236",
    delay: "1760ms",
    key: "branch-demo",
    variant: "demo",
  },
  {
    d: "M702 448C632 494 560 552 484 612C410 668 334 714 244 740",
    delay: "1920ms",
    key: "branch-csv",
    variant: "csv",
  },
] as const

const CONTINENT_PATHS = [
  "M654 356C678 342 706 342 726 350C742 360 742 378 724 388C698 402 670 398 652 386C638 376 640 362 654 356Z",
  "M734 418C756 406 786 406 806 416C824 428 824 448 810 460C794 474 760 478 740 464C720 450 718 430 734 418Z",
  "M666 470C690 462 714 468 726 484C736 498 732 518 710 528C690 536 662 530 648 512C638 496 644 476 666 470Z",
] as const

const ORBITS = [
  { key: "orbit-outer", rotate: -16, rx: 170, ry: 66 },
  { key: "orbit-inner", rotate: 18, rx: 118, ry: 38 },
] as const

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const easeOutQuart = (value: number) => 1 - Math.pow(1 - value, 4)

export function DashboardLaunchOverlay({
  active,
  onComplete,
  reducedMotion,
}: DashboardLaunchOverlayProps) {
  const [phase, setPhase] = useState<DashboardLaunchPhase>("priming")
  const [progress, setProgress] = useState(0)
  const clipPathId = `dashboard-launch-globe-${useId().replace(/:/g, "")}`
  const runIdRef = useRef(0)

  useEffect(() => {
    if (!active) {
      runIdRef.current += 1
      return
    }

    const runId = runIdRef.current + 1
    runIdRef.current = runId

    const shouldContinue = () => runIdRef.current === runId

    const timings = reducedMotion
      ? {
          entering: 180,
          priming: 180,
          settle: 120,
          shell: 260,
          sync: 220,
        }
      : {
          entering: 560,
          priming: 720,
          settle: 160,
          shell: 1120,
          sync: 900,
        }

    const wait = (duration: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, duration)
      })

    const animateProgress = (from: number, to: number, duration: number) =>
      new Promise<void>((resolve) => {
        if (!shouldContinue()) {
          resolve()
          return
        }

        if (duration <= 0) {
          setProgress(to)
          resolve()
          return
        }

        let frame = 0
        const start = performance.now()

        const tick = (now: number) => {
          if (!shouldContinue()) {
            cancelAnimationFrame(frame)
            resolve()
            return
          }

          const elapsed = clamp((now - start) / duration, 0, 1)
          const eased = reducedMotion ? elapsed : easeOutQuart(elapsed)
          setProgress(Math.round(from + (to - from) * eased))

          if (elapsed < 1) {
            frame = requestAnimationFrame(tick)
            return
          }

          resolve()
        }

        frame = requestAnimationFrame(tick)
      })

    void (async () => {
      setPhase("priming")
      setProgress(0)
      await animateProgress(0, 18, timings.priming)
      if (!shouldContinue()) return

      setPhase("shell")
      await animateProgress(18, 56, timings.shell)
      if (!shouldContinue()) return

      setPhase("sync")
      await animateProgress(56, 88, timings.sync)
      if (!shouldContinue()) return

      setPhase("entering")
      await animateProgress(88, 100, timings.entering)
      if (!shouldContinue()) return

      await wait(timings.settle)
      if (!shouldContinue()) return

      onComplete()
    })()

    return () => {
      runIdRef.current += 1
    }
  }, [active, onComplete, reducedMotion])

  if (!active) return null

  const currentPhaseIndex = DASHBOARD_LAUNCH_PHASES.indexOf(phase)
  const handoffPackets = phase === "sync" || phase === "entering"
  const progressRatio = clamp(progress / 100, 0, 1)
  const status = DASHBOARD_LAUNCH_STATUSES[phase]

  return (
    <div
      aria-hidden
      className={cn(
        "dashboard-launch fixed inset-0 z-[100] overflow-hidden px-4 py-6 sm:px-6 md:px-8",
        `is-${phase}`,
        reducedMotion && "is-reduced-motion"
      )}
    >
      <div className="dashboard-launch__backdrop absolute inset-0" />
      <div className="dashboard-launch__vignette absolute inset-0" />
      <div className="dashboard-launch__grid absolute inset-0" />
      <div className="dashboard-launch__noise absolute inset-0" />

      <div className="dashboard-launch__frame relative z-10 mx-auto flex min-h-full w-full max-w-[1220px] items-center justify-center">
        <div className="dashboard-launch__scene w-full">
          <div className="dashboard-launch__header">
            <Badge className="dashboard-launch__badge border-white/12 bg-white/[0.07] px-3.5 py-1.5 text-[0.7rem] tracking-[0.24em] text-white/72 uppercase backdrop-blur-xl">
              <GreenChainLogo variant="onDark" className="mr-2 h-4 w-auto" />
              Launch globe
            </Badge>

            <h2 className="dashboard-launch__title mt-6 font-heading text-[clamp(2.1rem,4.7vw,4.2rem)] leading-[0.94] tracking-[-0.06em] text-white">
              {status.title}
            </h2>

            <p className="dashboard-launch__detail mt-4 max-w-xl text-sm leading-7 text-white/58 sm:text-base">
              {status.detail}
            </p>

            <div className="dashboard-launch__phase-rail mt-6 flex items-center gap-2">
              {DASHBOARD_LAUNCH_PHASES.map((currentPhase, index) => (
                <span
                  key={currentPhase}
                  className={cn(
                    "dashboard-launch__phase-dot",
                    index <= currentPhaseIndex && "is-active"
                  )}
                />
              ))}
            </div>

            <div className="dashboard-launch__telemetry">
              <div className="dashboard-launch__telemetry-top">
                <span className="dashboard-launch__telemetry-value">
                  {progress}%
                </span>
                <span className="dashboard-launch__telemetry-label">
                  Launch telemetry
                </span>
              </div>
              <div className="dashboard-launch__telemetry-bar">
                <span
                  className="dashboard-launch__telemetry-fill"
                  style={{ transform: `scaleX(${progressRatio})` }}
                />
              </div>
            </div>
          </div>

          <svg
            className="dashboard-launch__visual pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 1200 760"
            fill="none"
          >
            <defs>
              <clipPath id={clipPathId}>
                <circle
                  cx={GLOBE_CENTER.x}
                  cy={GLOBE_CENTER.y}
                  r={GLOBE_CENTER.r}
                />
              </clipPath>
              <radialGradient
                id={`${clipPathId}-surface`}
                cx="50%"
                cy="46%"
                r="62%"
              >
                <stop offset="0%" stopColor="rgba(220,238,229,0.14)" />
                <stop offset="30%" stopColor="rgba(170,206,191,0.08)" />
                <stop offset="66%" stopColor="rgba(84,117,104,0.06)" />
                <stop offset="100%" stopColor="rgba(15,24,28,0.86)" />
              </radialGradient>
              <radialGradient
                id={`${clipPathId}-atmosphere`}
                cx="50%"
                cy="50%"
                r="62%"
              >
                <stop offset="68%" stopColor="rgba(220,242,233,0)" />
                <stop offset="88%" stopColor="rgba(220,242,233,0.1)" />
                <stop offset="100%" stopColor="rgba(220,242,233,0.2)" />
              </radialGradient>
              <linearGradient
                id={`${clipPathId}-handoff`}
                x1="252"
                x2="1098"
                y1="724"
                y2="236"
              >
                <stop offset="0" stopColor="rgba(146,255,206,0.48)" />
                <stop offset="0.52" stopColor="rgba(225,255,240,0.92)" />
                <stop offset="1" stopColor="rgba(146,255,206,0.62)" />
              </linearGradient>
            </defs>

            <g className="dashboard-launch__globe-group">
              {ORBITS.map((orbit) => (
                <ellipse
                  key={orbit.key}
                  className={cn(
                    "dashboard-launch__orbital",
                    orbit.key === "orbit-inner" &&
                      "dashboard-launch__orbital--inner"
                  )}
                  cx={GLOBE_CENTER.x}
                  cy={GLOBE_CENTER.y}
                  rx={orbit.rx}
                  ry={orbit.ry}
                  transform={`rotate(${orbit.rotate} ${GLOBE_CENTER.x} ${GLOBE_CENTER.y})`}
                />
              ))}

              <circle
                className="dashboard-launch__atmosphere"
                cx={GLOBE_CENTER.x}
                cy={GLOBE_CENTER.y}
                fill={`url(#${clipPathId}-atmosphere)`}
                r={GLOBE_CENTER.r + 16}
              />

              <g className="dashboard-launch__globe-shell">
                <circle
                  className="dashboard-launch__surface"
                  cx={GLOBE_CENTER.x}
                  cy={GLOBE_CENTER.y}
                  fill={`url(#${clipPathId}-surface)`}
                  r={GLOBE_CENTER.r}
                />

                <g clipPath={`url(#${clipPathId})`}>
                  <ellipse
                    className="dashboard-launch__globe-grid dashboard-launch__globe-grid--major"
                    cx={GLOBE_CENTER.x}
                    cy={GLOBE_CENTER.y}
                    rx="128"
                    ry="44"
                  />
                  <ellipse
                    className="dashboard-launch__globe-grid dashboard-launch__globe-grid--major"
                    cx={GLOBE_CENTER.x}
                    cy={GLOBE_CENTER.y}
                    rx="138"
                    ry="84"
                  />
                  <ellipse
                    className="dashboard-launch__globe-grid"
                    cx={GLOBE_CENTER.x}
                    cy={GLOBE_CENTER.y}
                    rx="56"
                    ry="146"
                    transform={`rotate(-22 ${GLOBE_CENTER.x} ${GLOBE_CENTER.y})`}
                  />
                  <ellipse
                    className="dashboard-launch__globe-grid"
                    cx={GLOBE_CENTER.x}
                    cy={GLOBE_CENTER.y}
                    rx="54"
                    ry="146"
                    transform={`rotate(20 ${GLOBE_CENTER.x} ${GLOBE_CENTER.y})`}
                  />
                  <ellipse
                    className="dashboard-launch__globe-grid dashboard-launch__globe-grid--subtle"
                    cx={GLOBE_CENTER.x}
                    cy={GLOBE_CENTER.y + 8}
                    rx="112"
                    ry="30"
                  />

                  {CONTINENT_PATHS.map((path, index) => (
                    <path
                      key={`continent-${index}`}
                      className="dashboard-launch__continent"
                      d={path}
                    />
                  ))}

                  {GLOBE_ROUTES.map((route) => {
                    const palette = ECO_ROUTE_PALETTES[route.tone]

                    return (
                      <g
                        key={route.key}
                        className="dashboard-launch__route-layer"
                        style={
                          {
                            "--dashboard-launch-delay": route.delay,
                            "--dashboard-launch-duration": route.duration,
                          } as CSSProperties
                        }
                      >
                        <path
                          className="dashboard-launch__route dashboard-launch__route--glow"
                          d={route.d}
                          pathLength={100}
                          stroke={palette.glowStrong}
                        />
                        <path
                          className="dashboard-launch__route dashboard-launch__route--core"
                          d={route.d}
                          pathLength={100}
                          stroke={palette.coreStrong}
                        />
                        {reducedMotion ? null : (
                          <circle
                            className="dashboard-launch__route-packet"
                            fill={palette.pulseStrong}
                            r="3.2"
                          >
                            <animateMotion
                              begin={route.pulseBegin}
                              dur={route.pulseDuration}
                              path={route.d}
                              repeatCount="indefinite"
                            />
                          </circle>
                        )}
                      </g>
                    )
                  })}

                  {GLOBE_NODES.map((node) => {
                    const palette = ECO_ROUTE_PALETTES[node.tone]

                    return (
                      <g
                        key={node.key}
                        className="dashboard-launch__node"
                        style={
                          {
                            "--dashboard-launch-delay": node.delay,
                          } as CSSProperties
                        }
                        transform={`translate(${node.x} ${node.y})`}
                      >
                        <circle
                          className="dashboard-launch__node-aura"
                          fill={withAlpha(palette.coreStrong, 0.18)}
                          r="10"
                        />
                        <circle
                          className="dashboard-launch__node-core"
                          fill={palette.highlightCore}
                          r="3.2"
                        />
                      </g>
                    )
                  })}
                </g>

                <ellipse
                  className="dashboard-launch__terminator"
                  cx={GLOBE_CENTER.x}
                  cy={GLOBE_CENTER.y}
                  rx={GLOBE_CENTER.r * 0.98}
                  ry={GLOBE_CENTER.r * 0.42}
                />
                <circle
                  className="dashboard-launch__rim"
                  cx={GLOBE_CENTER.x}
                  cy={GLOBE_CENTER.y}
                  r={GLOBE_CENTER.r}
                />
              </g>
            </g>

            <g className="dashboard-launch__handoff-group">
              <circle
                className="dashboard-launch__hub-glow"
                cx="724"
                cy="438"
                r="54"
              />
              <circle className="dashboard-launch__hub-ring" cx="724" cy="438" r="22" />
              <circle className="dashboard-launch__hub-core" cx="724" cy="438" r="7" />

              {HANDOFF_BRANCHES.map((branch) => (
                <g
                  key={branch.key}
                  className="dashboard-launch__branch-layer"
                  style={
                    {
                      "--dashboard-launch-delay": branch.delay,
                    } as CSSProperties
                  }
                >
                  <path
                    className="dashboard-launch__branch dashboard-launch__branch--glow"
                    d={branch.d}
                    pathLength={100}
                  />
                  <path
                    className="dashboard-launch__branch dashboard-launch__branch--core"
                    d={branch.d}
                    pathLength={100}
                    stroke={`url(#${clipPathId}-handoff)`}
                  />
                  {handoffPackets && !reducedMotion ? (
                    <circle
                      className="dashboard-launch__packet dashboard-launch__packet--branch"
                      fill="rgba(229,255,241,0.94)"
                      r="3.8"
                    >
                      <animateMotion
                        begin={branch.variant === "demo" ? "2.02s" : "2.18s"}
                        dur={branch.variant === "demo" ? "1.18s" : "1.28s"}
                        path={branch.d}
                        repeatCount="indefinite"
                      />
                    </circle>
                  ) : null}
                </g>
              ))}

              <circle className="dashboard-launch__dock-glow" cx="1094" cy="236" r="22" />
              <circle className="dashboard-launch__dock-ring" cx="1094" cy="236" r="9" />
              <circle className="dashboard-launch__dock-core" cx="1094" cy="236" r="4.4" />

              <circle className="dashboard-launch__dock-glow" cx="244" cy="740" r="20" />
              <circle className="dashboard-launch__dock-ring" cx="244" cy="740" r="8" />
              <circle className="dashboard-launch__dock-core" cx="244" cy="740" r="4" />
            </g>
          </svg>

          <div className="dashboard-launch__choice-card dashboard-launch__choice-card--demo">
            <span
              aria-hidden
              className="dashboard-launch__choice-dock dashboard-launch__choice-dock--demo"
            />
            <div className="dashboard-launch__choice-kicker">Live demo</div>
            <h3 className="dashboard-launch__choice-title">
              Continue with the sample dashboard
            </h3>
            <p className="dashboard-launch__choice-detail">
              Jump straight into the current graph and globe walkthrough
              without waiting on a file upload.
            </p>
          </div>

          <div className="dashboard-launch__choice-card dashboard-launch__choice-card--csv">
            <span
              aria-hidden
              className="dashboard-launch__choice-dock dashboard-launch__choice-dock--csv"
            />
            <div className="dashboard-launch__choice-kicker">CSV intake</div>
            <h3 className="dashboard-launch__choice-title">
              Upload a structured sourcing scenario
            </h3>
            <p className="dashboard-launch__choice-detail">
              Validate and stage a scenario CSV for later processing while the
              demo path stays fast and separate.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
