"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"

import { type GlobeGeoPoint } from "@/lib/globe-geometry"
import {
  DEFAULT_GLOBE_GEOMETRY,
  loadGlobeGeometry,
} from "@/lib/natural-earth-globe"
import {
  type SupplyScenario,
  type SupplyScenarioLocation,
  type SupplyScenarioSelectableNodeId,
} from "@/lib/supply-chain-scenario"
import { cn } from "@/lib/utils"

interface InteractiveGlobeProps {
  className?: string
  hoveredNodeId: SupplyScenarioSelectableNodeId | null
  onHoverNode: (nodeId: SupplyScenarioSelectableNodeId | null) => void
  onSelectNode: (nodeId: SupplyScenarioSelectableNodeId | null) => void
  pinnedManufacturerByComponent: Record<string, string>
  scenario: SupplyScenario
  selectedNodeId: SupplyScenarioSelectableNodeId | null
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

interface RouteModel {
  componentId: string
  id: string
  isCurrent: boolean
  manufacturerId: string
  points: Vector3[]
}

interface RouteLabelModel {
  anchorX: number
  anchorY: number
  candidateKey: string
  componentId: string
  height: number
  isCurrent: boolean
  label: string
  manufacturerId: string
  normalX: number
  normalY: number
  priority: number
  routeX: number
  routeY: number
  score: number
  width: number
  x: number
  y: number
}

interface RouteLabelPlacementState {
  candidateKey: string
  x: number
  y: number
}

interface FocusState {
  componentId?: string
  manufacturerId?: string
  product?: boolean
}

const GLOBE_CENTER = 50
const GLOBE_RADIUS = 40
const AUTO_ROTATION_SPEED = 0.000032
const DRAG_SENSITIVITY = 0.0065
const MAX_PITCH = Math.PI / 3
const ROUTE_SEGMENTS = 72
const CONTINENT_SUBDIVISIONS = 20
const COUNTRY_SUBDIVISIONS = 12
const PITCH_VELOCITY_DECAY = 0.94
const YAW_VELOCITY_DECAY = 0.9
const FRONT_PATH_THRESHOLD = 0
const BACK_PATH_THRESHOLD = -0.18
const ROUTE_FRONT_SURFACE_PADDING = 0.004
const IDLE_COMMIT_INTERVAL_MS = 1000 / 36
const ROUTE_LABEL_DRIFT_SPEED = 0.00034
const GRID_LATITUDES_PRIMARY = [-60, -36, -12, 12, 36, 60]
const GRID_LATITUDES_SECONDARY = [-72, -48, -24, 0, 24, 48, 72]
const GRID_LONGITUDES_PRIMARY = [
  -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150,
]
const GRID_LONGITUDES_SECONDARY = [
  -165, -135, -105, -75, -45, -15, 15, 45, 75, 105, 135, 165,
]
const PRODUCT_ORBIT = {
  control: { x: 84, y: 86 },
  end: { x: 96, y: 74 },
  start: { x: 69, y: 90 },
}
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

function toGeoPoint(location: SupplyScenarioLocation): GlobeGeoPoint {
  return {
    lat: location.lat,
    lon: location.lng,
  }
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

function normalizeVector(vector: Vector3) {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z) || 1

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
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
  const peakLift = clamp(0.075 + Math.sin(angle / 2) * 0.18, 0.075, 0.26)
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

    const arcHeight = Math.sin(progress * Math.PI) ** 0.94
    const crown = Math.sin(progress * Math.PI) ** 1.75
    const lift = 1 + arcHeight * peakLift + crown * 0.003

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

function buildRouteSegments(points: Vector3[], rotation: RotationState) {
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

function sampleProjectedRun(points: ProjectedPoint[], position: number) {
  const clampedPosition = clamp(position, 0, points.length - 1)
  const startIndex = Math.floor(clampedPosition)
  const endIndex = Math.min(points.length - 1, Math.ceil(clampedPosition))
  const mix = clampedPosition - startIndex
  const start = points[startIndex]
  const end = points[endIndex]

  return {
    depth: start.depth + (end.depth - start.depth) * mix,
    radial: start.radial + (end.radial - start.radial) * mix,
    visible: start.visible || end.visible,
    x: start.x + (end.x - start.x) * mix,
    y: start.y + (end.y - start.y) * mix,
  } satisfies ProjectedPoint
}

function getVisibleRouteRun(points: Vector3[], rotation: RotationState) {
  const visibleRuns: ProjectedPoint[][] = []
  let currentRun: ProjectedPoint[] = []

  points.forEach((point) => {
    const projected = rotateVector(point, rotation)

    if (!isRoutePointVisible(projected)) {
      if (currentRun.length > 1) {
        visibleRuns.push(currentRun)
      }
      currentRun = []
      return
    }

    currentRun.push(projected)
  })

  if (currentRun.length > 1) {
    visibleRuns.push(currentRun)
  }

  const longestVisibleRun = visibleRuns.reduce<ProjectedPoint[] | null>(
    (best, current) => (!best || current.length > best.length ? current : best),
    null
  )

  if (
    !longestVisibleRun ||
    longestVisibleRun.length < Math.max(8, Math.round(points.length * 0.18))
  ) {
    return null
  }

  return longestVisibleRun
}

function getRouteLabelAnchor(
  visibleRun: ProjectedPoint[],
  progress: number,
  offsetScale = 1
) {
  const anchorIndex = clamp(
    (visibleRun.length - 1) * progress,
    1,
    visibleRun.length - 2
  )
  const anchor = sampleProjectedRun(visibleRun, anchorIndex)
  const previousPoint = sampleProjectedRun(visibleRun, anchorIndex - 0.85)
  const nextPoint = sampleProjectedRun(visibleRun, anchorIndex + 0.85)
  const tangent = {
    x: nextPoint.x - previousPoint.x,
    y: nextPoint.y - previousPoint.y,
  }
  const tangentMagnitude = Math.hypot(tangent.x, tangent.y) || 1
  const outward = {
    x: anchor.x - GLOBE_CENTER,
    y: anchor.y - GLOBE_CENTER,
  }
  const outwardMagnitude = Math.hypot(outward.x, outward.y) || 1
  let normal = {
    x: -tangent.y / tangentMagnitude,
    y: tangent.x / tangentMagnitude,
  }
  const outwardDirection = {
    x: outward.x / outwardMagnitude,
    y: outward.y / outwardMagnitude,
  }

  if (normal.x * outwardDirection.x + normal.y * outwardDirection.y < 0) {
    normal = {
      x: -normal.x,
      y: -normal.y,
    }
  }

  const offset = {
    x:
      outwardDirection.x * (2.8 * offsetScale) + normal.x * (1.3 * offsetScale),
    y:
      outwardDirection.y * (2.8 * offsetScale) + normal.y * (1.3 * offsetScale),
  }
  const offsetMagnitude = Math.hypot(offset.x, offset.y) || 1
  const positionedAnchor = {
    x: anchor.x + offset.x,
    y: anchor.y + offset.y,
  }

  if (
    positionedAnchor.x < 8 ||
    positionedAnchor.x > 92 ||
    positionedAnchor.y < 7 ||
    positionedAnchor.y > 92
  ) {
    return null
  }

  return {
    normalX: offset.x / offsetMagnitude,
    normalY: offset.y / offsetMagnitude,
    routeX: anchor.x,
    routeY: anchor.y,
    x: positionedAnchor.x,
    y: positionedAnchor.y,
  }
}

function getRouteLabelPlacementPenalty(
  candidate: RouteLabelModel,
  placedLabels: RouteLabelModel[],
  anchorOffset: number,
  previousPlacement?: RouteLabelPlacementState
) {
  let penalty = Math.abs(anchorOffset) * 20

  if (previousPlacement) {
    penalty +=
      Math.hypot(
        candidate.x - previousPlacement.x,
        candidate.y - previousPlacement.y
      ) * 1.3
    penalty +=
      previousPlacement.candidateKey === candidate.candidateKey ? -16 : 22
  }

  for (const placedLabel of placedLabels) {
    const deltaX = Math.abs(candidate.x - placedLabel.x)
    const deltaY = Math.abs(candidate.y - placedLabel.y)
    const overlapX = candidate.width / 2 + placedLabel.width / 2 + 3.2 - deltaX
    const overlapY = candidate.height / 2 + placedLabel.height / 2 + 2 - deltaY

    if (overlapX > 0 && overlapY > 0) {
      penalty += 420 + overlapX * overlapY * 30
      continue
    }

    const gapX = deltaX - (candidate.width / 2 + placedLabel.width / 2)
    const gapY = deltaY - (candidate.height / 2 + placedLabel.height / 2)

    if (gapX < 4.2 && gapY < 2.8) {
      penalty += (4.2 - gapX) * 42 + (2.8 - gapY) * 34
    }
  }

  return penalty
}

function resolveRouteLabelCollisions(labels: RouteLabelModel[]) {
  const resolved = labels.map((label) => ({
    ...label,
  }))

  if (resolved.length < 2) {
    return labels
  }

  for (let iteration = 0; iteration < 16; iteration += 1) {
    let shifted = false

    for (let index = 0; index < resolved.length; index += 1) {
      for (
        let otherIndex = index + 1;
        otherIndex < resolved.length;
        otherIndex += 1
      ) {
        const label = resolved[index]
        const otherLabel = resolved[otherIndex]
        const deltaX = otherLabel.x - label.x
        const deltaY = otherLabel.y - label.y
        const overlapX =
          label.width / 2 + otherLabel.width / 2 + 1.2 - Math.abs(deltaX)
        const overlapY =
          label.height / 2 + otherLabel.height / 2 + 0.9 - Math.abs(deltaY)

        if (overlapX <= 0 || overlapY <= 0) {
          continue
        }

        shifted = true

        const labelMobility = 1 / Math.max(1, label.priority)
        const otherMobility = 1 / Math.max(1, otherLabel.priority)
        const totalMobility = labelMobility + otherMobility || 1
        const labelShare = labelMobility / totalMobility
        const otherShare = otherMobility / totalMobility

        if (overlapY <= overlapX) {
          const direction =
            deltaY === 0
              ? label.anchorY <= otherLabel.anchorY
                ? -1
                : 1
              : Math.sign(deltaY)
          const shift = overlapY / 2 + 0.24

          label.y -= direction * shift * labelShare
          otherLabel.y += direction * shift * otherShare
          label.x -= label.normalX * shift * 0.28 * labelShare
          otherLabel.x += otherLabel.normalX * shift * 0.28 * otherShare
        } else {
          const direction =
            deltaX === 0
              ? label.anchorX <= otherLabel.anchorX
                ? -1
                : 1
              : Math.sign(deltaX)
          const shift = overlapX / 2 + 0.28

          label.x -= direction * shift * labelShare
          otherLabel.x += direction * shift * otherShare
          label.y -= label.normalY * shift * 0.24 * labelShare
          otherLabel.y += otherLabel.normalY * shift * 0.24 * otherShare
        }
      }
    }

    resolved.forEach((label) => {
      label.x += (label.anchorX - label.x) * 0.08
      label.y += (label.anchorY - label.y) * 0.08
      label.x = clamp(label.x, label.width / 2 + 7, 93 - label.width / 2)
      label.y = clamp(label.y, label.height / 2 + 6.5, 93 - label.height / 2)
    })

    if (!shifted) {
      break
    }
  }

  return resolved.map((label) => ({
    ...label,
  }))
}

function stabilizeRouteLabels(
  labels: RouteLabelModel[],
  previousPlacements: Map<string, RouteLabelPlacementState>
) {
  const nextPlacements = new Map<string, RouteLabelPlacementState>()
  const smoothedLabels = labels.map((label) => {
    const previousPlacement = previousPlacements.get(label.componentId)

    if (!previousPlacement) {
      nextPlacements.set(label.componentId, {
        candidateKey: label.candidateKey,
        x: label.x,
        y: label.y,
      })

      return label
    }

    const followFactor =
      previousPlacement.candidateKey === label.candidateKey ? 0.22 : 0.13
    const smoothedLabel = {
      ...label,
      x: previousPlacement.x + (label.x - previousPlacement.x) * followFactor,
      y: previousPlacement.y + (label.y - previousPlacement.y) * followFactor,
    }

    nextPlacements.set(label.componentId, {
      candidateKey: label.candidateKey,
      x: smoothedLabel.x,
      y: smoothedLabel.y,
    })

    return smoothedLabel
  })

  previousPlacements.clear()

  nextPlacements.forEach((placement, componentId) => {
    previousPlacements.set(componentId, placement)
  })

  return smoothedLabels
}

function getRouteLabelLeaderPath(label: RouteLabelModel) {
  const deltaX = label.x - label.routeX
  const deltaY = label.y - label.routeY
  const distance = Math.hypot(deltaX, deltaY)

  if (distance < 3.8) {
    return null
  }

  const endInset = Math.min(label.width * 0.34, 5.8)
  const endX = label.x - (deltaX / distance) * endInset
  const endY =
    label.y - (deltaY / distance) * Math.min(label.height * 0.52, 2.8)
  const controlX = label.routeX + deltaX * 0.42 + label.normalX * 1.2
  const controlY = label.routeY + deltaY * 0.42 + label.normalY * 1.2

  return `M ${label.routeX.toFixed(2)} ${label.routeY.toFixed(2)} Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`
}

function pointOnQuadratic(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  progress: number
) {
  const inverse = 1 - progress

  return {
    x:
      inverse * inverse * start.x +
      2 * inverse * progress * control.x +
      progress * progress * end.x,
    y:
      inverse * inverse * start.y +
      2 * inverse * progress * control.y +
      progress * progress * end.y,
  }
}

function orbitPath({
  start,
  control,
  end,
}: {
  control: { x: number; y: number }
  end: { x: number; y: number }
  start: { x: number; y: number }
}) {
  return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`
}

function resolveFocus(
  nodeId: SupplyScenarioSelectableNodeId | null,
  nodeById: Map<string, SupplyScenario["graph"]["nodes"][number]["data"]>
): FocusState | null {
  if (!nodeId) {
    return null
  }

  const node = nodeById.get(nodeId)

  if (!node) {
    return null
  }

  if (node.kind === "product") {
    return { product: true }
  }

  if (node.kind === "component") {
    return { componentId: node.id }
  }

  return {
    componentId: node.componentId,
    manufacturerId: node.id,
  }
}

function getRouteStyle(
  route: RouteModel,
  selectedFocus: FocusState | null,
  hoveredFocus: FocusState | null,
  pinnedManufacturerByComponent: Record<string, string>
) {
  const overviewActive =
    (!selectedFocus && !hoveredFocus) ||
    selectedFocus?.product ||
    hoveredFocus?.product
  const anyFocusedRoute = Boolean(
    selectedFocus?.componentId ||
    selectedFocus?.manufacturerId ||
    hoveredFocus?.componentId ||
    hoveredFocus?.manufacturerId
  )
  const selectedManufacturer =
    selectedFocus?.manufacturerId === route.manufacturerId
  const hoveredManufacturer =
    hoveredFocus?.manufacturerId === route.manufacturerId
  const selectedComponent = selectedFocus?.componentId === route.componentId
  const hoveredComponent = hoveredFocus?.componentId === route.componentId
  const pinnedManufacturer =
    pinnedManufacturerByComponent[route.componentId] === route.manufacturerId

  if (selectedManufacturer) {
    return {
      coreColor: "#EEE7F8",
      coreOpacity: 1,
      coreWidth: 1.52,
      glowColor: "rgba(162,142,196,0.44)",
      glowOpacity: 0.98,
      glowWidth: 3.5,
      priority: 6,
      pulseColor: "#FBF8FF",
      pulseDash: "16 84",
      pulseDuration: "6.8s",
      pulseOpacity: 0.98,
      pulseWidth: 1.72,
    }
  }

  if (hoveredManufacturer) {
    return {
      coreColor: "#E2D8F0",
      coreOpacity: 0.98,
      coreWidth: 1.38,
      glowColor: "rgba(149,131,183,0.38)",
      glowOpacity: 0.92,
      glowWidth: 3.1,
      priority: 5,
      pulseColor: "#F4EDFB",
      pulseDash: "15 85",
      pulseDuration: "7.2s",
      pulseOpacity: 0.94,
      pulseWidth: 1.56,
    }
  }

  if (selectedComponent) {
    if (pinnedManufacturer) {
      return {
        coreColor: "#E1D6F0",
        coreOpacity: 0.98,
        coreWidth: 1.28,
        glowColor: "rgba(148,130,183,0.34)",
        glowOpacity: 0.9,
        glowWidth: 2.95,
        priority: 4.5,
        pulseColor: "#F6EFFD",
        pulseDash: "14 86",
        pulseDuration: "7.4s",
        pulseOpacity: 0.9,
        pulseWidth: 1.4,
      }
    }

    return route.isCurrent
      ? {
          coreColor: "#DCCEEA",
          coreOpacity: 0.96,
          coreWidth: 1.24,
          glowColor: "rgba(142,125,176,0.3)",
          glowOpacity: 0.86,
          glowWidth: 2.8,
          priority: 4,
          pulseColor: "#F4EDFB",
          pulseDash: "14 86",
          pulseDuration: "7.6s",
          pulseOpacity: 0.88,
          pulseWidth: 1.34,
        }
      : {
          coreColor: "rgba(209,195,228,0.74)",
          coreOpacity: 0.82,
          coreWidth: 0.98,
          glowColor: "rgba(128,112,161,0.2)",
          glowOpacity: 0.68,
          glowWidth: 2.2,
          priority: 3,
          pulseColor: "rgba(244,237,251,0.8)",
          pulseDash: "12 88",
          pulseDuration: "8.4s",
          pulseOpacity: 0.76,
          pulseWidth: 1.08,
        }
  }

  if (hoveredComponent) {
    if (pinnedManufacturer) {
      return {
        coreColor: "#DDD1EB",
        coreOpacity: 0.94,
        coreWidth: 1.18,
        glowColor: "rgba(142,124,175,0.3)",
        glowOpacity: 0.84,
        glowWidth: 2.7,
        priority: 3.5,
        pulseColor: "#F4ECFC",
        pulseDash: "13 87",
        pulseDuration: "7.9s",
        pulseOpacity: 0.84,
        pulseWidth: 1.28,
      }
    }

    return route.isCurrent
      ? {
          coreColor: "#D7CAE7",
          coreOpacity: 0.92,
          coreWidth: 1.18,
          glowColor: "rgba(138,121,170,0.28)",
          glowOpacity: 0.82,
          glowWidth: 2.6,
          priority: 3,
          pulseColor: "#F1E9FA",
          pulseDash: "13 87",
          pulseDuration: "8s",
          pulseOpacity: 0.84,
          pulseWidth: 1.26,
        }
      : {
          coreColor: "rgba(202,190,222,0.66)",
          coreOpacity: 0.78,
          coreWidth: 0.9,
          glowColor: "rgba(122,108,154,0.17)",
          glowOpacity: 0.6,
          glowWidth: 2,
          priority: 2,
          pulseColor: "rgba(240,232,248,0.7)",
          pulseDash: "12 88",
          pulseDuration: "8.8s",
          pulseOpacity: 0.7,
          pulseWidth: 1.02,
        }
  }

  if (pinnedManufacturer) {
    return route.isCurrent
      ? {
          coreColor: "#D9CBE9",
          coreOpacity: 0.92,
          coreWidth: 1.14,
          glowColor: "rgba(140,123,173,0.29)",
          glowOpacity: 0.82,
          glowWidth: 2.55,
          priority: 2.5,
          pulseColor: "#F2EAFB",
          pulseDash: "13 87",
          pulseDuration: "8s",
          pulseOpacity: 0.82,
          pulseWidth: 1.22,
        }
      : {
          coreColor: "rgba(216,206,235,0.82)",
          coreOpacity: 0.88,
          coreWidth: 1.04,
          glowColor: "rgba(132,116,166,0.24)",
          glowOpacity: 0.72,
          glowWidth: 2.28,
          priority: 2.3,
          pulseColor: "rgba(242,234,251,0.84)",
          pulseDash: "12 88",
          pulseDuration: "8.6s",
          pulseOpacity: 0.76,
          pulseWidth: 1.08,
        }
  }

  if (overviewActive) {
    return route.isCurrent
      ? {
          coreColor: "#D1C2E3",
          coreOpacity: 0.94,
          coreWidth: 1.12,
          glowColor: "rgba(133,117,166,0.25)",
          glowOpacity: 0.76,
          glowWidth: 2.45,
          priority: 2,
          pulseColor: "#F0E8FA",
          pulseDash: "13 87",
          pulseDuration: "8.2s",
          pulseOpacity: 0.84,
          pulseWidth: 1.2,
        }
      : {
          coreColor: "rgba(176,158,202,0.48)",
          coreOpacity: 0.62,
          coreWidth: 0.78,
          glowColor: "rgba(114,100,146,0.13)",
          glowOpacity: 0.42,
          glowWidth: 1.72,
          priority: 1,
          pulseColor: "rgba(236,228,246,0.56)",
          pulseDash: "11 89",
          pulseDuration: "9.2s",
          pulseOpacity: 0.56,
          pulseWidth: 0.92,
        }
  }

  return route.isCurrent && anyFocusedRoute
    ? {
        coreColor: "rgba(192,177,219,0.3)",
        coreOpacity: 0.34,
        coreWidth: 0.54,
        glowColor: "rgba(111,96,141,0.08)",
        glowOpacity: 0.16,
        glowWidth: 1.28,
        priority: 0,
        pulseColor: "rgba(233,225,244,0.24)",
        pulseDash: "10 90",
        pulseDuration: "10.2s",
        pulseOpacity: 0.22,
        pulseWidth: 0.62,
      }
    : {
        coreColor: "rgba(193,184,213,0.16)",
        coreOpacity: 0.18,
        coreWidth: 0.42,
        glowColor: "rgba(101,88,131,0.04)",
        glowOpacity: 0.08,
        glowWidth: 0.96,
        priority: 0,
        pulseColor: "rgba(228,220,240,0.12)",
        pulseDash: "10 90",
        pulseDuration: "10.8s",
        pulseOpacity: 0.1,
        pulseWidth: 0.5,
      }
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

export function InteractiveGlobe({
  className,
  hoveredNodeId,
  onHoverNode,
  onSelectNode,
  pinnedManufacturerByComponent,
  scenario,
  selectedNodeId,
}: InteractiveGlobeProps) {
  const [rotation, setRotation] = useState(DEFAULT_ROTATION)
  const [routeLabelPhase, setRouteLabelPhase] = useState(0)
  const [geometry, setGeometry] = useState(DEFAULT_GLOBE_GEOMETRY)
  const clipPathId = `globe-clip-${useId().replaceAll(":", "")}`
  const dragStateRef = useRef<DragState | null>(null)
  const lastCommitRef = useRef(0)
  const routeLabelPlacementsRef = useRef(
    new Map<string, RouteLabelPlacementState>()
  )
  const rotationRef = useRef(DEFAULT_ROTATION)
  const velocityRef = useRef({ pitch: 0, yaw: 0 })

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

  useEffect(() => {
    routeLabelPlacementsRef.current.clear()
  }, [scenario.id])

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

      const shouldCommit =
        dragStateRef.current ||
        timestamp - lastCommitRef.current >= IDLE_COMMIT_INTERVAL_MS

      if (shouldCommit) {
        lastCommitRef.current = timestamp
        setRotation({ ...rotationRef.current })
        setRouteLabelPhase(timestamp * ROUTE_LABEL_DRIFT_SPEED)
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  const nodeById = useMemo(
    () =>
      new Map(
        scenario.graph.nodes.map((node) => [node.id, node.data] as const)
      ),
    [scenario.graph.nodes]
  )
  const selectedFocus = useMemo(
    () => resolveFocus(selectedNodeId, nodeById),
    [nodeById, selectedNodeId]
  )
  const hoveredFocus = useMemo(
    () => resolveFocus(hoveredNodeId, nodeById),
    [hoveredNodeId, nodeById]
  )
  const manufacturerById = useMemo(
    () =>
      new Map(
        scenario.manufacturers.map(
          (manufacturer) => [manufacturer.id, manufacturer] as const
        )
      ),
    [scenario.manufacturers]
  )
  const pinnedManufacturerIds = useMemo(
    () => new Set(Object.values(pinnedManufacturerByComponent)),
    [pinnedManufacturerByComponent]
  )
  const routeModels = useMemo(
    () =>
      scenario.routes
        .map((route) => {
          const manufacturer = manufacturerById.get(route.manufacturerId)

          if (!manufacturer) {
            return null
          }

          return {
            componentId: route.componentId,
            id: route.id,
            isCurrent: route.isCurrent,
            manufacturerId: route.manufacturerId,
            points: interpolateRoute(
              toGeoPoint(manufacturer.location),
              toGeoPoint(scenario.destination.location)
            ),
          }
        })
        .filter((route): route is RouteModel => Boolean(route)),
    [manufacturerById, scenario.destination.location, scenario.routes]
  )
  const projectedManufacturerSites = useMemo(
    () =>
      scenario.manufacturers
        .map((manufacturer) => ({
          id: manufacturer.id,
          isCurrent: manufacturer.isCurrent,
          location: manufacturer.location,
          point: projectGeoPoint(toGeoPoint(manufacturer.location), rotation),
          type: "manufacturer" as const,
        }))
        .filter((site) => site.point.visible)
        .sort((left, right) => left.point.depth - right.point.depth),
    [rotation, scenario.manufacturers]
  )
  const projectedDestination = useMemo(() => {
    const point = projectGeoPoint(
      toGeoPoint(scenario.destination.location),
      rotation
    )

    return point.visible
      ? {
          id: scenario.destination.id,
          point,
        }
      : null
  }, [rotation, scenario.destination])

  const landOutlines =
    geometry.source === "fallback"
      ? SMOOTHED_FALLBACK_LAND_OUTLINES
      : geometry.landOutlines
  const countryOutlines =
    geometry.source === "fallback"
      ? SMOOTHED_FALLBACK_COUNTRY_BOUNDARIES
      : geometry.countryBoundaries

  const continentPaths = useMemo(
    () =>
      landOutlines.flatMap((outline) =>
        buildHemispherePath(outline, rotation, "front")
      ),
    [landOutlines, rotation]
  )
  const continentBackPaths = useMemo(
    () =>
      landOutlines.flatMap((outline) =>
        buildHemispherePath(outline, rotation, "back")
      ),
    [landOutlines, rotation]
  )
  const countryPaths = useMemo(
    () =>
      countryOutlines.flatMap((outline) =>
        buildHemispherePath(outline, rotation, "front")
      ),
    [countryOutlines, rotation]
  )
  const countryBackPaths = useMemo(
    () =>
      countryOutlines.flatMap((outline) =>
        buildHemispherePath(outline, rotation, "back")
      ),
    [countryOutlines, rotation]
  )
  const primaryLatitudePaths = useMemo(
    () =>
      PRIMARY_LATITUDE_LINES.flatMap((line) =>
        buildHemispherePath(line, rotation, "front")
      ),
    [rotation]
  )
  const secondaryLatitudePaths = useMemo(
    () =>
      SECONDARY_LATITUDE_LINES.flatMap((line) =>
        buildHemispherePath(line, rotation, "front")
      ),
    [rotation]
  )
  const backLatitudePaths = useMemo(
    () =>
      [...PRIMARY_LATITUDE_LINES, ...SECONDARY_LATITUDE_LINES].flatMap((line) =>
        buildHemispherePath(line, rotation, "back")
      ),
    [rotation]
  )
  const primaryLongitudePaths = useMemo(
    () =>
      PRIMARY_LONGITUDE_LINES.flatMap((line) =>
        buildHemispherePath(line, rotation, "front")
      ),
    [rotation]
  )
  const secondaryLongitudePaths = useMemo(
    () =>
      SECONDARY_LONGITUDE_LINES.flatMap((line) =>
        buildHemispherePath(line, rotation, "front")
      ),
    [rotation]
  )
  const backLongitudePaths = useMemo(
    () =>
      [...PRIMARY_LONGITUDE_LINES, ...SECONDARY_LONGITUDE_LINES].flatMap(
        (line) => buildHemispherePath(line, rotation, "back")
      ),
    [rotation]
  )
  const routeSegments = useMemo(
    () =>
      routeModels
        .flatMap((route, routeIndex) => {
          const style = getRouteStyle(
            route,
            selectedFocus,
            hoveredFocus,
            pinnedManufacturerByComponent
          )

          return buildRouteSegments(route.points, rotation).map(
            (path, segmentIndex) => ({
              drawDelay: `${routeIndex * 0.16 + segmentIndex * 0.05}s`,
              id: `${route.id}-${segmentIndex}`,
              manufacturerId: route.manufacturerId,
              path,
              pulseBegin: `${(routeIndex + segmentIndex) * 0.45}s`,
              route,
              style,
            })
          )
        })
        .sort((left, right) => left.style.priority - right.style.priority),
    [
      hoveredFocus,
      pinnedManufacturerByComponent,
      rotation,
      routeModels,
      selectedFocus,
    ]
  )
  const dynamicComponentLabels = useMemo(() => {
    const componentCount = scenario.components.length
    const placedLabels: RouteLabelModel[] = []
    const labelDescriptors = scenario.components
      .map((component, componentIndex) => {
        const componentId = component.id
        const selectedComponent = selectedFocus?.componentId === componentId
        const hoveredComponent = hoveredFocus?.componentId === componentId
        const preferredManufacturerId =
          selectedComponent || hoveredComponent
            ? selectedComponent
              ? selectedFocus?.manufacturerId
              : hoveredFocus?.manufacturerId
            : pinnedManufacturerByComponent[componentId]
        const currentFirst =
          !selectedComponent &&
          !hoveredComponent &&
          !pinnedManufacturerByComponent[componentId]
        const candidateRoutes = routeModels
          .filter((route) => route.componentId === componentId)
          .sort((left, right) => {
            const leftScore =
              (preferredManufacturerId === left.manufacturerId ? 6 : 0) +
              (currentFirst && left.isCurrent ? 3 : 0) +
              (selectedComponent && left.isCurrent ? 2 : 0) +
              (hoveredComponent && left.isCurrent ? 1 : 0)
            const rightScore =
              (preferredManufacturerId === right.manufacturerId ? 6 : 0) +
              (currentFirst && right.isCurrent ? 3 : 0) +
              (selectedComponent && right.isCurrent ? 2 : 0) +
              (hoveredComponent && right.isCurrent ? 1 : 0)

            return rightScore - leftScore
          })

        return {
          candidateRoutes,
          component,
          componentIndex,
          priority: selectedComponent ? 6 : hoveredComponent ? 5 : 2,
        }
      })
      .filter((descriptor) => descriptor.candidateRoutes.length > 0)
      .sort((left, right) => {
        if (right.priority !== left.priority) {
          return right.priority - left.priority
        }

        return left.componentIndex - right.componentIndex
      })

    for (const descriptor of labelDescriptors) {
      const { candidateRoutes, component, componentIndex, priority } =
        descriptor
      const width = Math.max(18, component.label.length * 1.8 + 9)
      const height = 5.9
      const previousPlacement = routeLabelPlacementsRef.current.get(
        component.id
      )
      const laneOffset =
        componentCount <= 1
          ? 0
          : (componentIndex / Math.max(1, componentCount - 1) - 0.5) * 0.4
      let bestLabel: RouteLabelModel | null = null
      let bestPenalty = Number.POSITIVE_INFINITY

      for (
        let routeIndex = 0;
        routeIndex < Math.min(2, candidateRoutes.length);
        routeIndex += 1
      ) {
        const route = candidateRoutes[routeIndex]
        const visibleRun = getVisibleRouteRun(route.points, rotation)

        if (!visibleRun) {
          continue
        }

        const baseProgress = clamp(
          0.48 +
            laneOffset +
            Math.sin(
              routeLabelPhase + componentIndex * 0.82 + routeIndex * 0.38
            ) *
              0.04,
          0.16,
          0.84
        )
        const progressOffsets = [0, -0.18, 0.18, -0.32, 0.32, -0.42, 0.42]
        const offsetScales = [1.1, 1.45, 1.85, 2.2]

        for (const progressOffset of progressOffsets) {
          const progress = clamp(baseProgress + progressOffset, 0.16, 0.84)
          for (const offsetScale of offsetScales) {
            const anchor = getRouteLabelAnchor(
              visibleRun,
              progress,
              offsetScale + Math.abs(progressOffset) * 0.85
            )

            if (!anchor) {
              continue
            }

            const candidateKey = `${route.id}:${progress.toFixed(3)}:${offsetScale.toFixed(2)}`
            const candidateLabel = {
              anchorX: anchor.x,
              anchorY: anchor.y,
              candidateKey,
              componentId: component.id,
              height,
              isCurrent: route.isCurrent,
              label: component.label,
              manufacturerId: route.manufacturerId,
              normalX: anchor.normalX,
              normalY: anchor.normalY,
              priority: priority + (route.isCurrent ? 1 : 0),
              routeX: anchor.routeX,
              routeY: anchor.routeY,
              score: 0,
              width,
              x: anchor.x,
              y: anchor.y,
            } satisfies RouteLabelModel
            const penalty =
              getRouteLabelPlacementPenalty(
                candidateLabel,
                placedLabels,
                progressOffset,
                previousPlacement
              ) +
              routeIndex * 44 +
              (offsetScale - 1) * 14

            if (penalty < bestPenalty) {
              bestPenalty = penalty
              bestLabel = {
                ...candidateLabel,
                score: penalty,
              }
            }
          }
        }
      }

      if (bestLabel) {
        placedLabels.push(bestLabel)
      }
    }

    return stabilizeRouteLabels(
      resolveRouteLabelCollisions(placedLabels),
      routeLabelPlacementsRef.current
    )
  }, [
    hoveredFocus,
    pinnedManufacturerByComponent,
    rotation,
    routeLabelPhase,
    routeModels,
    scenario.components,
    selectedFocus,
  ])
  const productOrbitLabel = useMemo(() => {
    const point = pointOnQuadratic(
      PRODUCT_ORBIT.start,
      PRODUCT_ORBIT.control,
      PRODUCT_ORBIT.end,
      0.5
    )

    return {
      active:
        selectedNodeId === scenario.product.id ||
        hoveredNodeId === scenario.product.id,
      height: 6.2,
      id: scenario.product.id,
      label: scenario.product.label,
      width: Math.max(24, scenario.product.label.length * 1.8 + 10),
      x: point.x,
      y: point.y,
    }
  }, [hoveredNodeId, scenario.product, selectedNodeId])

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
        "group relative aspect-square w-full max-w-[31rem] touch-none select-none md:max-w-[34rem]",
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
      <style>{`
        @keyframes globe-route-draw {
          from {
            stroke-dashoffset: 100;
          }

          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes globe-label-breathe {
          0%, 100% {
            transform: translateY(0px);
          }

          50% {
            transform: translateY(-1px);
          }
        }

        @keyframes globe-label-pulse {
          0%, 100% {
            opacity: 0.94;
            transform: scale(1);
          }

          50% {
            opacity: 1;
            transform: scale(1.015);
          }
        }

        @keyframes globe-label-dot-pulse {
          0%, 100% {
            opacity: 0.58;
            transform: scale(1);
          }

          50% {
            opacity: 0.94;
            transform: scale(1.22);
          }
        }

        .globe-route-draw {
          animation-duration: 1.05s;
          animation-fill-mode: both;
          animation-name: globe-route-draw;
          animation-timing-function: cubic-bezier(0.2, 0.9, 0.2, 1);
        }

        .globe-floating-label {
          animation: globe-label-breathe 3.4s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }

        .globe-floating-label-pulse {
          animation: globe-label-pulse 5.8s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }

        .globe-floating-label-dot {
          animation: globe-label-dot-pulse 4.6s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
      `}</style>
      <div className="absolute inset-[7%] rounded-full border border-white/[0.09] shadow-[0_0_18px_rgba(145,128,176,0.02)]" />
      <div className="absolute inset-[17%] rounded-full border border-white/[0.07]" />

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
          <radialGradient id={`${clipPathId}-surface`} cx="40%" cy="34%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.11" />
            <stop offset="28%" stopColor="#ffffff" stopOpacity="0.055" />
            <stop offset="68%" stopColor="#ffffff" stopOpacity="0.016" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${clipPathId}-core-shadow`} cx="66%" cy="70%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.02" />
            <stop offset="48%" stopColor="#000000" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.34" />
          </radialGradient>
          <linearGradient
            id={`${clipPathId}-rim`}
            x1="18%"
            y1="14%"
            x2="86%"
            y2="86%"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.78" />
            <stop offset="28%" stopColor="#ffffff" stopOpacity="0.24" />
            <stop offset="70%" stopColor="#cdbde2" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.06" />
          </linearGradient>
          <radialGradient id={`${clipPathId}-atmosphere`} cx="42%" cy="36%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="86%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="93%" stopColor="#d6caea" stopOpacity="0.05" />
            <stop offset="98%" stopColor="#f7f4ff" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id={`${clipPathId}-atmosphere-stroke`}
            x1="16%"
            y1="18%"
            x2="84%"
            y2="82%"
          >
            <stop offset="0%" stopColor="#f8f5ff" stopOpacity="0.28" />
            <stop offset="34%" stopColor="#dbcff0" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <path
          d={orbitPath(PRODUCT_ORBIT)}
          fill="none"
          stroke="rgba(164,153,190,0.16)"
          strokeWidth="0.32"
        />

        <circle
          cx={GLOBE_CENTER}
          cy={GLOBE_CENTER}
          r={GLOBE_RADIUS + 1.05}
          fill={`url(#${clipPathId}-atmosphere)`}
          opacity={0.72}
        />
        <circle
          cx={GLOBE_CENTER}
          cy={GLOBE_CENTER}
          r={GLOBE_RADIUS + 0.34}
          fill="none"
          stroke={`url(#${clipPathId}-atmosphere-stroke)`}
          strokeWidth="0.34"
          opacity={0.72}
        />

        <circle
          cx={GLOBE_CENTER}
          cy={GLOBE_CENTER}
          r={GLOBE_RADIUS}
          fill="rgba(255,255,255,0.01)"
          stroke={`url(#${clipPathId}-rim)`}
          strokeWidth="0.72"
        />
        <circle
          cx={GLOBE_CENTER}
          cy={GLOBE_CENTER}
          r={GLOBE_RADIUS - 0.8}
          fill={`url(#${clipPathId}-surface)`}
          opacity={0.88}
        />
        <circle
          cx={GLOBE_CENTER}
          cy={GLOBE_CENTER}
          r={GLOBE_RADIUS - 1.2}
          fill={`url(#${clipPathId}-core-shadow)`}
          opacity={0.98}
        />

        <g clipPath={`url(#${clipPathId})`}>
          {backLatitudePaths.map((path, index) => (
            <path
              key={`lat-back-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.045)"
              strokeWidth="0.18"
            />
          ))}

          {backLongitudePaths.map((path, index) => (
            <path
              key={`lon-back-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.18"
            />
          ))}

          {countryBackPaths.map((path, index) => (
            <path
              key={`country-back-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="1.1 1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="0.22"
            />
          ))}

          {continentBackPaths.map((path, index) => (
            <path
              key={`continent-back-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="1.8 2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="0.4"
            />
          ))}

          {secondaryLatitudePaths.map((path, index) => (
            <path
              key={`lat-secondary-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.18"
            />
          ))}

          {secondaryLongitudePaths.map((path, index) => (
            <path
              key={`lon-secondary-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.055)"
              strokeWidth="0.18"
            />
          ))}

          {primaryLatitudePaths.map((path, index) => (
            <path
              key={`lat-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.11)"
              strokeWidth="0.22"
            />
          ))}

          {primaryLongitudePaths.map((path, index) => (
            <path
              key={`lon-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.09)"
              strokeWidth="0.22"
            />
          ))}

          {countryPaths.map((path, index) => (
            <path
              key={`country-glow-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="0.76"
              opacity={0.5}
            />
          ))}

          {continentPaths.map((path, index) => (
            <path
              key={`continent-glow-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.19)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.34"
              opacity={0.55}
            />
          ))}

          {countryPaths.map((path, index) => (
            <path
              key={`country-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.34)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="0.3"
            />
          ))}

          {continentPaths.map((path, index) => (
            <path
              key={`continent-${index}`}
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.94)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="0.7"
            />
          ))}

          {projectedManufacturerSites.map((site) => {
            const manufacturer = manufacturerById.get(site.id)

            if (!manufacturer) {
              return null
            }

            const focused =
              selectedNodeId === manufacturer.id ||
              hoveredNodeId === manufacturer.id ||
              selectedFocus?.componentId === manufacturer.componentId ||
              hoveredFocus?.componentId === manufacturer.componentId
            const pinned = pinnedManufacturerIds.has(manufacturer.id)
            const radius = focused
              ? 1.85
              : pinned
                ? 1.58
                : manufacturer.isCurrent
                  ? 1.4
                  : 1.1

            return (
              <g
                key={site.id}
                onClick={() => onSelectNode(manufacturer.id)}
                onPointerEnter={() => onHoverNode(manufacturer.id)}
                onPointerLeave={() => onHoverNode(null)}
                style={{ cursor: "pointer" }}
              >
                {manufacturer.isCurrent || focused || pinned ? (
                  <circle
                    cx={site.point.x}
                    cy={site.point.y}
                    r={radius + 2.4}
                    fill="rgba(158,140,189,0.08)"
                    opacity={manufacturer.isCurrent || pinned ? 0.42 : 0.28}
                    stroke="rgba(196,184,220,0.18)"
                    strokeWidth="0.2"
                  >
                    <animate
                      attributeName="r"
                      begin={`${manufacturer.isCurrent || pinned ? 0.2 : 0.6}s`}
                      dur={manufacturer.isCurrent || pinned ? "2.9s" : "2.3s"}
                      repeatCount="indefinite"
                      values={`${radius + 1.4};${radius + 3.4};${radius + 1.4}`}
                    />
                    <animate
                      attributeName="opacity"
                      begin={`${manufacturer.isCurrent || pinned ? 0.2 : 0.6}s`}
                      dur={manufacturer.isCurrent || pinned ? "2.9s" : "2.3s"}
                      repeatCount="indefinite"
                      values={
                        manufacturer.isCurrent || pinned
                          ? "0.3;0.08;0.3"
                          : "0.24;0.06;0.24"
                      }
                    />
                  </circle>
                ) : null}
                {focused ? (
                  <circle
                    cx={site.point.x}
                    cy={site.point.y}
                    r={radius + 2.1}
                    fill="rgba(216,206,233,0.08)"
                    stroke="rgba(196,185,220,0.34)"
                    strokeWidth="0.34"
                  />
                ) : null}
                <circle
                  cx={site.point.x}
                  cy={site.point.y}
                  r={radius}
                  fill={
                    manufacturer.isCurrent || pinned
                      ? "#F8F3FF"
                      : "rgba(248,243,255,0.8)"
                  }
                  stroke={
                    focused
                      ? "rgba(205,191,228,0.36)"
                      : pinned
                        ? "rgba(194,180,221,0.28)"
                        : "rgba(255,255,255,0.22)"
                  }
                  strokeWidth="0.3"
                >
                  <animate
                    attributeName="opacity"
                    begin="0s"
                    dur="0.5s"
                    fill="freeze"
                    from="0"
                    to="1"
                  />
                  <animate
                    attributeName="r"
                    begin="0s"
                    dur="0.5s"
                    fill="freeze"
                    from="0.1"
                    to={`${radius}`}
                  />
                </circle>
              </g>
            )
          })}

          {projectedDestination ? (
            <g>
              <circle
                cx={projectedDestination.point.x}
                cy={projectedDestination.point.y}
                r={5.6}
                fill="rgba(255,255,255,0.06)"
                stroke="rgba(196,184,220,0.16)"
                strokeWidth="0.2"
              >
                <animate
                  attributeName="r"
                  begin="0.35s"
                  dur="3.2s"
                  repeatCount="indefinite"
                  values="4.7;6.5;4.7"
                />
                <animate
                  attributeName="opacity"
                  begin="0.35s"
                  dur="3.2s"
                  repeatCount="indefinite"
                  values="0.22;0.06;0.22"
                />
              </circle>
              <circle
                cx={projectedDestination.point.x}
                cy={projectedDestination.point.y}
                r={4.7}
                fill="rgba(255,255,255,0.08)"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="0.36"
              >
                <animate
                  attributeName="opacity"
                  begin="0.1s"
                  dur="0.55s"
                  fill="freeze"
                  from="0"
                  to="1"
                />
              </circle>
              <circle
                cx={projectedDestination.point.x}
                cy={projectedDestination.point.y}
                r={2.05}
                fill="#FFFFFF"
                stroke="rgba(201,190,226,0.42)"
                strokeWidth="0.3"
              >
                <animate
                  attributeName="r"
                  begin="0.1s"
                  dur="0.55s"
                  fill="freeze"
                  from="0.1"
                  to="2.05"
                />
              </circle>
            </g>
          ) : null}
        </g>

        {routeSegments.map(
          ({ drawDelay, id, manufacturerId, path, pulseBegin, style }) => (
            <g
              key={id}
              onClick={() => onSelectNode(manufacturerId)}
              onPointerEnter={() => onHoverNode(manufacturerId)}
              onPointerLeave={() => onHoverNode(null)}
              style={{ cursor: "pointer" }}
            >
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={path}
                fill="none"
                pathLength={100}
                stroke={style.glowColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={style.glowOpacity}
                strokeDasharray="100"
                strokeWidth={style.glowWidth}
                className="globe-route-draw"
                style={{
                  animationDelay: drawDelay,
                }}
              />
              <path
                d={path}
                fill="none"
                pathLength={100}
                stroke={style.coreColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={style.coreOpacity}
                strokeDasharray="100"
                strokeWidth={style.coreWidth}
                className="globe-route-draw"
                style={{
                  animationDelay: drawDelay,
                }}
              />
              <path
                d={path}
                fill="none"
                pathLength={100}
                stroke={style.pulseColor}
                strokeDasharray={style.pulseDash}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={style.pulseOpacity}
                strokeWidth={style.pulseWidth}
              >
                <animate
                  attributeName="stroke-dashoffset"
                  begin={pulseBegin}
                  dur={style.pulseDuration}
                  from="120"
                  repeatCount="indefinite"
                  to="0"
                />
              </path>
            </g>
          )
        )}

        <ellipse
          cx={GLOBE_CENTER}
          cy={GLOBE_CENTER}
          rx={GLOBE_RADIUS * 0.98}
          ry={GLOBE_RADIUS * 0.42}
          fill="none"
          opacity={0.78}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="0.32"
        />

        <g
          onClick={() => onSelectNode(productOrbitLabel.id)}
          onPointerEnter={() => onHoverNode(productOrbitLabel.id)}
          onPointerLeave={() => onHoverNode(null)}
          style={{ cursor: "pointer" }}
        >
          <rect
            x={productOrbitLabel.x - productOrbitLabel.width / 2}
            y={productOrbitLabel.y - productOrbitLabel.height / 2}
            width={productOrbitLabel.width}
            height={productOrbitLabel.height}
            rx={productOrbitLabel.height / 2}
            fill={
              productOrbitLabel.active
                ? "rgba(97,82,126,0.34)"
                : "rgba(10,10,18,0.72)"
            }
            stroke={
              productOrbitLabel.active
                ? "rgba(204,193,228,0.42)"
                : "rgba(255,255,255,0.14)"
            }
            strokeWidth="0.3"
          />
          <text
            x={productOrbitLabel.x}
            y={productOrbitLabel.y + 0.8}
            fill={
              productOrbitLabel.active ? "#FFFFFF" : "rgba(255,255,255,0.82)"
            }
            fontSize="2.3"
            fontWeight="600"
            textAnchor="middle"
          >
            {productOrbitLabel.label}
          </text>
        </g>

        {dynamicComponentLabels.map((label) => (
          <g
            key={`route-label-${label.componentId}`}
            className={
              label.isCurrent
                ? "globe-floating-label globe-floating-label-pulse"
                : "globe-floating-label"
            }
            onClick={() => onSelectNode(label.componentId)}
            onPointerEnter={() => onHoverNode(label.manufacturerId)}
            onPointerLeave={() => onHoverNode(null)}
            style={{ cursor: "pointer" }}
          >
            {getRouteLabelLeaderPath(label) ? (
              <>
                <path
                  d={getRouteLabelLeaderPath(label) ?? undefined}
                  fill="none"
                  stroke={
                    label.isCurrent
                      ? "rgba(194,182,214,0.42)"
                      : "rgba(153,142,178,0.28)"
                  }
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={0.34}
                />
                <circle
                  cx={label.routeX}
                  cy={label.routeY}
                  r={0.48}
                  className={label.isCurrent ? "globe-floating-label-dot" : undefined}
                  fill={
                    label.isCurrent
                      ? "rgba(234,228,245,0.76)"
                      : "rgba(178,168,199,0.38)"
                  }
                />
              </>
            ) : null}
            <rect
              x={label.x - label.width / 2}
              y={label.y - label.height / 2}
              width={label.width}
              height={label.height}
              rx={label.height / 2}
              fill={
                label.isCurrent ? "rgba(46,39,61,0.86)" : "rgba(22,19,30,0.9)"
              }
              stroke={
                label.isCurrent
                  ? "rgba(214,204,236,0.42)"
                  : "rgba(192,182,214,0.22)"
              }
              strokeWidth="0.32"
            />
            <text
              x={label.x}
              y={label.y + 0.72}
              fill="#FFFFFF"
              fontSize="2.12"
              fontWeight="600"
              paintOrder="stroke"
              stroke="rgba(5,5,10,0.82)"
              strokeWidth="0.46"
              textAnchor="middle"
            >
              {label.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
        <div className="rounded-full border border-white/12 bg-black/18 px-3 py-1 text-[0.65rem] tracking-[0.2em] text-white/70 uppercase backdrop-blur-sm">
          Drag to rotate
        </div>
      </div>
    </div>
  )
}
