# Landing Cinematic Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `frontend/app/page.tsx` as a Lightship-inspired cinematic landing page with a scan-sweep globe intro, pinned 4-act scroll-scrubbed product preview, upgraded features section, reveal-on-scroll chrome nav, and Lenis smooth scrolling — while preserving the existing `Launch Platform → /launch` handoff.

**Architecture:** Extract the current inline components from `page.tsx` into focused files under `frontend/components/landing/` and `frontend/hooks/`, then layer new primitives (`ScrollScene`, `Counter`, `use-lenis`, `use-scroll-progress`) and new sections (`IntroSequence`, `ProductPreviewSection`, `ChromeNav`, `CTAFooter`) on top. `page.tsx` becomes a thin orchestrator. All motion respects `prefers-reduced-motion` and degrades on mobile <768px.

**Tech Stack:** Next 16 (App Router), React 19, TypeScript, Tailwind 4, HTML `<canvas>` 2D, IntersectionObserver, `requestAnimationFrame`. Adds `lenis` (~6kb) for smooth scroll. No Framer Motion, no GSAP, no R3F.

---

## File Structure

**New files:**
- `frontend/hooks/use-in-view.ts` — extracted from `page.tsx:106-126`
- `frontend/hooks/use-prefers-reduced-motion.ts` — extracted from `page.tsx:128-153`
- `frontend/hooks/use-scroll-progress.ts` — new, element progress 0→1
- `frontend/hooks/use-lenis.ts` — new, init Lenis smooth scroll
- `frontend/components/landing/reveal.tsx` — extracted from `page.tsx:192-221`
- `frontend/components/landing/line-reveal.tsx` — extracted from `page.tsx:223-256`
- `frontend/components/landing/tilt-card.tsx` — extracted from `page.tsx:338-379`
- `frontend/components/landing/parallax-media.tsx` — extracted from `page.tsx:258-336`
- `frontend/components/landing/three-field.tsx` — extracted from `page.tsx:381-633`
- `frontend/components/landing/scroll-scene.tsx` — new, pinned-section primitive
- `frontend/components/landing/counter.tsx` — new, scroll-driven number ticker
- `frontend/components/landing/intro-sequence.tsx` — new, scan-sweep globe intro
- `frontend/components/landing/hero-section.tsx` — extracted from `page.tsx:635-863`
- `frontend/components/landing/product-preview-section.tsx` — new, 4-act scroll scene
- `frontend/components/landing/features-section.tsx` — extracted + upgraded from `page.tsx:865-963`
- `frontend/components/landing/cta-footer.tsx` — new CTA panel + footer, replaces `page.tsx:965-1015`
- `frontend/components/landing/chrome-nav.tsx` — new reveal-on-scroll nav
- `frontend/components/landing/landing-constants.ts` — shared IMG map + FEATURES/HERO_SIGNALS arrays

**Modified files:**
- `frontend/app/page.tsx` — reduced to orchestrator
- `frontend/app/layout.tsx` — add preload + no-flash body background
- `frontend/app/globals.css` — add `.landing-rail` and `.landing-gradient-border` utilities
- `frontend/package.json` — add `lenis` dep
- `frontend/.gitignore` — (already done by brainstorming, skip)

**Unchanged:** `frontend/components/launch/dashboard-launch-overlay.tsx`, `frontend/components/green-chain-logo.tsx`, `/launch`, `/dashboard`.

---

## Conventions for this plan

- This codebase has no unit test runner configured for the frontend. Verification is via `npm run typecheck`, `npm run lint`, and manual browser inspection on `http://localhost:3000`. Each task's verification steps reflect that.
- "Dev server" means `cd frontend && npm run dev` running in a separate terminal.
- Commits use conventional-commit prefixes (`refactor`, `feat`, `chore`) to match the existing `git log`.
- All new components are client components (`"use client"` at top) unless noted.

---

## Task 1: Extract hooks

**Files:**
- Create: `frontend/hooks/use-in-view.ts`
- Create: `frontend/hooks/use-prefers-reduced-motion.ts`
- Modify: `frontend/app/page.tsx` (remove inline hooks, import from new files)

- [ ] **Step 1: Create `use-in-view.ts`**

```ts
"use client"

import { useEffect, useRef, useState } from "react"

export function useInView(threshold = 0.18) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true)
      },
      { threshold }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}
```

- [ ] **Step 2: Create `use-prefers-reduced-motion.ts`**

```ts
"use client"

import { useEffect, useState, useSyncExternalStore } from "react"

export function usePrefersReducedMotion() {
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

export function usePrefersReducedMotionSnapshot() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
      mediaQuery.addEventListener("change", onStoreChange)
      return () => mediaQuery.removeEventListener("change", onStoreChange)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  )
}
```

- [ ] **Step 3: Update `page.tsx` imports, remove inline hook definitions**

Remove the inline `useInView`, `usePrefersReducedMotion`, and `usePrefersReducedMotionSnapshot` definitions at `page.tsx:106-153`. Add imports at the top:

```ts
import { useInView } from "@/hooks/use-in-view"
import {
  usePrefersReducedMotion,
  usePrefersReducedMotionSnapshot,
} from "@/hooks/use-prefers-reduced-motion"
```

Also remove `useSyncExternalStore` and `useEffectEvent` from the React import line if no longer used in `page.tsx` after this extraction (they will still be needed by `ParallaxMedia` and `Hero`, so keep them).

- [ ] **Step 4: Typecheck and lint**

Run from `frontend/`:
```bash
npm run typecheck
npm run lint
```
Expected: both pass with no new errors.

- [ ] **Step 5: Manual check**

Start `npm run dev`, load `http://localhost:3000`. Expected: landing page renders unchanged, reveal animations still trigger on scroll, reduced-motion still respected.

- [ ] **Step 6: Commit**

```bash
git add frontend/hooks/use-in-view.ts frontend/hooks/use-prefers-reduced-motion.ts frontend/app/page.tsx
git commit -m "refactor(landing): extract in-view and reduced-motion hooks"
```

---

## Task 2: Extract landing constants

**Files:**
- Create: `frontend/components/landing/landing-constants.ts`
- Modify: `frontend/app/page.tsx` (replace inline constants with import)

- [ ] **Step 1: Create `landing-constants.ts`**

Move `IMG`, `HERO_SIGNALS`, `FEATURES`, and the `Feature` type from `page.tsx:19-101`. File contents:

```ts
export const IMG = {
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

export type Feature = {
  img: string
  label: string
  title: string
  body: string
  bullets: string[]
}

export const HERO_SIGNALS = [
  {
    label: "demand",
    value: "Product and destination",
    detail:
      "Define what you need to source, how much you need, and where it needs to arrive.",
  },
  {
    label: "Compare",
    value: "Country and transport",
    detail:
      "Test manufacturing countries side by side and see how shipping mode changes the result.",
  },
  {
    label: "decide",
    value: "Ranking and recommendation",
    detail:
      "Review the tradeoffs quickly and export a short memo with the strongest option.",
  },
] as const

export const FEATURES: Feature[] = [
  {
    img: IMG.warehouse,
    label: "Prototype Flow",
    title: "Compare sourcing scenarios quickly.",
    body: "The brief is intentionally focused: compare a few sourcing options quickly, show what drives the footprint, and make the transport tradeoff obvious.",
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
    body: "The graph view turns suppliers, facilities, and routes into a structure you can inspect instead of a list you have to mentally piece together.",
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
    body: "The geographic view makes transport tradeoffs easier to read by putting facilities and routes into a single global frame.",
    bullets: [
      "Location-driven exploration",
      "Graph + globe side by side",
      "Clearer context for transport choices",
    ],
  },
]

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))
```

- [ ] **Step 2: Update `page.tsx`**

Remove the inline `IMG`, `Feature`, `HERO_SIGNALS`, `FEATURES`, and `clamp` definitions. Replace with:

```ts
import {
  FEATURES,
  HERO_SIGNALS,
  IMG,
  clamp,
  type Feature,
} from "@/components/landing/landing-constants"
```

- [ ] **Step 3: Typecheck, lint, manual check**

```bash
npm run typecheck
npm run lint
```
Load `http://localhost:3000`. Expected: identical render.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/landing/landing-constants.ts frontend/app/page.tsx
git commit -m "refactor(landing): extract constants and helpers"
```

---

## Task 3: Extract Reveal and LineReveal

**Files:**
- Create: `frontend/components/landing/reveal.tsx`
- Create: `frontend/components/landing/line-reveal.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Create `reveal.tsx`**

```tsx
"use client"

import { cn } from "@/lib/utils"
import { useInView } from "@/hooks/use-in-view"

export function Reveal({
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
      className={cn(
        "transition-all duration-[1150ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        className
      )}
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
```

- [ ] **Step 2: Create `line-reveal.tsx`**

```tsx
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
```

- [ ] **Step 3: Update `page.tsx`**

Remove the inline `Reveal` and `LineReveal` definitions (`page.tsx:192-256`). Add imports:

```ts
import { Reveal } from "@/components/landing/reveal"
import { LineReveal } from "@/components/landing/line-reveal"
```

- [ ] **Step 4: Typecheck, lint, manual check**

Expected: hero lines still animate in, feature cards still fade up on scroll.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/landing/reveal.tsx frontend/components/landing/line-reveal.tsx frontend/app/page.tsx
git commit -m "refactor(landing): extract reveal and line-reveal components"
```

---

## Task 4: Extract ParallaxMedia, TiltCard, HeroThreeField

**Files:**
- Create: `frontend/components/landing/parallax-media.tsx`
- Create: `frontend/components/landing/tilt-card.tsx`
- Create: `frontend/components/landing/three-field.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Create `parallax-media.tsx`**

Copy `ParallaxMedia` verbatim from `page.tsx:258-336`. Add required imports at top:

```tsx
"use client"

import { useEffect, useEffectEvent, useRef } from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { clamp } from "@/components/landing/landing-constants"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

export function ParallaxMedia({
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
  // ...existing implementation body from page.tsx:272-335
}
```

Paste the full function body (refs, syncTransform, useEffect, return JSX) unchanged.

- [ ] **Step 2: Create `tilt-card.tsx`**

Copy `TiltCard` from `page.tsx:338-379`:

```tsx
"use client"

import { useRef } from "react"

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

export function TiltCard({
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
        transition: "transform 420ms cubic-bezier(0.16,1,0.3,1)",
        willChange: "transform",
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Create `three-field.tsx`**

Copy `HeroThreeField` from `page.tsx:381-633` verbatim into a new file and rename the export:

```tsx
"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export function ThreeField({ disabled }: { disabled: boolean }) {
  // ...full function body from page.tsx:382-632 unchanged
}
```

The exported name changes from `HeroThreeField` to `ThreeField`. Internal behavior unchanged.

- [ ] **Step 4: Update `page.tsx`**

Remove the inline `ParallaxMedia`, `TiltCard`, `HeroThreeField` definitions. Add:

```ts
import { ParallaxMedia } from "@/components/landing/parallax-media"
import { TiltCard } from "@/components/landing/tilt-card"
import { ThreeField } from "@/components/landing/three-field"
```

Update the single usage site inside `Hero` from `<HeroThreeField disabled={...} />` to `<ThreeField disabled={...} />` (around `page.tsx:759`).

- [ ] **Step 5: Typecheck, lint, manual check**

```bash
npm run typecheck
npm run lint
```
Expected: hero canvas field still animates, feature cards still tilt on hover, images in cards still parallax on scroll.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/landing/parallax-media.tsx frontend/components/landing/tilt-card.tsx frontend/components/landing/three-field.tsx frontend/app/page.tsx
git commit -m "refactor(landing): extract parallax-media, tilt-card, three-field"
```

---

## Task 5: Extract Hero, Features, Footer sections

**Files:**
- Create: `frontend/components/landing/hero-section.tsx`
- Create: `frontend/components/landing/features-section.tsx`
- Create: `frontend/components/landing/cta-footer.tsx` (contains existing footer only for now; CTA panel added in Task 12)
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Create `hero-section.tsx`**

Move the `DashboardLaunchButton`, `Eyebrow`, and `Hero` components from `page.tsx:155-180`, `page.tsx:182-190`, and `page.tsx:635-863`. Export `HeroSection` (renamed from `Hero`) and `DashboardLaunchButton` (still used by other sections):

```tsx
"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"

import { GreenChainLogo } from "@/components/green-chain-logo"
import { LineReveal } from "@/components/landing/line-reveal"
import { ThreeField } from "@/components/landing/three-field"
import {
  HERO_SIGNALS,
  IMG,
} from "@/components/landing/landing-constants"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"

export function DashboardLaunchButton({
  children,
  className,
  disabled = false,
  onLaunch,
}: {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  onLaunch: () => void
}) {
  // ...body unchanged from page.tsx:167-179
}

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <p className={cn("eyebrow", className)}>{children}</p>
}

export function HeroSection({
  introReady,
  isLaunching,
  onLaunchDashboard,
}: {
  introReady: boolean
  isLaunching: boolean
  onLaunchDashboard: () => void
}) {
  // ...full body from page.tsx:644-862 unchanged
}
```

- [ ] **Step 2: Create `features-section.tsx`**

Move `FeatureCard` (`page.tsx:865-907`) and `FeaturesSection` (`page.tsx:909-963`). The exports this task produces still reference the OLD behavior — upgrades happen in Task 13.

```tsx
"use client"

import {
  DashboardLaunchButton,
  Eyebrow,
} from "@/components/landing/hero-section"
import { LineReveal } from "@/components/landing/line-reveal"
import { ParallaxMedia } from "@/components/landing/parallax-media"
import { Reveal } from "@/components/landing/reveal"
import { TiltCard } from "@/components/landing/tilt-card"
import { FEATURES, type Feature } from "@/components/landing/landing-constants"

function FeatureCard({
  feature,
  delay = 0,
}: {
  feature: Feature
  delay?: number
}) {
  // ...body from page.tsx:870-906
}

export function FeaturesSection({
  isLaunching,
  onLaunchDashboard,
}: {
  isLaunching: boolean
  onLaunchDashboard: () => void
}) {
  // ...body from page.tsx:916-962
}
```

- [ ] **Step 3: Create `cta-footer.tsx`**

Initial version is a direct copy of the current `Footer` (`page.tsx:965-1015`). CTA panel will be added in Task 12.

```tsx
"use client"

import {
  DashboardLaunchButton,
} from "@/components/landing/hero-section"

export function CTAFooter({
  isLaunching,
  onLaunchDashboard,
}: {
  isLaunching: boolean
  onLaunchDashboard: () => void
}) {
  return (
    <footer id="about" className="px-6 pt-4 pb-12 md:px-10">
      {/* ...body from page.tsx:974-1013 */}
    </footer>
  )
}
```

- [ ] **Step 4: Rewrite `page.tsx`**

New `page.tsx` is now ~40 lines. Replace entire file contents:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { CTAFooter } from "@/components/landing/cta-footer"
import { DashboardLaunchOverlay } from "@/components/launch/dashboard-launch-overlay"
import { FeaturesSection } from "@/components/landing/features-section"
import { HeroSection } from "@/components/landing/hero-section"
import { usePrefersReducedMotionSnapshot } from "@/hooks/use-prefers-reduced-motion"

export default function LandingPage() {
  const router = useRouter()
  const prefersReducedMotion = usePrefersReducedMotionSnapshot()
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchOverlayRunId, setLaunchOverlayRunId] = useState(0)

  useEffect(() => {
    router.prefetch("/launch")
  }, [router])

  useEffect(() => {
    if (!isLaunching) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isLaunching])

  const handleLaunchDashboard = useCallback(() => {
    if (isLaunching) return
    setLaunchOverlayRunId((id) => id + 1)
    setIsLaunching(true)
  }, [isLaunching])

  const handleLaunchOverlayComplete = useCallback(() => {
    router.push("/launch")
  }, [router])

  return (
    <main className="landing-page min-h-svh overflow-x-hidden text-foreground">
      <DashboardLaunchOverlay
        active={isLaunching}
        key={launchOverlayRunId}
        onComplete={handleLaunchOverlayComplete}
        reducedMotion={prefersReducedMotion}
      />
      <HeroSection
        introReady
        isLaunching={isLaunching}
        onLaunchDashboard={handleLaunchDashboard}
      />
      <FeaturesSection
        isLaunching={isLaunching}
        onLaunchDashboard={handleLaunchDashboard}
      />
      <CTAFooter
        isLaunching={isLaunching}
        onLaunchDashboard={handleLaunchDashboard}
      />
    </main>
  )
}
```

- [ ] **Step 5: Typecheck, lint, full manual check**

Expected: identical landing page render, identical launch flow (`Launch Platform` → overlay → `/launch`).

- [ ] **Step 6: Commit**

```bash
git add frontend/components/landing/hero-section.tsx frontend/components/landing/features-section.tsx frontend/components/landing/cta-footer.tsx frontend/app/page.tsx
git commit -m "refactor(landing): split page.tsx into section components"
```

---

## Task 6: Add Lenis + use-lenis hook

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/hooks/use-lenis.ts`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Install lenis**

Run from `frontend/`:
```bash
npm install lenis
```

- [ ] **Step 2: Create `use-lenis.ts`**

```ts
"use client"

import { useEffect } from "react"
import Lenis from "lenis"

export function useLenis({ disabled }: { disabled: boolean }) {
  useEffect(() => {
    if (disabled) return
    if (window.innerWidth < 768) return

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
    })

    let frame = 0
    const raf = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frame)
      lenis.destroy()
    }
  }, [disabled])
}
```

- [ ] **Step 3: Wire Lenis into `page.tsx`**

Add import and call inside `LandingPage`:

```ts
import { useLenis } from "@/hooks/use-lenis"

// inside LandingPage, after the prefersReducedMotion line:
useLenis({ disabled: prefersReducedMotion || isLaunching })
```

- [ ] **Step 4: Typecheck, lint, manual check**

```bash
npm run typecheck
npm run lint
```
Open `http://localhost:3000`. Expected: page scroll has perceptible inertia/easing on desktop. On mobile viewport (DevTools device toolbar at 375px) or with reduced-motion toggled: native scroll.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/hooks/use-lenis.ts frontend/app/page.tsx
git commit -m "feat(landing): add lenis smooth scroll"
```

---

## Task 7: Add use-scroll-progress hook

**Files:**
- Create: `frontend/hooks/use-scroll-progress.ts`

- [ ] **Step 1: Create `use-scroll-progress.ts`**

Computes 0→1 progress of an element through the viewport. Starts at 0 when the element's top hits the viewport bottom, reaches 1 when the element's bottom hits the viewport top.

```ts
"use client"

import { useEffect, useRef, useState } from "react"

import { clamp } from "@/components/landing/landing-constants"

export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let frame = 0

    const update = () => {
      const rect = element.getBoundingClientRect()
      const viewportHeight = window.innerHeight || 1
      const total = rect.height + viewportHeight
      const traveled = viewportHeight - rect.top
      setProgress(clamp(traveled / total, 0, 1))
    }

    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  return { ref, progress }
}
```

- [ ] **Step 2: Typecheck, lint**

```bash
npm run typecheck
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add frontend/hooks/use-scroll-progress.ts
git commit -m "feat(landing): add use-scroll-progress hook"
```

---

## Task 8: Add ScrollScene primitive

**Files:**
- Create: `frontend/components/landing/scroll-scene.tsx`

- [ ] **Step 1: Create `scroll-scene.tsx`**

```tsx
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
```

- [ ] **Step 2: Typecheck, lint**

```bash
npm run typecheck
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/landing/scroll-scene.tsx
git commit -m "feat(landing): add scroll-scene primitive"
```

---

## Task 9: Add Counter primitive

**Files:**
- Create: `frontend/components/landing/counter.tsx`

- [ ] **Step 1: Create `counter.tsx`**

Accepts an external `progress` 0→1 and ticks a number from `from` to `to`. For reduced-motion, shows `to` immediately.

```tsx
"use client"

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

export function Counter({
  from = 0,
  to,
  progress,
  decimals = 0,
  suffix = "",
  className,
}: {
  from?: number
  to: number
  progress: number
  decimals?: number
  suffix?: string
  className?: string
}) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const effective = prefersReducedMotion ? 1 : Math.max(0, Math.min(1, progress))
  const value = from + (to - from) * effective
  return (
    <span className={className}>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  )
}
```

- [ ] **Step 2: Typecheck, lint**

```bash
npm run typecheck
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/landing/counter.tsx
git commit -m "feat(landing): add counter primitive"
```

---

## Task 10: Build IntroSequence (scan-sweep globe)

**Files:**
- Create: `frontend/components/landing/intro-sequence.tsx`
- Modify: `frontend/app/page.tsx` (mount it + gate hero)

- [ ] **Step 1: Create `intro-sequence.tsx`**

Single canvas, single RAF loop, full 2.5s cinematic. Uses a fixed array of 12 pin coordinates and 4 arc pairs for determinism. Calls `onComplete()` when finished, or immediately when `skipped` / reduced-motion.

```tsx
"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { GreenChainLogo } from "@/components/green-chain-logo"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"

const DURATION_MS = 2500
const SESSION_KEY = "gc:intro-seen"

const PINS: Array<{ x: number; y: number; color: string; delay: number }> = [
  { x: 0.18, y: 0.42, color: "148,255,209", delay: 0.22 },
  { x: 0.27, y: 0.55, color: "235,196,124", delay: 0.28 },
  { x: 0.34, y: 0.36, color: "148,255,209", delay: 0.32 },
  { x: 0.41, y: 0.48, color: "148,255,209", delay: 0.38 },
  { x: 0.49, y: 0.62, color: "235,196,124", delay: 0.44 },
  { x: 0.55, y: 0.4, color: "148,255,209", delay: 0.5 },
  { x: 0.62, y: 0.52, color: "148,255,209", delay: 0.56 },
  { x: 0.69, y: 0.38, color: "235,196,124", delay: 0.62 },
  { x: 0.75, y: 0.6, color: "226,75,74", delay: 0.68 },
  { x: 0.81, y: 0.45, color: "148,255,209", delay: 0.74 },
  { x: 0.87, y: 0.52, color: "148,255,209", delay: 0.8 },
  { x: 0.93, y: 0.36, color: "235,196,124", delay: 0.86 },
]

const ARCS: Array<[number, number]> = [
  [0, 5],
  [2, 8],
  [4, 10],
  [6, 11],
]

type IntroSequenceProps = {
  onComplete: () => void
}

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [showSkip, setShowSkip] = useState(false)
  const [exiting, setExiting] = useState(false)
  const completedRef = useRef(false)

  const complete = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    setExiting(true)
    window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1")
      } catch {}
      onComplete()
    }, 420)
  }, [onComplete])

  useEffect(() => {
    if (prefersReducedMotion) {
      complete()
      return
    }

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const context = canvas.getContext("2d")
    if (!context) {
      complete()
      return
    }

    let frame = 0
    let width = 1
    let height = 1
    const start = performance.now()

    const resize = () => {
      const rect = container.getBoundingClientRect()
      width = rect.width
      height = rect.height
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener("resize", resize)

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      context.clearRect(0, 0, width, height)

      // Globe ellipse at center
      const cx = width * 0.5
      const cy = height * 0.5
      const globeR = Math.min(width, height) * 0.34
      const globeOpacity = t < 0.24 ? t / 0.24 : 1 - Math.max(0, (t - 0.82) / 0.18) * 0.35

      context.save()
      context.globalAlpha = Math.max(0, globeOpacity)
      context.strokeStyle = "rgba(148,255,209,0.28)"
      context.lineWidth = 1
      context.beginPath()
      context.ellipse(cx, cy, globeR, globeR * 0.62, 0, 0, Math.PI * 2)
      context.stroke()
      for (let i = -2; i <= 2; i++) {
        context.beginPath()
        const yy = cy + i * globeR * 0.22
        context.moveTo(cx - globeR * Math.cos(Math.asin(Math.min(1, Math.abs(i) * 0.35))), yy)
        context.lineTo(cx + globeR * Math.cos(Math.asin(Math.min(1, Math.abs(i) * 0.35))), yy)
        context.strokeStyle = "rgba(148,255,209,0.12)"
        context.stroke()
      }
      context.restore()

      // Scan line
      if (t > 0.22 && t < 0.9) {
        const scanT = (t - 0.22) / 0.68
        const scanX = cx - globeR + scanT * globeR * 2
        const scanGrad = context.createLinearGradient(scanX - 60, 0, scanX + 60, 0)
        scanGrad.addColorStop(0, "rgba(148,255,209,0)")
        scanGrad.addColorStop(0.5, "rgba(148,255,209,0.55)")
        scanGrad.addColorStop(1, "rgba(148,255,209,0)")
        context.fillStyle = scanGrad
        context.fillRect(scanX - 60, cy - globeR * 0.62, 120, globeR * 1.24)
      }

      // Pins
      const bounds = {
        left: cx - globeR,
        top: cy - globeR * 0.62,
        w: globeR * 2,
        h: globeR * 1.24,
      }
      for (const pin of PINS) {
        if (t < pin.delay) continue
        const pinT = Math.min(1, (t - pin.delay) / 0.14)
        const px = bounds.left + pin.x * bounds.w
        const py = bounds.top + pin.y * bounds.h
        const size = 2 + pinT * 3
        const bloom = context.createRadialGradient(px, py, 0, px, py, size * 4.5)
        bloom.addColorStop(0, `rgba(${pin.color},${0.55 * pinT})`)
        bloom.addColorStop(1, `rgba(${pin.color},0)`)
        context.fillStyle = bloom
        context.beginPath()
        context.arc(px, py, size * 4.5, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = `rgba(${pin.color},${0.95 * pinT})`
        context.beginPath()
        context.arc(px, py, size, 0, Math.PI * 2)
        context.fill()
      }

      // Arcs
      for (let i = 0; i < ARCS.length; i++) {
        const [a, b] = ARCS[i]
        const arcStart = 0.55 + i * 0.06
        if (t < arcStart) continue
        const arcT = Math.min(1, (t - arcStart) / 0.28)
        const ax = bounds.left + PINS[a].x * bounds.w
        const ay = bounds.top + PINS[a].y * bounds.h
        const bx = bounds.left + PINS[b].x * bounds.w
        const by = bounds.top + PINS[b].y * bounds.h
        const mx = (ax + bx) / 2
        const my = (ay + by) / 2 - 40
        context.strokeStyle = `rgba(148,255,209,${0.35 * arcT})`
        context.lineWidth = 1.4
        context.beginPath()
        context.moveTo(ax, ay)
        const endX = ax + (bx - ax) * arcT
        const endY = ay + (by - ay) * arcT
        context.quadraticCurveTo(mx, my, endX, endY)
        context.stroke()
      }

      if (t >= 1) {
        complete()
        return
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)

    const skipTimer = window.setTimeout(() => setShowSkip(true), 800)
    const onAnyKey = () => complete()
    window.addEventListener("keydown", onAnyKey)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
      window.clearTimeout(skipTimer)
      window.removeEventListener("keydown", onAnyKey)
    }
  }, [complete, prefersReducedMotion])

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center bg-[#05090c] transition-opacity duration-[420ms]",
        exiting ? "pointer-events-none opacity-0" : "opacity-100"
      )}
      onClick={() => complete()}
      aria-hidden
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <GreenChainLogo variant="onDark" className="h-10 w-auto md:h-12" />
      </div>
      {showSkip && !exiting && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            complete()
          }}
          className="absolute right-6 bottom-6 text-xs tracking-[0.3em] text-white/50 uppercase transition-colors hover:text-white"
        >
          Skip intro
        </button>
      )}
    </div>
  )
}

export function hasSeenIntro(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1"
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Gate hero video on `introReady`**

Open `frontend/components/landing/hero-section.tsx`. Inside the `HeroSection` component's video effect (the large `useEffect` that calls `syncVideo`), change the guard so the video is paused until intro completes. Locate the block that looks like:

```tsx
if (prefersReducedMotion || isLaunching) {
  video.pause()
  return
}
```

Change to:

```tsx
if (prefersReducedMotion || isLaunching || !introReady) {
  video.pause()
  return
}
```

Also update the `syncVideo` `useEffectEvent` body the same way so `.play()` cannot fire during the intro.

- [ ] **Step 3: Wire into `page.tsx`**

Replace the `introReady` hard-coded `true` prop with state controlled by the intro. Update `page.tsx`:

```tsx
import { IntroSequence, hasSeenIntro } from "@/components/landing/intro-sequence"

// inside LandingPage, replace initial state block:
const [introReady, setIntroReady] = useState(() => false)
const [showIntro, setShowIntro] = useState(() => false)

useEffect(() => {
  if (hasSeenIntro()) {
    setIntroReady(true)
    return
  }
  setShowIntro(true)
}, [])

const handleIntroComplete = useCallback(() => {
  setShowIntro(false)
  setIntroReady(true)
}, [])

// in the JSX, before <HeroSection>:
{showIntro && <IntroSequence onComplete={handleIntroComplete} />}

// change <HeroSection introReady ... /> to:
<HeroSection
  introReady={introReady}
  isLaunching={isLaunching}
  onLaunchDashboard={handleLaunchDashboard}
/>
```

- [ ] **Step 4: Typecheck, lint, manual check**

```bash
npm run typecheck
npm run lint
```
Load `http://localhost:3000` in an Incognito window (fresh sessionStorage). Expected: 2.5s intro plays, then hero reveals (video begins only after intro). Reload: intro skipped, hero immediate. Toggle reduced-motion in System Settings: intro skipped, hero immediate. Click during intro: intro collapses.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/landing/intro-sequence.tsx frontend/components/landing/hero-section.tsx frontend/app/page.tsx
git commit -m "feat(landing): add scan-sweep globe intro sequence"
```

---

## Task 11: Build ProductPreviewSection (4-act pinned scroll)

**Files:**
- Create: `frontend/components/landing/product-preview-section.tsx`
- Modify: `frontend/app/page.tsx` (mount between hero and features)

- [ ] **Step 1: Create `product-preview-section.tsx`**

A 300vh container using `ScrollScene`; renders 4 acts on a single full-bleed canvas with cross-fade between adjacent acts. Deterministic node positions. Reduced-motion fallback: 4 stacked static cards.

```tsx
"use client"

import { useEffect, useRef } from "react"

import { Counter } from "@/components/landing/counter"
import { ScrollScene } from "@/components/landing/scroll-scene"
import { Eyebrow } from "@/components/landing/hero-section"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { clamp } from "@/components/landing/landing-constants"

const ACTS = [
  {
    label: "01",
    title: "A request arrives",
    body: "Product, destination, candidate countries, transport mode.",
  },
  {
    label: "02",
    title: "Agents discover in parallel",
    body: "A Dedalus swarm fans out — discovery, certifications, memo.",
  },
  {
    label: "03",
    title: "The score composes",
    body: "Five dimensions. Manufacturing, transport, grid, certs, risk.",
  },
  {
    label: "04",
    title: "A memo lands",
    body: "Rank-one manufacturer, five bullets, cited sources.",
  },
] as const

function actProgress(progress: number, index: number): number {
  const actStart = index * 0.25
  const actEnd = actStart + 0.3
  return clamp((progress - actStart) / (actEnd - actStart), 0, 1)
}

function actVisibility(progress: number, index: number): number {
  const center = index * 0.25 + 0.125
  const distance = Math.abs(progress - center)
  return clamp(1 - distance / 0.2, 0, 1)
}

export function ProductPreviewSection() {
  const prefersReducedMotion = usePrefersReducedMotion()

  if (prefersReducedMotion) {
    return (
      <section
        id="product"
        className="px-6 py-24 md:px-10"
        aria-label="How GreenChain works"
      >
        <div className="mx-auto grid max-w-screen-xl gap-6 md:grid-cols-2">
          {ACTS.map((act) => (
            <div key={act.label} className="landing-panel rounded-[1.5rem] p-8">
              <p className="eyebrow text-primary/78">{act.label}</p>
              <h3 className="landing-display mt-3 text-3xl tracking-[-0.04em] text-white">
                {act.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/62">
                {act.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section
      id="product"
      aria-label="How GreenChain works"
      className="relative"
    >
      <ScrollScene totalVh={360}>
        {(progress) => <PreviewStage progress={progress} />}
      </ScrollScene>
    </section>
  )
}

function PreviewStage({ progress }: { progress: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(progress)
  progressRef.current = progress

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const context = canvas.getContext("2d")
    if (!context) return

    let frame = 0
    let width = 1
    let height = 1

    const NODES = Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * Math.PI * 2
      const radius = 0.22 + ((i * 37) % 100) / 800
      const seedOffset = ((i * 131) % 100) / 200 - 0.25
      return {
        angle,
        radius,
        wobble: seedOffset,
        rating: i % 5 === 0 ? "red" : i % 3 === 0 ? "amber" : "green",
      }
    })

    const AGENTS = [
      { angle: -Math.PI / 2, label: "discovery" },
      { angle: Math.PI / 6, label: "certification" },
      { angle: (Math.PI * 5) / 6, label: "memo" },
    ]

    const resize = () => {
      const rect = container.getBoundingClientRect()
      width = rect.width
      height = rect.height
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const tick = () => {
      const p = progressRef.current
      context.clearRect(0, 0, width, height)

      const cx = width * 0.5
      const cy = height * 0.5
      const R = Math.min(width, height) * 0.32

      // Act 1: orchestrator pulse (always present, pulses strongest in act 1)
      const pulse = actVisibility(p, 0)
      const pulseR = 12 + pulse * 16
      const orb = context.createRadialGradient(cx, cy, 0, cx, cy, pulseR * 3)
      orb.addColorStop(0, `rgba(148,255,209,${0.35 + pulse * 0.35})`)
      orb.addColorStop(1, "rgba(148,255,209,0)")
      context.fillStyle = orb
      context.beginPath()
      context.arc(cx, cy, pulseR * 3, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = `rgba(148,255,209,${0.55 + pulse * 0.3})`
      context.beginPath()
      context.arc(cx, cy, 6, 0, Math.PI * 2)
      context.fill()

      // Act 2: agent nodes fanning + manufacturer nodes
      const fanP = actProgress(p, 1)
      for (const agent of AGENTS) {
        const dist = R * 0.5 * fanP
        const ax = cx + Math.cos(agent.angle) * dist
        const ay = cy + Math.sin(agent.angle) * dist
        context.strokeStyle = `rgba(148,255,209,${0.22 * fanP})`
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(cx, cy)
        context.lineTo(ax, ay)
        context.stroke()
        context.fillStyle = `rgba(148,255,209,${0.6 * fanP})`
        context.beginPath()
        context.arc(ax, ay, 4, 0, Math.PI * 2)
        context.fill()
      }

      // Manufacturer leaves (act 2 onward)
      const leavesP = actProgress(p, 1)
      const scoreP = actProgress(p, 2)
      for (let i = 0; i < NODES.length; i++) {
        const node = NODES[i]
        const perNodeStart = i / NODES.length
        if (leavesP < perNodeStart * 0.9) continue
        const appear = clamp((leavesP - perNodeStart * 0.9) / 0.1, 0, 1)
        const nx = cx + Math.cos(node.angle) * R * (0.8 + node.wobble)
        const ny = cy + Math.sin(node.angle) * R * (0.8 + node.wobble) * 0.72
        const color =
          scoreP > perNodeStart
            ? node.rating === "green"
              ? "29,158,117"
              : node.rating === "amber"
                ? "186,117,23"
                : "226,75,74"
            : "180,178,169"
        context.fillStyle = `rgba(${color},${0.85 * appear})`
        context.beginPath()
        context.arc(nx, ny, 3 + appear * 2, 0, Math.PI * 2)
        context.fill()
      }

      // Act 3: weighted dimension ring around the top node (deterministic: NODES[0])
      const ringP = actProgress(p, 2)
      if (ringP > 0) {
        const top = NODES[0]
        const rx = cx + Math.cos(top.angle) * R * (0.8 + top.wobble)
        const ry = cy + Math.sin(top.angle) * R * (0.8 + top.wobble) * 0.72
        const segments = 5
        for (let s = 0; s < segments; s++) {
          const segStart = (-Math.PI / 2) + (s / segments) * Math.PI * 2
          const segEnd = segStart + (Math.PI * 2) / segments - 0.08
          context.strokeStyle = `rgba(148,255,209,${0.35 * ringP})`
          context.lineWidth = 3
          context.beginPath()
          context.arc(rx, ry, 14 + s * 1.5, segStart, segEnd * ringP + segStart * (1 - ringP))
          context.stroke()
        }
      }

      frame = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener("resize", resize)
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
    }
  }, [])

  const activeIndex = Math.min(3, Math.floor(progress * 4))
  const act = ACTS[activeIndex]
  const memoP = actProgress(progress, 3)

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full bg-[radial-gradient(circle_at_50%_45%,_rgba(29,158,117,0.08),_transparent_60%)]"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="relative z-10 mx-auto flex h-full max-w-screen-xl flex-col justify-between px-6 py-12 md:px-10 md:py-20">
        <div className="max-w-md">
          <Eyebrow className="text-primary/82">{act.label} · How it works</Eyebrow>
          <h2 className="landing-display mt-4 text-4xl leading-[1] tracking-[-0.045em] text-white md:text-6xl">
            {act.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/62 md:text-base">
            {act.body}
          </p>
        </div>

        <div
          className="landing-panel ml-auto w-full max-w-sm rounded-[1.5rem] p-6 transition-opacity duration-500"
          style={{ opacity: memoP }}
          aria-hidden={memoP < 0.5}
        >
          <p className="eyebrow text-primary/78">Memo draft</p>
          <p className="mt-3 text-lg font-medium tracking-[-0.03em] text-white">
            Rank 1 · Alentejo Têxtil · Portugal
          </p>
          <p className="mt-2 text-sm text-white/62">Composite score</p>
          <p className="landing-display mt-1 text-5xl tracking-[-0.04em] text-primary">
            <Counter to={82} progress={memoP} />
            <span className="ml-1 text-xl text-white/40">/ 100</span>
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `page.tsx`**

Add import and mount between hero and features:

```tsx
import { ProductPreviewSection } from "@/components/landing/product-preview-section"

// in JSX:
<HeroSection ... />
<ProductPreviewSection />
<FeaturesSection ... />
```

- [ ] **Step 3: Typecheck, lint, manual check**

```bash
npm run typecheck
npm run lint
```
Scroll from hero → pinned section stays fixed for ~3 viewport heights, canvas nodes fan out, colors land, memo card fades in and counter ticks to 82. Toggle reduced-motion: 4 stacked cards render instead.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/landing/product-preview-section.tsx frontend/app/page.tsx
git commit -m "feat(landing): add 4-act pinned product preview"
```

---

## Task 12: Upgrade FeaturesSection

**Files:**
- Modify: `frontend/components/landing/features-section.tsx`
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Add CSS utilities**

Append to `frontend/app/globals.css`:

```css
.landing-gradient-border {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--card), var(--card)) padding-box,
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.03)) border-box;
}

.landing-rail {
  position: absolute;
  left: 1rem;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    color-mix(in oklab, var(--primary) 55%, transparent) 50%,
    transparent 100%
  );
  transform: scaleY(var(--rail, 0));
  transform-origin: top;
  transition: transform 900ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

- [ ] **Step 2: Upgrade `features-section.tsx`**

Replace the contents of `features-section.tsx` with the upgraded version:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"

import {
  DashboardLaunchButton,
  Eyebrow,
} from "@/components/landing/hero-section"
import { LineReveal } from "@/components/landing/line-reveal"
import { ParallaxMedia } from "@/components/landing/parallax-media"
import { Reveal } from "@/components/landing/reveal"
import { TiltCard } from "@/components/landing/tilt-card"
import { FEATURES, type Feature } from "@/components/landing/landing-constants"
import { useInView } from "@/hooks/use-in-view"

function FeatureCard({
  feature,
  delay = 0,
}: {
  feature: Feature
  delay?: number
}) {
  const { ref, inView } = useInView(0.22)

  return (
    <div ref={ref} className="h-full">
      <Reveal delay={delay} className="h-full">
        <TiltCard className="landing-panel landing-gradient-border h-full overflow-hidden rounded-[1.8rem]">
          <div className="relative h-64 overflow-hidden border-b border-white/10 md:h-72">
            <ParallaxMedia
              src={feature.img}
              alt={feature.title}
              speed={0.16}
              sizes="(min-width: 1024px) 44vw, 100vw"
              className="h-full"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(4,9,13,0)_0%,_rgba(4,9,13,0.08)_38%,_rgba(4,9,13,0.72)_100%)]" />
          </div>

          <div className="p-6 md:p-7">
            <Eyebrow className="text-primary/78">{feature.label}</Eyebrow>
            <LineReveal
              lines={[feature.title]}
              active={inView}
              delay={delay + 120}
              className="mt-4"
              lineClass="landing-display text-3xl leading-[0.98] tracking-[-0.045em] text-white"
            />
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
    </div>
  )
}

export function FeaturesSection({
  isLaunching,
  onLaunchDashboard,
}: {
  isLaunching: boolean
  onLaunchDashboard: () => void
}) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [rail, setRail] = useState(0)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    let frame = 0
    const update = () => {
      const rect = section.getBoundingClientRect()
      const viewport = window.innerHeight || 1
      const raw = (viewport - rect.top) / (rect.height + viewport)
      setRail(Math.min(1, Math.max(0, raw)))
    }

    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative px-6 py-24 md:px-10 md:py-32"
    >
      <div
        className="landing-rail hidden lg:block"
        style={{ "--rail": rail } as React.CSSProperties}
      />
      <div className="mx-auto max-w-screen-xl">
        <Reveal className="max-w-3xl">
          <Eyebrow className="text-primary/82">What you get</Eyebrow>
          <h2 className="landing-display mt-4 text-4xl leading-[0.95] tracking-[-0.05em] text-white md:text-6xl">
            A fast way to compare sourcing options.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/62 md:text-lg">
            Input a product and destination, compare a few countries and
            shipping assumptions, then review a ranked recommendation.
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
          <div className="landing-panel landing-gradient-border flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-black/16 p-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <p className="text-sm tracking-[0.3em] text-white/42 uppercase">
                Ready to try it?
              </p>
              <p className="mt-3 text-2xl font-medium tracking-[-0.04em] text-white md:text-3xl">
                Choose a CSV intake or continue into the demo dashboard.
              </p>
            </div>
            <DashboardLaunchButton
              onLaunch={onLaunchDashboard}
              disabled={isLaunching}
              className="landing-button landing-button--solid inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-[#04110a] hover:-translate-y-0.5"
            >
              Open launch options
              <span aria-hidden>→</span>
            </DashboardLaunchButton>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Typecheck, lint, manual check**

Expected: feature cards now have gradient-stroke borders, titles animate in line-by-line per card, parallax on images is more pronounced, and a green rail fills along the left edge of the section on large viewports.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/landing/features-section.tsx frontend/app/globals.css
git commit -m "feat(landing): upgrade features section polish and scroll rail"
```

---

## Task 13: Build CTAFooter (CTA panel + compact footer with data-sources strip)

**Files:**
- Modify: `frontend/components/landing/cta-footer.tsx`

- [ ] **Step 1: Replace `cta-footer.tsx` contents**

```tsx
"use client"

import Link from "next/link"

import {
  DashboardLaunchButton,
} from "@/components/landing/hero-section"
import { GreenChainLogo } from "@/components/green-chain-logo"
import { Reveal } from "@/components/landing/reveal"

const DATA_SOURCES = ["EPA USEEIO", "Ember", "GLEC", "ND-GAIN", "CDP"]

export function CTAFooter({
  isLaunching,
  onLaunchDashboard,
}: {
  isLaunching: boolean
  onLaunchDashboard: () => void
}) {
  return (
    <>
      <section
        id="cta"
        className="relative overflow-hidden border-t border-white/8 px-6 py-32 md:px-10 md:py-40"
      >
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_40%,_rgba(29,158,117,0.16),_transparent_55%),radial-gradient(circle_at_50%_85%,_rgba(14,23,24,0)_0%,_rgba(2,7,10,0.85)_100%)]"
        />
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm tracking-[0.4em] text-white/42 uppercase">
            Ready to try it?
          </p>
          <h2 className="landing-display mt-5 text-5xl leading-[0.95] tracking-[-0.05em] text-white md:text-7xl">
            See your first comparison in under a minute.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-white/62 md:text-lg">
            The demo loads a pre-seeded 20-node graph over 16 routes. Flip the
            transport mode and watch the rankings re-settle client-side.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <DashboardLaunchButton
              onLaunch={onLaunchDashboard}
              disabled={isLaunching}
              className="landing-button landing-button--solid inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-medium text-[#04110a] hover:-translate-y-0.5"
            >
              Open Platform
              <span aria-hidden>→</span>
            </DashboardLaunchButton>
          </div>
        </Reveal>
      </section>

      <footer id="about" className="px-6 pt-4 pb-12 md:px-10">
        <div className="mx-auto flex max-w-screen-xl flex-col gap-8 border-t border-white/8 pt-8 md:flex-row md:items-start md:justify-between">
          <div>
            <GreenChainLogo
              variant="onDark"
              className="h-8 w-auto"
            />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/54">
              Compare sourcing options across manufacturers, countries, and
              transport modes through an environmental lens.
            </p>
            <div className="mt-5">
              <p className="text-[10px] tracking-[0.3em] text-white/32 uppercase">
                Built on
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/48">
                {DATA_SOURCES.join(" · ")}
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/52">
            <DashboardLaunchButton
              onLaunch={onLaunchDashboard}
              disabled={isLaunching}
              className="transition-colors hover:text-white"
            >
              Launch
            </DashboardLaunchButton>
            <Link
              href="#features"
              className="transition-colors hover:text-white"
            >
              Features
            </Link>
            <Link
              href="#product"
              className="transition-colors hover:text-white"
            >
              How it works
            </Link>
            <Link
              href="#about"
              className="transition-colors hover:text-white"
            >
              About
            </Link>
          </nav>
        </div>
      </footer>
    </>
  )
}
```

- [ ] **Step 2: Typecheck, lint, manual check**

Scroll to bottom. Expected: large centered CTA panel with radial green glow, primary Open Platform button, followed by a compact footer with a `BUILT ON` credibility strip listing the five data sources.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/landing/cta-footer.tsx
git commit -m "feat(landing): add cinematic CTA panel and data-sources footer"
```

---

## Task 14: Build ChromeNav (reveal-on-scroll-up)

**Files:**
- Create: `frontend/components/landing/chrome-nav.tsx`
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/components/landing/hero-section.tsx` (hide in-hero nav past 60vh)

- [ ] **Step 1: Create `chrome-nav.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { GreenChainLogo } from "@/components/green-chain-logo"
import {
  DashboardLaunchButton,
} from "@/components/landing/hero-section"
import { cn } from "@/lib/utils"

export function ChromeNav({
  isLaunching,
  onLaunchDashboard,
}: {
  isLaunching: boolean
  onLaunchDashboard: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [past, setPast] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    let frame = 0

    const update = () => {
      const y = window.scrollY
      const threshold = window.innerHeight * 0.6
      const isPast = y > threshold
      setPast(isPast)

      if (!isPast) {
        setVisible(false)
      } else {
        setVisible(y < lastY)
      }
      lastY = y
    }

    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
    }
  }, [])

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        past ? "pointer-events-auto" : "pointer-events-none",
        visible
          ? "translate-y-0 opacity-100"
          : "-translate-y-full opacity-0"
      )}
    >
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 border-b border-white/8 bg-black/50 px-6 py-3 backdrop-blur-xl md:px-10">
        <Link href="/" className="inline-flex items-center">
          <GreenChainLogo variant="onDark" className="h-7 w-auto" />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="#product"
            className="text-sm text-white/58 transition-colors hover:text-white"
          >
            How it works
          </Link>
          <Link
            href="#features"
            className="text-sm text-white/58 transition-colors hover:text-white"
          >
            Features
          </Link>
          <Link
            href="#about"
            className="text-sm text-white/58 transition-colors hover:text-white"
          >
            About
          </Link>
          <DashboardLaunchButton
            onLaunch={onLaunchDashboard}
            disabled={isLaunching}
            className="landing-button landing-button--ghost inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-5 py-2 text-sm text-white backdrop-blur-xl hover:border-white/28 hover:bg-white/14"
          >
            Launch Platform
            <span aria-hidden>→</span>
          </DashboardLaunchButton>
        </nav>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `page.tsx`**

Add import and mount before `<HeroSection>`:

```tsx
import { ChromeNav } from "@/components/landing/chrome-nav"

// in JSX, before HeroSection:
<ChromeNav
  isLaunching={isLaunching}
  onLaunchDashboard={handleLaunchDashboard}
/>
```

- [ ] **Step 3: Hide in-hero nav past 60vh (optional polish)**

In `hero-section.tsx`, the `<header>` element at the top of `HeroSection` contains the in-hero nav. Add a fade-out as user scrolls past 60vh. At the top of `HeroSection`, add:

```tsx
const [navFade, setNavFade] = useState(1)
useEffect(() => {
  let frame = 0
  const update = () => {
    const y = window.scrollY
    const threshold = window.innerHeight * 0.6
    setNavFade(y > threshold ? 0 : 1)
  }
  const onScroll = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(update)
  }
  update()
  window.addEventListener("scroll", onScroll, { passive: true })
  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener("scroll", onScroll)
  }
}, [])
```

Then update the `<header>` wrapper inline style to `style={{ opacity: navFade, transition: "opacity 320ms ease" }}`.

- [ ] **Step 4: Typecheck, lint, manual check**

Expected: on initial load, hero nav visible, chrome nav hidden. Scroll past ~60vh: hero nav fades out, chrome nav reveals from top on scroll up, hides on scroll down.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/landing/chrome-nav.tsx frontend/app/page.tsx frontend/components/landing/hero-section.tsx
git commit -m "feat(landing): add reveal-on-scroll chrome nav"
```

---

## Task 15: No-flash + asset preload

**Files:**
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: Add preload to layout**

Update `frontend/app/layout.tsx`:

```tsx
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"

const HERO_BG =
  "/landing/Cinematic_top-down_aerial_photograph_of_an_expansi-1776490199103.png"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans antialiased")}
    >
      <head>
        <link
          rel="preload"
          as="image"
          href={HERO_BG}
          fetchPriority="high"
        />
      </head>
      <body className="bg-background">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Add no-flash CSS**

Append to `frontend/app/globals.css`:

```css
html,
body {
  background-color: var(--background);
}
```

- [ ] **Step 3: Typecheck, lint, manual check**

Hard-refresh the landing page. Expected: no white flash before hero paints.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/layout.tsx frontend/app/globals.css
git commit -m "chore(landing): preload hero bg and prevent white flash"
```

---

## Task 16: Final QA pass

- [ ] **Step 1: Typecheck + lint (clean)**

```bash
cd frontend
npm run typecheck
npm run lint
```
Expected: both pass with no errors.

- [ ] **Step 2: Desktop browser matrix**

Open `http://localhost:3000` in a fresh Incognito window in Chrome, Safari, and Firefox. For each:
- Intro plays for ~2.5s, then hero reveals.
- Smooth inertial scroll feels present on wheel/trackpad.
- Scroll down: pinned product preview stays fixed for 3 viewport heights, acts 1-4 progress, memo counter ticks to 82.
- Features section: cards tilt on hover, parallax is visible, left rail fills.
- CTA section: large headline, Open Platform button clickable.
- Scroll back up past 60vh: chrome nav slides down from top.
- Click Launch Platform: dashboard overlay animates, route transitions to `/launch`.

- [ ] **Step 3: Mobile emulation**

Open DevTools device toolbar, switch to iPhone 14 Pro (393x852) and Pixel 7 (412x915). For each:
- Intro plays.
- Pinned section falls back to stacked static cards (4 cards, one per act).
- Lenis is disabled (native scroll).
- Chrome nav still works on scroll-up.

- [ ] **Step 4: Reduced motion**

Enable System Settings → Accessibility → Reduce Motion (macOS). Reload `http://localhost:3000`. Expected: intro skipped, no Lenis, no parallax drift, pinned section shows static cards, feature cards render without tilt, counter shows `82` immediately.

- [ ] **Step 5: Session cache**

Fresh Incognito: intro plays. Reload same tab: intro does NOT play. Close tab, open new Incognito: intro plays again.

- [ ] **Step 6: Launch flow regression**

Click Launch Platform from:
- Hero primary CTA
- Hero "Launch Platform" nav button
- Chrome nav (past 60vh)
- Features CTA card
- CTA section
- Footer nav "Launch"

All six should route to `/launch` through `DashboardLaunchOverlay` unchanged.

- [ ] **Step 7: Lighthouse spot check**

Open DevTools → Lighthouse. Run a Performance audit on `http://localhost:3000` in Incognito with no throttling. Note the Performance score.

If Performance dropped more than 5 points vs the pre-redesign baseline (if known), investigate: check if the hero video is autoplaying during the intro (it should not — see `hero-section.tsx`, video.play() should be gated on `introReady`), or if the intro canvas is still running after completion.

- [ ] **Step 8: Final commit if any fixes were needed**

If any QA step required a fix:

```bash
git add -A
git commit -m "fix(landing): QA pass corrections"
```

Otherwise, nothing to commit at this step.

---

## Spec coverage checklist

Confirming each section of the design spec maps to a task:

- §3.1 Intro sequence → Task 10
- §3.2 Hero (intro-gated, video play gated) → Task 5 (extract) + Task 10 Step 2 (introReady wiring) + Task 16 Step 7 (video gating verified)
- §3.3 Pinned product preview → Tasks 7, 8, 9, 11
- §3.4 Features upgrades → Task 12
- §3.5 CTA + Footer → Task 13
- §4.1 Lenis → Task 6
- §4.2 ScrollScene → Task 8
- §4.3 Chrome nav → Task 14
- §4.4 Motion primitives (Counter new, others extracted) → Tasks 3, 4, 9
- §4.5 Preload + no-flash → Task 15
- §4.6 Accessibility (reduced-motion fallbacks throughout) → covered in Tasks 6, 10, 11; verified in Task 16 Step 4
- §5 No new deps beyond lenis → Task 6 is the only dep addition
- §6 File structure → Tasks 1-5 extractions + Tasks 6-14 creations
- §7 Behavior preservation → Task 5 Step 4 preserves router/overlay; Task 16 Step 6 regression-tests the launch flow
- §8 Manual test plan → Task 16
