"use client"

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import Image from "next/image"
import Link from "next/link"
import * as THREE from "three"

import { GreenChainLogo } from "@/components/green-chain-logo"
import { cn } from "@/lib/utils"

const IMG = {
  heroVid: "/landing/Video_Generation_Complete.mp4",
  heroBg:
    "/landing/Cinematic_top-down_aerial_photograph_of_an_expansi-1776490199103.png",
  warehouse:
    "/landing/Stunning_photorealistic_interior_view_of_a_futuris-1776490260857.png",
  circuit:
    "/landing/Epic_extreme_macro_photography_shot_of_a_vivid_gre-1776490265657.png",
  engineers:
    "/landing/High-quality_candid_photojournalistic_image_of_two-1776490282355.png",
  port: "/landing/Epic_high-altitude_aerial_drone_photograph_of_an_e-1776490293039.png",
  ai: "/landing/Stunning_abstract_conceptual_visualization_of_an_A-1776490301437.png",
  globe:
    "/landing/Stunning_translucent_dark-blue_globe_of_planet_Ear-1776490521137.png",
  ctaPush:
    "/landing/Cinematic_photograph_of_a_professional_engineer_st-1776490359376.png",
  team: "/landing/Candid_editorial_photograph_of_a_diverse_professio-1776490341439.png",
} as const

type Metric = {
  value: number
  suffix: string
  label: string
}

type Feature = {
  img: string
  label: string
  title: string
  body: string
  bullets: string[]
}

const HERO_SIGNALS = [
  {
    label: "Start with demand",
    value: "Product and destination",
    detail: "Define what you need to source, how much you need, and where it needs to arrive.",
  },
  {
    label: "Compare options",
    value: "Country and transport",
    detail: "Test manufacturing countries side by side and see how shipping mode changes the result.",
  },
  {
    label: "Make a decision",
    value: "Ranking and recommendation",
    detail: "Review the tradeoffs quickly and export a short memo with the strongest option.",
  },
] as const

const FEATURES: Feature[] = [
  {
    img: IMG.warehouse,
    label: "Prototype Flow",
    title: "Compare sourcing scenarios quickly.",
    body:
      "The brief is intentionally focused: compare a few sourcing options quickly, show what drives the footprint, and make the transport tradeoff obvious.",
    bullets: [
      "Product, quantity, and destination input",
      "Country and transport mode comparison",
      "Quick ranked output for sourcing teams",
    ],
  },
  {
    img: IMG.engineers,
    label: "Supply Chain Graph",
    title: "See manufacturers and links as a live network.",
    body:
      "The graph view turns suppliers, facilities, and routes into a structure you can inspect instead of a list you have to mentally piece together.",
    bullets: [
      "Interactive nodes and connections",
      "Status-focused details",
      "Fast visual context for sourcing decisions",
    ],
  },
  {
    img: IMG.globe,
    label: "Geographic View",
    title: "Match the network with real-world location context.",
    body:
      "The geographic view makes transport tradeoffs easier to read by putting facilities and routes into a single global frame.",
    bullets: [
      "Location-driven exploration",
      "Graph + globe side by side",
      "Clearer context for transport choices",
    ],
  },
]

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

function useInView(threshold = 0.18) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true)
      },
      { threshold },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setPrefersReducedMotion(mediaQuery.matches)

    update()
    mediaQuery.addEventListener("change", update)
    return () => mediaQuery.removeEventListener("change", update)
  }, [])

  return prefersReducedMotion
}

function usePrefersReducedMotionSnapshot() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
      mediaQuery.addEventListener("change", onStoreChange)
      return () => mediaQuery.removeEventListener("change", onStoreChange)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  )
}

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

function easeOutQuart(x: number) {
  return 1 - Math.pow(1 - x, 4)
}

function LandingIntro({
  active,
  mode,
  onDone,
}: {
  active: boolean
  mode: "full" | "instant"
  onDone: () => void
}) {
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const [count, setCount] = useState(0)
  const [statusIndex, setStatusIndex] = useState(0)
  const [fadeCounter, setFadeCounter] = useState(false)
  const [wipePanels, setWipePanels] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!active) return
    if (mode !== "instant") return

    setCount(100)
    setStatusIndex(4)
    setFadeCounter(true)

    const timeouts: number[] = []
    timeouts.push(
      window.setTimeout(() => {
        setWipePanels(true)
        timeouts.push(
          window.setTimeout(() => {
            setHidden(true)
            onDoneRef.current()
          }, 1100),
        )
      }, 120),
    )

    return () => {
      for (const id of timeouts) window.clearTimeout(id)
    }
  }, [active, mode])

  const statuses = useMemo(
    () => [
      "Initializing Core…",
      "Loading High‑Res Assets…",
      "Establishing Uplink…",
      "Preparing Environment…",
      "Systems Ready",
    ],
    [],
  )

  const ring = useMemo(() => {
    const radius = 120
    const circumference = radius * 2 * Math.PI
    return { radius, circumference }
  }, [])

  useEffect(() => {
    if (!active) return
    if (mode !== "full") return

    let raf = 0
    const timeouts: number[] = []
    const start = performance.now()
    const DURATION = 2200

    const tick = (t: number) => {
      const progress = clamp((t - start) / DURATION, 0, 1)
      const eased = easeOutQuart(progress)
      const pct = Math.floor(eased * 100)

      setCount(pct)
      setStatusIndex(
        Math.min(Math.floor(eased * statuses.length), statuses.length - 1),
      )

      if (progress < 1) {
        raf = requestAnimationFrame(tick)
        return
      }

      // brief pause at 100% before the wipe
      timeouts.push(
        window.setTimeout(() => {
          setFadeCounter(true)
          timeouts.push(
            window.setTimeout(() => {
              setWipePanels(true)
              timeouts.push(
                window.setTimeout(() => {
                  setHidden(true)
                  onDoneRef.current()
                }, 1100),
              )
            }, 420),
          )
        }, 420),
      )
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      for (const id of timeouts) window.clearTimeout(id)
    }
  }, [active, mode, statuses.length])

  const dashOffset = useMemo(() => {
    const eased = easeOutQuart(count / 100)
    return ring.circumference - eased * ring.circumference
  }, [count, ring.circumference])

  if (!active || hidden) return null

  return (
    <div
      aria-hidden
      className={cn(
        "landing-intro fixed inset-0 z-[100] select-none",
        wipePanels && "is-revealing",
      )}
    >
      <div
        className={cn("landing-intro__content", fadeCounter && "is-hidden")}
      >
        <div className="absolute left-7 top-7 text-[11px] font-medium uppercase tracking-[0.28em] text-white/40 md:left-10 md:top-9">
          GreenChain
        </div>

        <div className="relative mb-12 mt-8 flex items-center justify-center">
          <svg
            className="absolute h-64 w-64 md:h-80 md:w-80"
            viewBox="0 0 256 256"
          >
            <circle
              className="text-white/10"
              strokeWidth="1.5"
              stroke="currentColor"
              fill="transparent"
              r={ring.radius}
              cx="128"
              cy="128"
            />
            <circle
              className="landing-intro__ring text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.28)]"
              strokeWidth="2"
              stroke="currentColor"
              fill="transparent"
              r={ring.radius}
              cx="128"
              cy="128"
              strokeLinecap="round"
              style={{
                strokeDasharray: `${ring.circumference} ${ring.circumference}`,
                strokeDashoffset: dashOffset,
              }}
            />
          </svg>

          <div className="flex items-baseline gap-1">
            <span className="text-6xl font-light tracking-[-0.06em] text-white md:text-8xl">
              {count}
            </span>
            <span className="text-xl font-light text-white/40 md:text-3xl">
              %
            </span>
          </div>
        </div>

        <div className="h-6 text-xs font-medium uppercase tracking-[0.28em] text-white/45 md:text-sm">
          {statuses[statusIndex]}
        </div>
      </div>

      <div
        className={cn(
          "landing-intro__panel landing-intro__panel--1",
          wipePanels && "is-hidden",
        )}
      />
      <div
        className={cn(
          "landing-intro__panel landing-intro__panel--2",
          wipePanels && "is-hidden",
        )}
      />
      <div
        className={cn(
          "landing-intro__panel landing-intro__panel--3",
          wipePanels && "is-hidden",
        )}
      />
      <div
        className={cn(
          "landing-intro__panel landing-intro__panel--4",
          wipePanels && "is-hidden",
        )}
      />
    </div>
  )
}

function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <p className={cn("eyebrow", className)}>{children}</p>
}

function Reveal({
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
      className={cn("transition-all duration-700 ease-out", className)}
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

function WordReveal({
  text,
  className,
  wordClass,
  delay = 0,
}: {
  text: string
  className?: string
  wordClass?: string
  delay?: number
}) {
  const { ref, inView } = useInView(0.15)

  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      <span>
        {text.split(" ").map((word, index) => (
          <span key={index} className="inline-block overflow-hidden">
            <span
              className={cn(
                "inline-block mr-[0.24em] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                wordClass,
              )}
              style={{
                transform: inView ? "translateY(0%)" : "translateY(115%)",
                transitionDelay: `${delay + index * 38}ms`,
              }}
            >
              {word}
            </span>
          </span>
        ))}
      </span>
    </div>
  )
}

function LineReveal({
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
        <div key={index} className="overflow-hidden pb-[0.34em] pr-[0.04em]">
          <div
            className={cn(lineClass)}
            style={{
              opacity: active ? 1 : 0,
              transform: active ? "translateY(0%)" : "translateY(118%)",
              transition:
                "transform 0.95s cubic-bezier(0.16,1,0.3,1), opacity 0.7s ease",
              transitionDelay: `${delay + index * 120}ms`,
            }}
          >
            {line}
          </div>
        </div>
      ))}
    </div>
  )
}

function ParallaxMedia({
  src,
  alt,
  className,
  speed = 0.14,
  sizes,
  priority = false,
}: {
  src: string
  alt: string
  className?: string
  speed?: number
  sizes: string
  priority?: boolean
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  const syncTransform = useEffectEvent(() => {
    const frame = frameRef.current
    const media = mediaRef.current
    if (!frame || !media) return

    if (prefersReducedMotion) {
      media.style.transform = "translate3d(0,0,0) scale(1.04)"
      return
    }

    const rect = frame.getBoundingClientRect()
    const viewportHeight = window.innerHeight || 1
    const progress = clamp(
      (viewportHeight - rect.top) / (viewportHeight + rect.height),
      0,
      1,
    )
    const centered = progress * 2 - 1
    const translateY = clamp(centered * speed * -160, -72, 72)

    media.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0) scale(1.12)`
  })

  useEffect(() => {
    let frame = 0

    const onFrame = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(syncTransform)
    }

    onFrame()
    window.addEventListener("scroll", onFrame, { passive: true })
    window.addEventListener("resize", onFrame)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onFrame)
      window.removeEventListener("resize", onFrame)
    }
  }, [prefersReducedMotion])

  return (
    <div ref={frameRef} className={cn("relative overflow-hidden", className)}>
      <div ref={mediaRef} className="absolute inset-[-12%] will-change-transform">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      </div>
    </div>
  )
}

function TiltCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !ref.current) return

    const rect = ref.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5

    ref.current.style.transform = `perspective(1100px) rotateY(${(x * 7).toFixed(2)}deg) rotateX(${(-y * 7).toFixed(2)}deg) translate3d(0,-2px,0) scale3d(1.01,1.01,1.01)`
  }

  const onLeave = () => {
    if (!ref.current) return
    ref.current.style.transform =
      "perspective(1100px) rotateY(0deg) rotateX(0deg) translate3d(0,0,0) scale3d(1,1,1)"
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{
        transition: "transform 180ms ease-out",
        willChange: "transform",
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  )
}

function HeroThreeField({ disabled }: { disabled: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (disabled) return

    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120)
    camera.position.set(0, 0.35, 6.2)

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8))
    renderer.setClearColor(0x000000, 0)

    const ambientLight = new THREE.AmbientLight(0xbff8dd, 0.36)
    const keyLight = new THREE.PointLight(0x62f5ae, 2.1, 26, 1.5)
    keyLight.position.set(2.4, 3.1, 6.5)
    const rimLight = new THREE.PointLight(0x5fd0ff, 1.2, 25, 1.5)
    rimLight.position.set(-4.2, -0.8, 5.4)
    scene.add(ambientLight, keyLight, rimLight)

    const field = new THREE.Group()
    scene.add(field)

    const coreGeo = new THREE.IcosahedronGeometry(1.35, 2)
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x91ffd0,
      emissive: 0x2b905f,
      emissiveIntensity: 0.35,
      roughness: 0.18,
      metalness: 0.2,
      wireframe: true,
      transparent: true,
      opacity: 0.34,
    })
    const coreMesh = new THREE.Mesh(coreGeo, coreMat)
    field.add(coreMesh)

    const shellGeo = new THREE.TorusKnotGeometry(2.4, 0.08, 220, 28)
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xb8ffe2,
      emissive: 0x2a9f71,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.55,
      transparent: true,
      opacity: 0.27,
    })
    const shellMesh = new THREE.Mesh(shellGeo, shellMat)
    shellMesh.rotation.x = 0.48
    shellMesh.rotation.y = 0.22
    field.add(shellMesh)

    const particleCount = 1100
    const particles = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i += 1) {
      const radius = 3 + Math.random() * 6.7
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      particles[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      particles[i * 3 + 1] = radius * Math.cos(phi) * 0.6
      particles[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
    }

    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particles, 3))
    const particleMat = new THREE.PointsMaterial({
      color: 0x94ffd1,
      size: 0.038,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
    const pointCloud = new THREE.Points(particleGeo, particleMat)
    scene.add(pointCloud)

    const pointerTarget = new THREE.Vector2(0, 0)
    const pointerCurrent = new THREE.Vector2(0, 0)

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      pointerTarget.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointerTarget.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    }

    const onPointerLeave = () => pointerTarget.set(0, 0)

    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    resize()
    window.addEventListener("resize", resize)
    container.addEventListener("pointermove", onPointerMove)
    container.addEventListener("pointerleave", onPointerLeave)

    const clock = new THREE.Clock()
    let frame = 0

    const tick = () => {
      const elapsed = clock.getElapsedTime()
      pointerCurrent.lerp(pointerTarget, 0.075)

      field.rotation.y += 0.0015
      field.rotation.x = Math.sin(elapsed * 0.3) * 0.08 + pointerCurrent.y * 0.18
      field.rotation.z = Math.cos(elapsed * 0.2) * 0.03 + pointerCurrent.x * 0.12
      field.position.x = pointerCurrent.x * 0.35
      field.position.y = pointerCurrent.y * 0.22

      coreMesh.rotation.x += 0.0019
      coreMesh.rotation.y += 0.0023
      shellMesh.rotation.z += 0.0018
      pointCloud.rotation.y -= 0.00042
      pointCloud.rotation.x = Math.sin(elapsed * 0.14) * 0.05

      renderer.render(scene, camera)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
      container.removeEventListener("pointermove", onPointerMove)
      container.removeEventListener("pointerleave", onPointerLeave)
      particleGeo.dispose()
      particleMat.dispose()
      coreGeo.dispose()
      coreMat.dispose()
      shellGeo.dispose()
      shellMat.dispose()
      renderer.dispose()
    }
  }, [disabled])

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className={cn(
          "h-full w-full transition-opacity duration-700 ease-out",
          disabled ? "opacity-45" : "opacity-100",
        )}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,_rgba(147,255,210,0.12),_transparent_42%),radial-gradient(circle_at_68%_24%,_rgba(126,190,255,0.08),_transparent_36%)]" />
    </div>
  )
}

function Hero({ introReady }: { introReady: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [videoReady, setVideoReady] = useState(false)

  useEffect(() => {
    if (!introReady) return
    const timeout = window.setTimeout(() => setMounted(true), 120)
    return () => window.clearTimeout(timeout)
  }, [introReady])

  const syncVideo = useEffectEvent(() => {
    const video = videoRef.current
    if (!video || prefersReducedMotion) return

    video.defaultMuted = true
    video.muted = true

    const playPromise = video.play()
    playPromise?.catch(() => {
      setVideoReady(false)
    })
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (prefersReducedMotion) {
      video.pause()
      return
    }

    const onCanPlay = () => {
      setVideoReady(true)
      syncVideo()
    }

    const onLoadedData = () => setVideoReady(true)
    const onError = () => setVideoReady(false)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncVideo()
      else video.pause()
    }

    video.addEventListener("canplay", onCanPlay)
    video.addEventListener("loadeddata", onLoadedData)
    video.addEventListener("error", onError)
    document.addEventListener("visibilitychange", onVisibilityChange)

    syncVideo()

    return () => {
      video.removeEventListener("canplay", onCanPlay)
      video.removeEventListener("loadeddata", onLoadedData)
      video.removeEventListener("error", onError)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [prefersReducedMotion])

  const fadeUp = (delay: number) => ({
    style: {
      opacity: mounted ? 1 : 0,
      transform: mounted ? "translate3d(0,0,0)" : "translate3d(0,30px,0)",
      transition:
        "opacity 0.8s ease, transform 0.9s cubic-bezier(0.16,1,0.3,1)",
      transitionDelay: `${delay}ms`,
    },
  })

  const heroLines = [
    <>Compare sourcing options before</>,
    <>
      you <span className="text-primary">place the order</span>.
    </>,
  ]

  return (
    <section className="relative min-h-[100svh] overflow-hidden border-b border-white/8">
      <div className="absolute inset-0 -z-20">
        <Image
          src={IMG.heroBg}
          alt=""
          fill
          priority
          sizes="100vw"
          className={cn(
            "object-cover transition-transform duration-[2000ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
            introReady ? "scale-100" : "scale-[1.14]",
          )}
        />
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={IMG.heroBg}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms]",
            videoReady && !prefersReducedMotion ? "opacity-100" : "opacity-0",
          )}
        >
          <source src={IMG.heroVid} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,23,24,0.08),_rgba(5,9,12,0.78)_56%,_rgba(5,9,12,0.94)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(2,7,10,0.12)_0%,_rgba(2,7,10,0.18)_28%,_rgba(2,7,10,0.72)_72%,_rgba(2,7,10,0.96)_100%)]" />
      </div>

      <HeroThreeField disabled={prefersReducedMotion} />
      <div className="landing-grid absolute inset-0 -z-10 opacity-55" />

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-screen-2xl flex-col px-6 pb-8 pt-6 md:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center transition-opacity hover:opacity-90"
          >
            <GreenChainLogo
              variant="onDark"
              className="h-8 w-auto sm:h-9 md:h-10"
            />
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {[
              ["#features", "Features"],
              ["#about", "About"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="text-sm text-white/58 transition-colors hover:text-white"
              >
                {label}
              </a>
            ))}

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-5 py-2.5 text-sm text-white backdrop-blur-xl transition-all duration-300 hover:border-white/28 hover:bg-white/14"
            >
              Enter Dashboard
              <span aria-hidden>→</span>
            </Link>
          </nav>
        </header>

        <div className="flex min-h-[calc(100svh-5rem)] flex-1 flex-col justify-center gap-12 py-12">
          <div className="max-w-4xl">
            <LineReveal
              lines={heroLines}
              active={mounted}
              className="max-w-5xl"
              lineClass="landing-display text-[clamp(3.35rem,8vw,7.85rem)] leading-[0.96] tracking-[-0.055em] text-white"
              delay={120}
            />

            <div {...fadeUp(520)}>
              <p className="mt-8 max-w-xl text-base leading-relaxed text-white/68 md:text-lg">
                GreenChain helps sourcing teams compare manufacturers,
                countries, and transport modes through an environmental lens,
                using open data and fast supplier research.
              </p>
            </div>

            <div {...fadeUp(680)} className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-[#04110a] transition-transform duration-300 hover:-translate-y-0.5"
              >
                Open Platform
                <span aria-hidden>→</span>
              </Link>

              <a
                href="#features"
                className="inline-flex items-center gap-2 text-sm text-white/62 transition-colors hover:text-white"
              >
                See the features
                <span aria-hidden>↓</span>
              </a>
            </div>
          </div>
        </div>

        <div
          {...fadeUp(840)}
          className="grid gap-4 border-t border-white/10 pt-6 md:grid-cols-3"
        >
          {HERO_SIGNALS.map((item) => (
            <div key={item.label} className="landing-panel rounded-[1.35rem] p-4">
              <Eyebrow className="text-white/42">{item.label}</Eyebrow>
              <p className="mt-3 text-xl font-medium tracking-[-0.03em] text-white md:text-2xl">
                {item.value}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/58">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  feature,
  delay = 0,
}: {
  feature: Feature
  delay?: number
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <TiltCard className="landing-panel h-full overflow-hidden rounded-[1.8rem]">
        <div
          className="relative h-64 overflow-hidden border-b border-white/10 md:h-72"
        >
          <ParallaxMedia
            src={feature.img}
            alt={feature.title}
            speed={0.08}
            sizes="(min-width: 1024px) 44vw, 100vw"
            className="h-full"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(4,9,13,0)_0%,_rgba(4,9,13,0.08)_38%,_rgba(4,9,13,0.72)_100%)]" />
        </div>

        <div className="p-6 md:p-7">
          <Eyebrow className="text-primary/78">{feature.label}</Eyebrow>
          <h3 className="landing-display mt-4 text-3xl leading-[0.98] tracking-[-0.045em] text-white">
            {feature.title}
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-white/62 md:text-base">
            {feature.body}
          </p>

          <div className="mt-6 grid gap-2">
            {feature.bullets.map((item) => (
              <div key={item} className="flex gap-3 text-sm text-white/60">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </TiltCard>
    </Reveal>
  )
}

function FeaturesSection() {
  return (
    <section id="features" className="px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-screen-xl">
        <Reveal className="max-w-3xl">
          <Eyebrow className="text-primary/82">What you get</Eyebrow>
          <h2 className="landing-display mt-4 text-4xl leading-[0.95] tracking-[-0.05em] text-white md:text-6xl">
            A fast way to compare sourcing options.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/62 md:text-lg">
            Input a product and destination, compare a few countries and shipping assumptions,
            then review a ranked recommendation.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <FeatureCard
              key={feature.label}
              feature={feature}
              delay={index * 80}
            />
          ))}
        </div>

        <Reveal delay={220} className="mt-12">
          <div className="landing-panel flex flex-col items-start justify-between gap-6 rounded-[2rem] border border-white/10 bg-black/16 p-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <p className="text-sm uppercase tracking-[0.3em] text-white/42">
                Ready to try it?
              </p>
              <p className="mt-3 text-2xl font-medium tracking-[-0.04em] text-white md:text-3xl">
                Open the dashboard and explore the graph + globe.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-[#04110a] transition-transform duration-300 hover:-translate-y-0.5"
            >
              Open Dashboard
              <span aria-hidden>→</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer id="about" className="px-6 pb-12 pt-4 md:px-10">
      <div className="mx-auto flex max-w-screen-xl flex-col gap-8 border-t border-white/8 pt-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/42">
            GreenChain
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/54">
            Compare sourcing options across manufacturers, countries, and
            transport modes through an environmental lens.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/52">
          {[
            ["/dashboard", "Dashboard"],
            ["#platform", "Platform"],
            ["#capabilities", "Capabilities"],
            ["#about", "About"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="transition-colors hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  const prefersReducedMotion = usePrefersReducedMotionSnapshot()
  const hydrated = useHydrated()

  const introMode: "full" | "instant" =
    hydrated && prefersReducedMotion ? "instant" : "full"
  const [introDone, setIntroDone] = useState(false)
  const introActive = !introDone
  const handleIntroDone = useCallback(() => setIntroDone(true), [])

  useEffect(() => {
    if (!introActive) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [introActive])

  return (
    <main className="landing-page min-h-svh overflow-x-hidden text-foreground">
      <LandingIntro
        key={`${hydrated ? 1 : 0}-${introMode}`}
        active={introActive}
        mode={introMode}
        onDone={handleIntroDone}
      />
      <Hero introReady={!introActive} />
      <FeaturesSection />
      <Footer />
    </main>
  )
}
