"use client"

import { useId } from "react"

import { cn } from "@/lib/utils"

type GreenChainLogoProps = {
  className?: string
  title?: string
}

export function GreenChainLogo({
  className,
  title = "GreenChain — Supply chain comparator",
}: GreenChainLogoProps) {
  const rawId = useId()
  const uid = rawId.replace(/:/g, "")
  const chainGradId = `${uid}-chainGrad`
  const leafGradId = `${uid}-leafGrad`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 340 72"
      className={cn("block h-8 w-auto shrink-0 sm:h-9 md:h-10", className)}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <linearGradient
          id={chainGradId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" style={{ stopColor: "#16a34a", stopOpacity: 1 }} />
          <stop
            offset="100%"
            style={{ stopColor: "#0891b2", stopOpacity: 1 }}
          />
        </linearGradient>
        <linearGradient
          id={leafGradId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" style={{ stopColor: "#4ade80", stopOpacity: 1 }} />
          <stop
            offset="100%"
            style={{ stopColor: "#16a34a", stopOpacity: 1 }}
          />
        </linearGradient>
      </defs>

      <g transform="translate(0, 10)">
        <rect
          x="8"
          y="10"
          width="22"
          height="32"
          rx="11"
          ry="11"
          fill="none"
          stroke={`url(#${chainGradId})`}
          strokeWidth="4.5"
        />
        <rect x="14" y="16" width="10" height="20" rx="5" ry="5" fill="white" />

        <rect
          x="26"
          y="10"
          width="22"
          height="32"
          rx="11"
          ry="11"
          fill="none"
          stroke={`url(#${chainGradId})`}
          strokeWidth="4.5"
        />
        <rect x="32" y="16" width="10" height="20" rx="5" ry="5" fill="white" />

        <ellipse
          cx="39"
          cy="4"
          rx="9"
          ry="6"
          fill={`url(#${leafGradId})`}
          transform="rotate(-30 39 4)"
        />
        <line
          x1="39"
          y1="8"
          x2="39"
          y2="14"
          stroke="#16a34a"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>

      <g transform="translate(62, 0)">
        <text
          x="0"
          y="38"
          fontFamily="'Futura', 'Century Gothic', 'Trebuchet MS', 'Franklin Gothic Medium', Arial, sans-serif"
          fontSize="33"
          fontWeight="900"
          letterSpacing="-1"
        >
          <tspan fill="#16a34a">Green</tspan>
          <tspan fill="#0e7490">Chain</tspan>
        </text>

        <line
          x1="0"
          y1="44"
          x2="252"
          y2="44"
          stroke="#e5e7eb"
          strokeWidth="1"
        />

        <text
          x="1"
          y="57"
          fontFamily="'Futura', 'Century Gothic', 'Trebuchet MS', Arial, sans-serif"
          fontSize="9"
          fontWeight="700"
          fill="#9ca3af"
          letterSpacing="3.2"
        >
          SUPPLY CHAIN COMPARATOR
        </text>
      </g>
    </svg>
  )
}
