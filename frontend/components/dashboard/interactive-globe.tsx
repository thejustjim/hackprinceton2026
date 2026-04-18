"use client"

import { useEffect, useId, useRef, useState } from "react"

import {
  LOCATION_GEO_OVERRIDES,
  type GlobeGeoPoint,
} from "@/lib/globe-geometry"
import {
  DEFAULT_GLOBE_GEOMETRY,
  loadGlobeGeometry,
} from "@/lib/natural-earth-globe"
import { cn } from "@/lib/utils"
import {
  type SupplyChainEntity,
  type SupplyChainLink,
  type SupplyChainLocation,
} from "@/lib/mock-supply-chain"

interface InteractiveGlobeProps {
  className?: string
  entities: SupplyChainEntity[]
  links: SupplyChainLink[]
  locations: SupplyChainLocation[]
  selectedLocationId?: string
}

interface Vector3 {
  x: number
  y: number
  z: number
}

interface RotationState {
  pitch: number
  yaw: number
}

interface DragState {
  pointerId: number
  timestamp: number
  x: number
  y: number
}

interface ProjectedPoint {
  depth: number
  radial: number
  visible: boolean
  x: number
  y: number
}

const GLOBE_CENTER = 50
const GLOBE_RADIUS = 38
const AUTO_ROTATION_SPEED = 0.000035
const DRAG_SENSITIVITY = 0.0065
const MAX_PITCH = Math.PI / 3
const ROUTE_SEGMENTS = 56
const CONTINENT_SUBDIVISIONS = 22
const COUNTRY_SUBDIVISIONS = 18
const PITCH_VELOCITY_DECAY = 0.94
const YAW_VELOCITY_DECAY = 0.9
const FRONT_PATH_THRESHOLD = 0
const BACK_PATH_THRESHOLD = -0.18
const ROUTE_FRONT_SURFACE_PADDING = 0.002
const GRID_LATITUDES_PRIMARY = [-60, -36, -12, 12, 36, 60]
const GRID_LATITUDES_SECONDARY = [-72, -48, -24, 0, 24, 48, 72]
const GRID_LONGITUDES_PRIMARY = [
  -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150,
]
const GRID_LONGITUDES_SECONDARY = [
  -165, -135, -105, -75, -45, -15, 15, 45, 75, 105, 135, 165,
]
const DEFAULT_ROTATION: RotationState = {
  pitch: degreesToRadians(-18),
  yaw: degreesToRadians(-26),
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toVector({ lat, lon }: GlobeGeoPoint): Vector3 {
  const latRadians = degreesToRadians(lat)
  const lonRadians = degreesToRadians(lon)

  return {
    x: Math.cos(latRadians) * Math.sin(lonRadians),
    y: Math.sin(latRadians),
    z: Math.cos(latRadians) * Math.cos(lonRadians),
  }
}

function rotateVector(
  vector: Vector3,
  { pitch, yaw }: RotationState
): ProjectedPoint {
  const sinYaw = Math.sin(yaw)
  const cosYaw = Math.cos(yaw)
  const yawedX = vector.x * cosYaw + vector.z * sinYaw
  const yawedZ = vector.z * cosYaw - vector.x * sinYaw

  const sinPitch = Math.sin(pitch)
  const cosPitch = Math.cos(pitch)
  const pitchedY = vector.y * cosPitch - yawedZ * sinPitch
  const pitchedZ = yawedZ * cosPitch + vector.y * sinPitch

  return {
    depth: pitchedZ,
    radial: Math.hypot(yawedX, pitchedY),
    visible: pitchedZ > 0,
    x: GLOBE_CENTER + yawedX * GLOBE_RADIUS,
    y: GLOBE_CENTER - pitchedY * GLOBE_RADIUS,
  }
}

function projectGeoPoint(point: GlobeGeoPoint, rotation: RotationState) {
  return rotateVector(toVector(point), rotation)
}

function normalizeVector(vector: Vector3) {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z) || 1

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  }
}

function wrapLongitude(value: number) {
  const wrapped = ((((value + 180) % 360) + 360) % 360) - 180
  return wrapped === -180 ? 180 : wrapped
}

function shortestLongitudeDelta(from: number, to: number) {
  let delta = to - from

  while (delta > 180) {
    delta -= 360
  }

  while (delta < -180) {
    delta += 360
  }

  return delta
}

function pointsMatch(left: GlobeGeoPoint, right: GlobeGeoPoint) {
  return (
    Math.abs(left.lat - right.lat) < 0.001 &&
    Math.abs(left.lon - right.lon) < 0.001
  )
}

function catmullRom(
  previous: number,
  start: number,
  end: number,
  next: number,
  progress: number
) {
  const squared = progress * progress
  const cubed = squared * progress

  return (
    0.5 *
    (2 * start +
      (-previous + end) * progress +
      (2 * previous - 5 * start + 4 * end - next) * squared +
      (-previous + 3 * start - 3 * end + next) * cubed)
  )
}

function interpolateGeoPath(
  points: GlobeGeoPoint[],
  subdivisions: number
): GlobeGeoPoint[] {
  if (points.length < 2) {
    return points
  }

  const closed =
    points.length > 2 && pointsMatch(points[0], points[points.length - 1])
  const source = closed ? points.slice(0, -1) : points

  if (source.length < 2) {
    return points
  }

  const longitudes = [source[0].lon]

  for (let index = 1; index < source.length; index += 1) {
    longitudes[index] =
      longitudes[index - 1] +
      shortestLongitudeDelta(source[index - 1].lon, source[index].lon)
  }

  const getIndex = (index: number) => {
    if (closed) {
      return (index + source.length) % source.length
    }

    return clamp(index, 0, source.length - 1)
  }

  const sampled: GlobeGeoPoint[] = []
  const segmentCount = closed ? source.length : source.length - 1

  for (let index = 0; index < segmentCount; index += 1) {
    const previousIndex = getIndex(index - 1)
    const startIndex = getIndex(index)
    const endIndex = getIndex(index + 1)
    const nextIndex = getIndex(index + 2)

    for (let step = 0; step < subdivisions; step += 1) {
      const progress = step / subdivisions

      sampled.push({
        lat: clamp(
          catmullRom(
            source[previousIndex].lat,
            source[startIndex].lat,
            source[endIndex].lat,
            source[nextIndex].lat,
            progress
          ),
          -89.5,
          89.5
        ),
        lon: wrapLongitude(
          catmullRom(
            longitudes[previousIndex],
            longitudes[startIndex],
            longitudes[endIndex],
            longitudes[nextIndex],
            progress
          )
        ),
      })
    }
  }

  const finalIndex = source.length - 1
  sampled.push(
    closed
      ? source[0]
      : {
          lat: source[finalIndex].lat,
          lon: wrapLongitude(longitudes[finalIndex]),
        }
  )

  return sampled
}

function buildHemispherePath(
  points: GlobeGeoPoint[],
  rotation: RotationState,
  hemisphere: "front" | "back"
) {
  const segments: string[] = []
  let currentSegment: string[] = []

  points.forEach((point) => {
    const projected = projectGeoPoint(point, rotation)
    const visible =
      hemisphere === "front"
        ? projected.depth >= FRONT_PATH_THRESHOLD
        : projected.depth <= BACK_PATH_THRESHOLD

    if (!visible) {
      if (currentSegment.length > 1) {
        segments.push(currentSegment.join(" "))
      }
      currentSegment = []
      return
    }

    const command = currentSegment.length === 0 ? "M" : "L"
    currentSegment.push(
      `${command} ${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`
    )
  })

  if (currentSegment.length > 1) {
    segments.push(currentSegment.join(" "))
  }

  return segments
}

function createLatitudeLine(latitude: number, steps = 161) {
  return Array.from({ length: steps }, (_, index) => ({
    lat: latitude,
    lon: -180 + (index * 360) / (steps - 1),
  }))
}

function createLongitudeLine(longitude: number, steps = 121) {
  return Array.from({ length: steps }, (_, index) => ({
    lat: -90 + (index * 180) / (steps - 1),
    lon: longitude,
  }))
}

const SMOOTHED_FALLBACK_LAND_OUTLINES = DEFAULT_GLOBE_GEOMETRY.landOutlines.map(
  (outline) => interpolateGeoPath(outline, CONTINENT_SUBDIVISIONS)
)
const SMOOTHED_FALLBACK_COUNTRY_BOUNDARIES =
  DEFAULT_GLOBE_GEOMETRY.countryBoundaries.map((outline) =>
    interpolateGeoPath(outline, COUNTRY_SUBDIVISIONS)
  )
const PRIMARY_LATITUDE_LINES = GRID_LATITUDES_PRIMARY.map((latitude) =>
  createLatitudeLine(latitude)
)
const SECONDARY_LATITUDE_LINES = GRID_LATITUDES_SECONDARY.map((latitude) =>
  createLatitudeLine(latitude)
)
const PRIMARY_LONGITUDE_LINES = GRID_LONGITUDES_PRIMARY.map((longitude) =>
  createLongitudeLine(longitude)
)
const SECONDARY_LONGITUDE_LINES = GRID_LONGITUDES_SECONDARY.map((longitude) =>
  createLongitudeLine(longitude)
)

function interpolateRoute(start: GlobeGeoPoint, end: GlobeGeoPoint) {
  const startVector = toVector(start)
  const endVector = toVector(end)
  const clampedDot = clamp(
    startVector.x * endVector.x +
      startVector.y * endVector.y +
      startVector.z * endVector.z,
    -1,
    1
  )
  const angle = Math.acos(clampedDot)
  const route: Vector3[] = []

  for (let step = 0; step <= ROUTE_SEGMENTS; step += 1) {
    const progress = step / ROUTE_SEGMENTS
    let blended: Vector3

    if (angle < 0.001) {
      blended = normalizeVector({
        x: startVector.x + (endVector.x - startVector.x) * progress,
        y: startVector.y + (endVector.y - startVector.y) * progress,
        z: startVector.z + (endVector.z - startVector.z) * progress,
      })
    } else {
      const sinAngle = Math.sin(angle)
      const startWeight = Math.sin((1 - progress) * angle) / sinAngle
      const endWeight = Math.sin(progress * angle) / sinAngle

      blended = normalizeVector({
        x: startVector.x * startWeight + endVector.x * endWeight,
        y: startVector.y * startWeight + endVector.y * endWeight,
        z: startVector.z * startWeight + endVector.z * endWeight,
      })
    }

    const peakLift = 0.16 + Math.sin(angle / 2) * 0.26
    const arcHeight = Math.sin(progress * Math.PI) ** 0.86
    const lift = 1 + arcHeight * peakLift
    route.push({
      x: blended.x * lift,
      y: blended.y * lift,
      z: blended.z * lift,
    })
  }

  return route
}

function isRoutePointVisible(projected: ProjectedPoint) {
  if (projected.radial >= 1) {
    return true
  }

  const frontSurfaceDepth = Math.sqrt(
    Math.max(0, 1 - projected.radial * projected.radial)
  )

  return projected.depth > frontSurfaceDepth + ROUTE_FRONT_SURFACE_PADDING
}

function buildRoutePath(points: Vector3[], rotation: RotationState) {
  const segments: string[] = []
  let currentSegment: string[] = []

  points.forEach((point) => {
    const projected = rotateVector(point, rotation)

    if (!isRoutePointVisible(projected)) {
      if (currentSegment.length > 1) {
        segments.push(currentSegment.join(" "))
      }
      currentSegment = []
      return
    }

    const command = currentSegment.length === 0 ? "M" : "L"
    currentSegment.push(
      `${command} ${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`
    )
  })

  if (currentSegment.length > 1) {
    segments.push(currentSegment.join(" "))
  }

  return segments
}

function fallbackGeoPoint(location: SupplyChainLocation): GlobeGeoPoint {
  return {
    lat: 90 - location.coordinates.y * 1.8,
    lon: location.coordinates.x * 3.6 - 180,
  }
}

function getLocationGeo(location: SupplyChainLocation) {
  return LOCATION_GEO_OVERRIDES[location.id] ?? fallbackGeoPoint(location)
}

export function InteractiveGlobe({
  className,
  entities,
  links,
  locations,
  selectedLocationId,
}: InteractiveGlobeProps) {
  const [rotation, setRotation] = useState(DEFAULT_ROTATION)
  const [geometry, setGeometry] = useState(DEFAULT_GLOBE_GEOMETRY)
  const clipPathId = `globe-clip-${useId().replaceAll(":", "")}`
  const dragStateRef = useRef<DragState | null>(null)
  const rotationRef = useRef(DEFAULT_ROTATION)
  const velocityRef = useRef({ pitch: 0, yaw: 0 })

  useEffect(() => {
    let frameId = 0
    let previousTimestamp = performance.now()

    const tick = (timestamp: number) => {
      const delta = Math.min(40, timestamp - previousTimestamp)
      previousTimestamp = timestamp

      if (!dragStateRef.current) {
        rotationRef.current = {
          pitch: clamp(
            rotationRef.current.pitch + velocityRef.current.pitch * delta,
            -MAX_PITCH,
            MAX_PITCH
          ),
          yaw:
            rotationRef.current.yaw +
            AUTO_ROTATION_SPEED * delta +
            velocityRef.current.yaw * delta,
        }

        velocityRef.current = {
          pitch: velocityRef.current.pitch * PITCH_VELOCITY_DECAY,
          yaw: velocityRef.current.yaw * YAW_VELOCITY_DECAY,
        }
      }

      setRotation({ ...rotationRef.current })
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  useEffect(() => {
    let active = true

    loadGlobeGeometry().then((nextGeometry) => {
      if (active) {
        setGeometry(nextGeometry)
      }
    })

    return () => {
      active = false
    }
  }, [])

  const resolvedLocations = locations.map((location) => ({
    ...location,
    geo: getLocationGeo(location),
  }))

  const locationById = Object.fromEntries(
    resolvedLocations.map((location) => [location.id, location])
  )
  const entityById = Object.fromEntries(
    entities.map((entity) => [entity.id, entity])
  )
  const visibleLocations = resolvedLocations
    .map((location) => ({
      ...location,
      projected: projectGeoPoint(location.geo, rotation),
    }))
    .filter((location) => location.projected.visible)
    .sort((left, right) => left.projected.depth - right.projected.depth)

  const landOutlines =
    geometry.source === "fallback"
      ? SMOOTHED_FALLBACK_LAND_OUTLINES
      : geometry.landOutlines
  const countryOutlines =
    geometry.source === "fallback"
      ? SMOOTHED_FALLBACK_COUNTRY_BOUNDARIES
      : geometry.countryBoundaries

  const continentPaths = landOutlines.flatMap((outline) =>
    buildHemispherePath(outline, rotation, "front")
  )
  const continentBackPaths = landOutlines.flatMap((outline) =>
    buildHemispherePath(outline, rotation, "back")
  )
  const countryPaths = countryOutlines.flatMap((outline) =>
    buildHemispherePath(outline, rotation, "front")
  )
  const countryBackPaths = countryOutlines.flatMap((outline) =>
    buildHemispherePath(outline, rotation, "back")
  )

  const primaryLatitudePaths = PRIMARY_LATITUDE_LINES.flatMap((line) =>
    buildHemispherePath(line, rotation, "front")
  )
  const secondaryLatitudePaths = SECONDARY_LATITUDE_LINES.flatMap((line) =>
    buildHemispherePath(line, rotation, "front")
  )
  const backLatitudePaths = [
    ...PRIMARY_LATITUDE_LINES,
    ...SECONDARY_LATITUDE_LINES,
  ].flatMap((line) => buildHemispherePath(line, rotation, "back"))

  const primaryLongitudePaths = PRIMARY_LONGITUDE_LINES.flatMap((line) =>
    buildHemispherePath(line, rotation, "front")
  )
  const secondaryLongitudePaths = SECONDARY_LONGITUDE_LINES.flatMap((line) =>
    buildHemispherePath(line, rotation, "front")
  )
  const backLongitudePaths = [
    ...PRIMARY_LONGITUDE_LINES,
    ...SECONDARY_LONGITUDE_LINES,
  ].flatMap((line) => buildHemispherePath(line, rotation, "back"))

  const routePaths = links.flatMap((link) => {
    const sourceEntity = entityById[link.sourceId]
    const targetEntity = entityById[link.targetId]
    const sourceLocation = sourceEntity
      ? locationById[sourceEntity.locationId]
      : undefined
    const targetLocation = targetEntity
      ? locationById[targetEntity.locationId]
      : undefined

    if (!sourceLocation || !targetLocation) {
      return []
    }

    return buildRoutePath(
      interpolateRoute(sourceLocation.geo, targetLocation.geo),
      rotation
    ).map((path) => ({
      highlighted:
        sourceLocation.id === selectedLocationId ||
        targetLocation.id === selectedLocationId,
      id: link.id,
      path,
    }))
  })

  function updateRotation(nextRotation: RotationState) {
    rotationRef.current = {
      pitch: clamp(nextRotation.pitch, -MAX_PITCH, MAX_PITCH),
      yaw: nextRotation.yaw,
    }
    setRotation({ ...rotationRef.current })
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragStateRef.current = {
      pointerId: event.pointerId,
      timestamp: event.timeStamp,
      x: event.clientX,
      y: event.clientY,
    }
    velocityRef.current = { pitch: 0, yaw: 0 }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - dragState.x
    const deltaY = event.clientY - dragState.y
    const deltaTime = Math.max(1, event.timeStamp - dragState.timestamp)
    const deltaYaw = deltaX * DRAG_SENSITIVITY * 0.6
    const deltaPitch = deltaY * DRAG_SENSITIVITY * 0.55

    updateRotation({
      pitch: rotationRef.current.pitch + deltaPitch,
      yaw: rotationRef.current.yaw + deltaYaw,
    })

    velocityRef.current = {
      pitch: deltaPitch / deltaTime,
      yaw: deltaYaw / deltaTime,
    }
    dragStateRef.current = {
      pointerId: event.pointerId,
      timestamp: event.timeStamp,
      x: event.clientX,
      y: event.clientY,
    }
  }

  function releasePointer(
    event: React.PointerEvent<HTMLDivElement | SVGSVGElement>
  ) {
    if (dragStateRef.current?.pointerId !== event.pointerId) {
      return
    }

    dragStateRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown"
    ) {
      return
    }

    event.preventDefault()

    const yawDelta =
      event.key === "ArrowLeft" ? -0.14 : event.key === "ArrowRight" ? 0.14 : 0
    const pitchDelta =
      event.key === "ArrowUp" ? -0.1 : event.key === "ArrowDown" ? 0.1 : 0

    updateRotation({
      pitch: rotationRef.current.pitch + pitchDelta,
      yaw: rotationRef.current.yaw + yawDelta,
    })
  }

  return (
    <div
      className={cn(
        "group relative aspect-square w-full max-w-[26rem] touch-none select-none md:max-w-[29rem]",
        className
      )}
      onKeyDown={handleKeyDown}
      onPointerCancel={releasePointer}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releasePointer}
      role="img"
      aria-label="Interactive globe. Drag to rotate."
      tabIndex={0}
    >
      <div className="absolute inset-[8%] rounded-full border border-white/12 shadow-[0_0_64px_rgba(255,255,255,0.08)]" />
      <div className="absolute inset-[18%] rounded-full border border-white/10" />

      <svg
        className="size-full overflow-visible"
        viewBox="0 0 100 100"
        onPointerCancel={releasePointer}
        onPointerUp={releasePointer}
      >
        <defs>
          <clipPath id={clipPathId}>
            <circle cx={GLOBE_CENTER} cy={GLOBE_CENTER} r={GLOBE_RADIUS} />
          </clipPath>
          <radialGradient id={`${clipPathId}-surface`} cx="34%" cy="24%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
            <stop offset="20%" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="58%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.015" />
          </radialGradient>
          <radialGradient id={`${clipPathId}-core-shadow`} cx="58%" cy="62%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.03" />
            <stop offset="64%" stopColor="#ffffff" stopOpacity="0.012" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.34" />
          </radialGradient>
          <linearGradient
            id={`${clipPathId}-sheen`}
            x1="16%"
            y1="12%"
            x2="82%"
            y2="84%"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="24%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id={`${clipPathId}-rim`}
            x1="20%"
            y1="18%"
            x2="82%"
            y2="82%"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.84" />
            <stop offset="42%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.56" />
          </linearGradient>
          <radialGradient id={`${clipPathId}-halo`} cx="50%" cy="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="42%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle
          cx={GLOBE_CENTER}
          cy={GLOBE_CENTER}
          r={49}
          fill={`url(#${clipPathId}-halo)`}
          opacity={0.82}
        />

        <circle
          cx={GLOBE_CENTER}
          cy={GLOBE_CENTER}
          r={GLOBE_RADIUS}
          fill="rgba(255,255,255,0.015)"
          stroke={`url(#${clipPathId}-rim)`}
          strokeWidth="0.72"
        />
        <circle
          cx={GLOBE_CENTER}
          cy={GLOBE_CENTER}
          r={GLOBE_RADIUS - 0.8}
          fill={`url(#${clipPathId}-surface)`}
          opacity={0.96}
        />
        <circle
          cx={GLOBE_CENTER}
          cy={GLOBE_CENTER}
          r={GLOBE_RADIUS - 1.2}
          fill={`url(#${clipPathId}-core-shadow)`}
          opacity={0.95}
        />

        <g clipPath={`url(#${clipPathId})`}>
          <ellipse
            cx={GLOBE_CENTER - 4}
            cy={GLOBE_CENTER - 8}
            rx={GLOBE_RADIUS * 0.82}
            ry={GLOBE_RADIUS * 0.42}
            fill={`url(#${clipPathId}-sheen)`}
            opacity={0.88}
            transform={`rotate(-18 ${GLOBE_CENTER} ${GLOBE_CENTER})`}
          />
          <ellipse
            cx={GLOBE_CENTER}
            cy={GLOBE_CENTER + 10}
            rx={GLOBE_RADIUS * 0.96}
            ry={GLOBE_RADIUS * 0.55}
            fill="rgba(255,255,255,0.03)"
          />
          <ellipse
            cx={GLOBE_CENTER + 8}
            cy={GLOBE_CENTER + 14}
            rx={GLOBE_RADIUS * 0.88}
            ry={GLOBE_RADIUS * 0.52}
            fill="rgba(0,0,0,0.16)"
            transform={`rotate(12 ${GLOBE_CENTER} ${GLOBE_CENTER})`}
          />

          {backLatitudePaths.map((path, index) => (
            <path
              key={`lat-back-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="0.18"
            />
          ))}

          {backLongitudePaths.map((path, index) => (
            <path
              key={`lon-back-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.045)"
              strokeWidth="0.18"
            />
          ))}

          {countryBackPaths.map((path, index) => (
            <path
              key={`country-back-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.055)"
              strokeDasharray="1.2 1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="0.24"
            />
          ))}

          {continentBackPaths.map((path, index) => (
            <path
              key={`continent-back-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.075)"
              strokeDasharray="1.8 2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="0.42"
            />
          ))}

          {secondaryLatitudePaths.map((path, index) => (
            <path
              key={`lat-secondary-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="0.18"
            />
          ))}

          {secondaryLongitudePaths.map((path, index) => (
            <path
              key={`lon-secondary-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.18"
            />
          ))}

          {primaryLatitudePaths.map((path, index) => (
            <path
              key={`lat-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="0.24"
            />
          ))}

          {primaryLongitudePaths.map((path, index) => (
            <path
              key={`lon-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="0.22"
            />
          ))}

          {countryPaths.map((path, index) => (
            <path
              key={`country-glow-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="0.82"
              opacity={0.52}
            />
          ))}

          {continentPaths.map((path, index) => (
            <path
              key={`continent-glow-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.42"
              opacity={0.58}
            />
          ))}

          {countryPaths.map((path, index) => (
            <path
              key={`country-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.36)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="0.32"
            />
          ))}

          {continentPaths.map((path, index) => (
            <path
              key={`continent-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.92)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="0.72"
            />
          ))}

          {routePaths.map(({ highlighted, id, path }, index) => (
            <g key={`${id}-${index}`}>
              <path
                d={path}
                fill="none"
                stroke={
                  highlighted
                    ? "color-mix(in oklab, var(--primary) 74%, white)"
                    : "color-mix(in oklab, var(--accent) 78%, transparent)"
                }
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={highlighted ? 0.38 : 0.2}
                strokeWidth={highlighted ? 1.85 : 1.15}
              />
              <path
                d={path}
                fill="none"
                stroke={
                  highlighted
                    ? "color-mix(in oklab, var(--primary) 84%, white)"
                    : "color-mix(in oklab, var(--accent) 76%, white)"
                }
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={highlighted ? 0.96 : 0.74}
                strokeWidth={highlighted ? 0.98 : 0.58}
              />
              <path
                className="globe-route-pulse"
                d={path}
                fill="none"
                pathLength={100}
                stroke={
                  highlighted
                    ? "color-mix(in oklab, var(--primary) 92%, white)"
                    : "color-mix(in oklab, var(--accent) 86%, white)"
                }
                strokeDasharray={highlighted ? "14 86" : "10 90"}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={highlighted ? 0.92 : 0.72}
                strokeWidth={highlighted ? 1.36 : 0.92}
                style={{
                  animationDelay: `${index * -1.35}s`,
                  animationDuration: highlighted ? "7.4s" : "9.2s",
                }}
              />
            </g>
          ))}

          {visibleLocations.map((location) => {
            const isSelected = location.id === selectedLocationId

            return (
              <g key={location.id}>
                {isSelected ? (
                  <circle
                    cx={location.projected.x}
                    cy={location.projected.y}
                    r={4.1}
                    fill="rgba(255,255,255,0.08)"
                    stroke="rgba(255,255,255,0.38)"
                    strokeWidth="0.35"
                  />
                ) : null}
                <circle
                  cx={location.projected.x}
                  cy={location.projected.y}
                  r={isSelected ? 1.9 : 1.25}
                  fill="rgba(255,255,255,0.96)"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="0.3"
                />
              </g>
            )
          })}
        </g>

        <ellipse
          cx={GLOBE_CENTER}
          cy={GLOBE_CENTER}
          rx={GLOBE_RADIUS * 0.98}
          ry={GLOBE_RADIUS * 0.42}
          fill="none"
          opacity={0.85}
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="0.34"
        />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
        <div className="rounded-full border border-white/12 bg-black/18 px-3 py-1 text-[0.65rem] tracking-[0.2em] text-white/70 uppercase backdrop-blur-sm">
          Drag to rotate
        </div>
      </div>
    </div>
  )
}
