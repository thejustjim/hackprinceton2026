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
