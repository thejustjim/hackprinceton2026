# GreenChain Landing — Cinematic Redesign

**Date:** 2026-04-24
**Target surface:** `frontend/app/page.tsx` and companion components under `frontend/components/landing/`
**Goal:** Take the landing page from "good hackathon demo" to "launch-ready startup", with Lightship-inspired motion craft, a branded startup sequence, and a cinematic scroll-driven product preview — while preserving the existing hero → features → footer structure and the existing `/launch` handoff.

---

## 1. Design direction

Lightship-inspired cinematic upgrade on the existing structure. Four sections, each doing a single job. The premium feel comes from motion choreography (intro sequence, inertial scroll, pinned scroll-scrubbed preview, reveal-on-scroll chrome), not from added section count.

**Voice:** Confident, data-grounded, not flashy. The product is a sustainability-scoring tool for procurement professionals; tone must remain credible.

**Key constraint:** The hackathon demo flow (hero → Launch Platform → `/launch` → `/dashboard`) must keep working unchanged. The existing `DashboardLaunchOverlay` and router logic on `page.tsx:1017-1070` are preserved.

---

## 2. Narrative arc (4 sections)

1. **Intro + Hero** — scan-sweep globe intro plays once per session, then transitions into the existing hero composition (background media, headline, CTAs, hero signals strip).
2. **Pinned product preview** — 4-act scroll-scrubbed cinematic that hints at the whole product: query input, Dedalus agent swarm, force-directed manufacturer graph + globe, composite-score reveal, generated memo.
3. **Features** — the three existing capability cards (Prototype Flow, Supply Chain Graph, Geographic View), upgraded with richer parallax, refined tilt, gradient borders, and a scroll-progress rail.
4. **CTA + Footer** — a full-bleed "ready to try it?" panel, followed by a compact footer with a data-sources credibility strip.

Total sections: 4. No marquee, no separate "problem" section, no separate "tech" section — the product preview carries the story.

---

## 3. Section-by-section spec

### 3.1 Intro sequence (~2.5s, first visit per session)

**Placement:** Full-viewport overlay mounted above the hero, fades out on completion, does not remount on same-session navigation.

**Timing (total 2.5s, skippable at any point):**

| Time (s) | Action |
|---|---|
| 0.0–0.6 | Dark-teal splash (`--background`) with `GreenChainLogo` wordmark fade-up at center |
| 0.6–1.8 | Stylized Earth (canvas, ellipse + latitude lines, not Three.js) fades in behind wordmark. A horizontal scan line sweeps left→right across the globe. |
| 0.8–2.0 | As scan line passes each longitude band, 10–12 manufacturer pins drop in (green/amber/red dots matching `env_rating` palette) with a small bloom ring |
| 1.2–2.2 | 3–4 great-circle arcs draw between selected pins with a faint green trail |
| 2.0–2.5 | Camera pulls back, Earth softens to the hero's background layer position, wordmark shrinks and translates to the top-left nav slot. Hero content fades up. |

**Implementation:**
- Single `<canvas>` drawing all layers, one RAF loop.
- Progress driven by a single time value `elapsed / DURATION`; each layer has `start`/`end` windows and eases via `cubic-bezier(0.16, 1, 0.3, 1)`.
- Pin positions are deterministic (seeded, not random) to match the demo narrative.
- Session flag: `sessionStorage.setItem('gc:intro-seen', '1')`. On a repeat visit within session, the intro is skipped and hero mounts immediately.
- Skippable via a "Skip intro" button that fades in at T=0.8s (bottom-right, subtle) and via any click/keydown/touch.
- On `prefers-reduced-motion`: intro is bypassed entirely, hero mounts immediately with no animation.

**Component:** `components/landing/intro-sequence.tsx`

### 3.2 Hero

**Content unchanged:** Same headline lines (`Compare sourcing options / before you place the order.`), same subline, same primary/secondary CTAs, same three HERO_SIGNALS callouts.

**Upgrades:**
- Entry sequence triggers after intro completes (not on mount). Controlled by an `introReady` prop the page passes down.
- Background media stack (`IMG.heroBg` + `IMG.heroVid`) is preserved. Video preload changes from `preload="auto"` to `preload="metadata"` and only calls `.play()` after intro completes, to avoid competing with intro rendering.
- `HeroThreeField` canvas field stays but is disabled until intro completes (saves compute during intro).
- Hero signals strip gains a staggered letter-by-letter number reveal for the labels.

**Component:** `components/landing/hero-section.tsx` (extracted from current `page.tsx`, behavior preserved)

### 3.3 Pinned product preview (the centerpiece)

**Container:** 300vh tall. Inside: a `position: sticky; top: 0; height: 100vh` stage. Scroll progress 0→1 is computed from the outer container's bounding rect relative to the viewport.

**Acts (cross-fade between adjacent acts over a 10% scroll window):**

| Act | Progress range | Visual |
|---|---|---|
| 1 · "A request arrives" | 0.00–0.25 | Search query pills materialize (`cotton t-shirts`, `CN · PT · BD`, `sea freight`). A central node representing the Dedalus orchestrator pulses. |
| 2 · "Agents discover" | 0.25–0.50 | Child agent nodes (Discovery, Certification, Memo) fan out. Manufacturer leaf nodes pop in across a force-directed graph layout; light lines draw between them. |
| 3 · "The score" | 0.50–0.75 | Each manufacturer node gains color by `env_rating` (green/amber/red). A composite-score counter for the top manufacturer ticks up from 0 to its value. A weighted-dimension ring (5 segments: manufacturing, transport, grid, cert, risk) forms around the node. |
| 4 · "The memo" | 0.75–1.00 | A paper-sheet card slides up and overlays the graph, showing a headline ("Rank 1: Alentejo Têxtil · Portugal · composite 82 / 100") and three bullet findings. |

**Implementation notes:**
- All acts rendered on a single full-bleed canvas, not DOM nodes. Keeps compositing consistent and lets the scroll scrub the animation rather than just fade between React trees.
- Node positions are deterministic and precomputed on mount.
- Semantic fallback (visually hidden but in DOM order): a heading + four paragraphs describing what each act shows. Used by screen readers and by `prefers-reduced-motion` fallback (see below).
- On `prefers-reduced-motion`: the sticky stage is removed; the 4 acts render as 4 stacked static cards vertically with 20vh spacing.
- On mobile (<768px viewport): same fallback — 4 stacked static cards — motion scrubbing is not attempted.

**Component:** `components/landing/product-preview-section.tsx` using the shared `ScrollScene` primitive.

### 3.4 Features

**Content unchanged:** Same `FEATURES` array (Prototype Flow, Supply Chain Graph, Geographic View), same images, same bullets.

**Upgrades:**
- Card enter-reveal: the title's lines animate in via `LineReveal` pattern (currently only used in hero), staggered 80ms per card.
- `ParallaxMedia` parallax speed doubled from `0.08` to `0.16` with the existing scale-1.12 frame preserved.
- `TiltCard` perspective unchanged but adds a sliding highlight: a subtle diagonal light band that follows the cursor position.
- Panel border: replace flat `border-white/10` with a gradient stroke using CSS `border-image: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.02)) 1`.
- Left-margin scroll-progress rail: a 2px vertical line on the left side of the section (`hidden lg:block`) that fills green as the section enters view and clears as it exits.

**Component:** `components/landing/features-section.tsx` (extracted and upgraded from current `page.tsx`)

### 3.5 CTA + Footer

**CTA panel:**
- Full-bleed, min-height 80vh, dark background with a low-intensity ambient canvas (reuses `HeroThreeField` dust layer only, orbiters disabled).
- Centered: eyebrow `READY TO TRY IT?`, large display headline `See your first comparison in under a minute.`, primary CTA `Open Platform` wired to the existing `handleLaunchDashboard`.
- Secondary text: `Demo loads a pre-seeded 20-node graph over 16 routes.`

**Footer:**
- Compact, border-top hairline.
- Left: GreenChain wordmark + single-line tagline.
- Middle: **Data sources credibility strip** — small-caps `BUILT ON` followed by `EPA USEEIO · Ember · GLEC · ND-GAIN · CDP`. This is the only "proof" element on the page; it lives in the footer rather than its own section.
- Right: navigation (Launch, Platform, Capabilities, About) — preserved from current footer.

**Component:** `components/landing/cta-footer.tsx`

---

## 4. Cross-cutting systems

### 4.1 Smooth inertial scroll (Lenis)

- Add `lenis` (~6kb) as a dependency. Init once at the page level via `hooks/use-lenis.ts`.
- Lenis takes over `window.scrollY`; existing IntersectionObserver and scroll listeners continue to work unchanged (Lenis dispatches native scroll events).
- Disabled when `prefers-reduced-motion: reduce` — page falls back to native scroll.

### 4.2 ScrollScene primitive

Shared component used by the pinned product preview and potentially the CTA ambient canvas:

```tsx
<ScrollScene totalVh={300}>
  {(progress) => <CanvasStage progress={progress} />}
</ScrollScene>
```

- Renders an outer `div` with `height: {totalVh}vh` and an inner `position: sticky; top: 0; height: 100vh`.
- Computes progress 0→1 based on outer rect vs viewport.
- Single RAF loop across the page (via a lightweight store) so multiple scroll scenes don't spawn redundant frames.

### 4.3 Reveal-on-scroll chrome nav

- `ChromeNav`: fixed top, `backdrop-blur-xl`, hidden on initial render (matches the hero's in-hero nav which acts as the initial chrome).
- Appears only after the user has scrolled past 60vh AND is scrolling up.
- Hides on scroll down, reveals on scroll up (Lightship pattern).
- Contains the logo, the same three links as the current hero nav, and the `Launch Platform` button.
- In-hero nav on the hero section is hidden once `ChromeNav` takes over past 60vh to avoid visual duplication.

**Component:** `components/landing/chrome-nav.tsx`

### 4.4 Motion primitives

- **`LineReveal`** — already exists in `page.tsx`. Extract to `components/landing/line-reveal.tsx`. Used in hero and now features.
- **`Reveal`** — already exists. Extract to `components/landing/reveal.tsx`.
- **`TiltCard`** — already exists. Extract to `components/landing/tilt-card.tsx` and add cursor-following highlight.
- **`ParallaxMedia`** — already exists. Extract to `components/landing/parallax-media.tsx`.
- **`Counter`** — new. Scroll-driven number ticker with `prefers-reduced-motion` fallback (shows final value instantly). Used in product preview Act 3 and optionally in hero signals.

### 4.5 Preload & no-flash

- Add `<link rel="preload">` for `IMG.heroBg` and the intro canvas Earth asset (if external) in `app/layout.tsx`.
- CSS-only splash (inline style on `body`) with `--background` color prevents white flash before React hydrates.
- Intro overlay mounts with its own opaque background layer, so the hero video loading flicker is hidden behind it during first paint.

### 4.6 Accessibility

- Intro: skippable button appears at T=0.8s; any keydown/click/touch dismisses.
- Product preview: semantic fallback DOM, keyboard focus can reach the CTA inside the memo act.
- Chrome nav: traps Tab order correctly when open; focus-visible rings on all buttons.
- Color contrast: WCAG AA across all text on moving backgrounds (overlays use `rgba(2,7,10,0.72)+` on photo areas, preserved from current).
- `prefers-reduced-motion`: disables intro, disables Lenis, disables pinned scroll-scrubbing (fallback to stacked static cards), disables parallax (media sits still).

---

## 5. Tech & dependencies

- **Add:** `lenis` ^1.1 (smooth scroll, ~6kb).
- **Do not add:** `framer-motion`, `gsap`, `@react-three/fiber` (Three.js stays only where the existing `HeroThreeField` uses it via raw canvas API; no R3F).
- **Stay vanilla:** IntersectionObserver, RAF, View Timeline API where supported (progressive enhancement only).
- Next 16 / React 19 / Tailwind 4 / TypeScript — all unchanged.

---

## 6. File structure

```
frontend/
  app/
    page.tsx                                    # thin orchestrator
  components/
    landing/
      chrome-nav.tsx                            # new — reveal-on-scroll nav
      counter.tsx                               # new — scroll-driven ticker
      cta-footer.tsx                            # new — CTA panel + footer
      features-section.tsx                      # extracted + upgraded
      hero-section.tsx                          # extracted + intro-gated
      intro-sequence.tsx                        # new — scan-sweep globe
      line-reveal.tsx                           # extracted from page.tsx
      parallax-media.tsx                        # extracted from page.tsx
      product-preview-section.tsx               # new — 4-act scroll scene
      reveal.tsx                                # extracted from page.tsx
      scroll-scene.tsx                          # new — pinned-section primitive
      tilt-card.tsx                             # extracted, with cursor highlight
      three-field.tsx                           # extracted from page.tsx
  hooks/
    use-lenis.ts                                # new — Lenis init
    use-scroll-progress.ts                      # new — element progress 0→1
    use-in-view.ts                              # extracted from page.tsx
    use-prefers-reduced-motion.ts               # extracted from page.tsx
```

The existing `components/launch/dashboard-launch-overlay.tsx` and `components/green-chain-logo.tsx` are unchanged.

---

## 7. Behavior preservation (non-negotiable)

- `Launch Platform` button still triggers `DashboardLaunchOverlay` and routes to `/launch` — wiring in `page.tsx:1038-1046` preserved.
- `router.prefetch("/launch")` on mount preserved.
- `document.body.style.overflow = "hidden"` during launch preserved.
- `prefersReducedMotion` handling preserved and extended to new motion.
- `template.tsx` handling unchanged.

---

## 8. Manual test plan

- Desktop Chrome, Safari, Firefox: intro plays, pinned section scrubs smoothly, chrome nav reveals on scroll-up, Launch Platform → overlay → `/launch` works.
- Mobile Safari (iOS) and Chrome (Android): intro plays, pinned section falls back to stacked cards, Lenis disabled below 768px as a safety.
- `prefers-reduced-motion: reduce` (macOS System Settings): intro skipped, no pinned scrubbing, no parallax, no Lenis.
- First-visit vs repeat-visit within same tab: intro plays only once.
- `npm run typecheck` passes.
- `npm run lint` passes.
- Lighthouse: Performance score does not regress more than 5 points vs current landing.

---

## 9. Out of scope

- No changes to `/launch` (scenario import) or `/dashboard` pages.
- No changes to the backend, ML scorer, or Dedalus agent orchestration.
- No new content copy beyond the CTA panel and data-sources footer strip; existing hero copy, features copy, and footer link labels are preserved.
- No marketing logos of customers or case studies — the data-sources strip is the only "social proof" element.
- No dark/light theme toggle — landing stays dark.

---

## 10. Success criteria

1. A first-time visitor sees a 2.5s branded intro that previews what the product does.
2. Scrolling through the pinned product preview scrubs a cinematic 4-act animation without jank on a 2020+ laptop.
3. The page feels distinctly more polished than the current version while preserving all existing navigation and launch paths.
4. Reduced-motion users get a clean, fast, still-beautiful experience with no scrubbed motion.
5. Typecheck and lint pass; Lighthouse performance does not regress more than 5 points.
