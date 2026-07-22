import { lines, stationById, stations } from '../data/metro'
import type { LineId, Station } from '../types'

export interface MapView {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface CanvasSize {
  width: number
  height: number
}

export interface LabelPlacement {
  dx: number
  dy: number
  anchor: 'start' | 'middle' | 'end'
}

interface ScreenRect {
  left: number
  top: number
  right: number
  bottom: number
}

interface LabelCandidate {
  key: string
  baseX: number
  baseY: number
  lines: string[]
  priority: number
  placements: LabelPlacement[]
  className: string
  plate?: boolean
}

export interface PlacedLabel extends LabelCandidate {
  placement: LabelPlacement
  x: number
  y: number
  rect: ScreenRect
}

export const FULL_VIEW: MapView = { x: 18, y: 8, width: 924, height: 694 }
export const MAP_BOUNDS = { x: 0, y: 0, width: 960, height: 710 }
export const MAP_ASPECT = FULL_VIEW.width / FULL_VIEW.height
export const MIN_VIEW_WIDTH = 285
export const MAX_VIEW_WIDTH = 1080
export const lineIds: LineId[] = ['M1', 'M2', 'M3']

const LABEL_OVERRIDES: Record<string, LabelPlacement> = {
  akademmistechko: { dx: 10, dy: 20, anchor: 'start' },
  lisova: { dx: -10, dy: 20, anchor: 'end' },
  'heroiv-dnipra': { dx: -15, dy: 4, anchor: 'end' },
  teremky: { dx: -15, dy: 4, anchor: 'end' },
  syrets: { dx: 0, dy: -16, anchor: 'middle' },
  'chervonyi-khutir': { dx: -13, dy: 20, anchor: 'end' },
  teatralna: { dx: -17, dy: -17, anchor: 'end' },
  'zoloti-vorota': { dx: -18, dy: 20, anchor: 'end' },
  khreshchatyk: { dx: 18, dy: -15, anchor: 'start' },
  'maidan-nezalezhnosti': { dx: 18, dy: 21, anchor: 'start' },
  'ploshcha-ukrainskykh-heroiv': { dx: -18, dy: 23, anchor: 'end' },
  'palats-sportu': { dx: 18, dy: 23, anchor: 'start' },
  vokzalna: { dx: -9, dy: 18, anchor: 'end' },
  universytet: { dx: -9, dy: -15, anchor: 'end' },
  arsenalna: { dx: 0, dy: 18, anchor: 'middle' },
  dnipro: { dx: 0, dy: 18, anchor: 'middle' },
  pochaina: { dx: -14, dy: 4, anchor: 'end' },
  livoberezhna: { dx: 0, dy: 18, anchor: 'middle' },
  demiivska: { dx: -14, dy: 4, anchor: 'end' },
  vydubychi: { dx: 13, dy: 17, anchor: 'start' },
}

const MAJOR_STATIONS = new Set([
  'vokzalna',
  'universytet',
  'arsenalna',
  'dnipro',
  'pochaina',
  'livoberezhna',
  'demiivska',
  'vydubychi',
])

const OVERVIEW_LANDMARKS = new Set([
  'vokzalna',
  'pochaina',
  'dnipro',
  'vydubychi',
])

const terminalIds = new Set(
  Object.values(lines).flatMap((line) => [line.stationIds[0], line.stationIds.at(-1)!]),
)

const TRANSFER_HUBS: Array<{
  ids: [string, string]
  placement: LabelPlacement
}> = [
  {
    ids: ['teatralna', 'zoloti-vorota'],
    placement: { dx: -25, dy: -26, anchor: 'end' },
  },
  {
    ids: ['khreshchatyk', 'maidan-nezalezhnosti'],
    placement: { dx: 24, dy: -25, anchor: 'start' },
  },
  {
    ids: ['ploshcha-ukrainskykh-heroiv', 'palats-sportu'],
    placement: { dx: -25, dy: 35, anchor: 'end' },
  },
]

const labelPosition = (station: Station): LabelPlacement => {
  const overridden = LABEL_OVERRIDES[station.id]
  if (overridden) return overridden

  const index = lines[station.line].stationIds.indexOf(station.id)

  if (station.line === 'M1') {
    return index % 2 === 0
      ? { dx: 0, dy: 18, anchor: 'middle' }
      : { dx: 0, dy: -14, anchor: 'middle' }
  }

  if (station.line === 'M2') {
    return { dx: -13, dy: 4, anchor: 'end' }
  }

  return index % 2 === 0
    ? { dx: 12, dy: -10, anchor: 'start' }
    : { dx: 12, dy: 18, anchor: 'start' }
}

const constrainAxis = (value: number, size: number, boundsStart: number, boundsSize: number) => {
  const overscroll = Math.min(50, size * 0.075)
  const minimum = boundsStart - overscroll
  const maximum = boundsStart + boundsSize - size + overscroll
  if (minimum > maximum) return boundsStart + (boundsSize - size) / 2
  return Math.min(maximum, Math.max(minimum, value))
}

export const clampView = (candidate: MapView): MapView => {
  const width = Math.min(MAX_VIEW_WIDTH, Math.max(MIN_VIEW_WIDTH, candidate.width))
  const height = width / MAP_ASPECT
  return {
    x: constrainAxis(candidate.x, width, MAP_BOUNDS.x, MAP_BOUNDS.width),
    y: constrainAxis(candidate.y, height, MAP_BOUNDS.y, MAP_BOUNDS.height),
    width,
    height,
  }
}

export const distance = (first: Point, second: Point) => (
  Math.hypot(first.x - second.x, first.y - second.y)
)

export const midpoint = (first: Point, second: Point): Point => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
})

export const roundedPath = (points: Point[], radius = 16) => {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const next = points[index + 1]
    const incoming = distance(previous, current)
    const outgoing = distance(current, next)
    const corner = Math.min(radius, incoming / 2, outgoing / 2)
    const before = {
      x: current.x + ((previous.x - current.x) / incoming) * corner,
      y: current.y + ((previous.y - current.y) / incoming) * corner,
    }
    const after = {
      x: current.x + ((next.x - current.x) / outgoing) * corner,
      y: current.y + ((next.y - current.y) / outgoing) * corner,
    }
    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`
  }

  const last = points.at(-1)!
  return `${path} L ${last.x} ${last.y}`
}

export const viewForStations = (stationIds: string[], padding = 105): MapView | null => {
  const selected = stationIds.map((id) => stationById.get(id)).filter(Boolean) as Station[]
  if (selected.length === 0) return null

  const minX = Math.min(...selected.map((station) => station.mapX))
  const maxX = Math.max(...selected.map((station) => station.mapX))
  const minY = Math.min(...selected.map((station) => station.mapY))
  const maxY = Math.max(...selected.map((station) => station.mapY))
  const contentWidth = Math.max(150, maxX - minX + padding * 2)
  const contentHeight = Math.max(150, maxY - minY + padding * 2)
  const width = Math.max(contentWidth, contentHeight * MAP_ASPECT)
  const height = width / MAP_ASPECT

  return clampView({
    x: (minX + maxX) / 2 - width / 2,
    y: (minY + maxY) / 2 - height / 2,
    width,
    height,
  })
}

const wrapLabel = (text: string, maxChars: number) => {
  if (text.length <= maxChars || !text.includes(' ')) return [text]

  const words = text.split(' ')
  let best: [string, string] | null = null
  let bestDifference = Infinity

  for (let splitAt = 1; splitAt < words.length; splitAt += 1) {
    const first = words.slice(0, splitAt).join(' ')
    const second = words.slice(splitAt).join(' ')
    const longest = Math.max(first.length, second.length)
    const difference = Math.abs(first.length - second.length)

    if (longest <= maxChars + 5 && difference < bestDifference) {
      best = [first, second]
      bestDifference = difference
    }
  }

  return best ?? [text]
}

const shouldShowStationLabel = ({
  station,
  activeStationId,
  routeSet,
  routeEndpoints,
  focusedLine,
  zoomLevel,
  isOverview,
}: {
  station: Station
  activeStationId?: string
  routeSet: Set<string>
  routeEndpoints: Set<string>
  focusedLine: LineId | 'all'
  zoomLevel: number
  isOverview: boolean
}) => {
  const active = activeStationId === station.id
  const endpoint = routeEndpoints.has(station.id)
  const onRoute = routeSet.has(station.id)
  const terminal = terminalIds.has(station.id)
  const transfer = Boolean(station.transferTo)
  const major = MAJOR_STATIONS.has(station.id)
  const index = lines[station.line].stationIds.indexOf(station.id)

  if (active || endpoint) return true

  if (isOverview) {
    return terminal || OVERVIEW_LANDMARKS.has(station.id)
  }

  if (focusedLine !== 'all') {
    if (station.line !== focusedLine) return onRoute && zoomLevel >= 1.55
    if (zoomLevel < 1.28) return terminal || transfer || major || index % 3 === 0
    if (zoomLevel < 1.62) return terminal || transfer || major || index % 2 === 0
    return true
  }

  if (zoomLevel < 1.38) return terminal || transfer || major || onRoute
  if (zoomLevel < 1.68) return terminal || transfer || major || onRoute || index % 3 === 0
  if (zoomLevel < 1.92) return terminal || transfer || major || onRoute || index % 2 === 0
  return true
}

export interface LabelLayoutInput {
  activeStationId?: string
  routeSet: Set<string>
  routeEndpoints: Set<string>
  focusedLine: LineId | 'all'
  zoomLevel: number
  view: MapView
  canvasSize: CanvasSize
  stationName: (station: Station) => string
}

export interface LabelLayoutResult {
  placedLabels: PlacedLabel[]
  renderScale: number
  mapPixels: (pixels: number) => number
  compactCanvas: boolean
  isOverview: boolean
  labelFontPx: number
  labelLineHeightPx: number
  labelStrokePx: number
}

export const buildLabelLayout = (input: LabelLayoutInput): LabelLayoutResult => {
  const {
    activeStationId,
    routeSet,
    routeEndpoints,
    focusedLine,
    zoomLevel,
    view,
    canvasSize,
    stationName,
  } = input

  const renderScale = Math.max(
    0.1,
    Math.min(canvasSize.width / view.width, canvasSize.height / view.height),
  )
  const mapPixels = (pixels: number) => pixels / renderScale
  const compactCanvas = canvasSize.width < 620
  const isOverview = focusedLine === 'all' && zoomLevel < 1.16
  const labelFontPx = compactCanvas ? (isOverview ? 10.4 : 11.2) : 12
  const labelLineHeightPx = labelFontPx * 1.16
  const labelStrokePx = isOverview ? 3 : 3.5
  const placedLabels: PlacedLabel[] = []

  const placeLabel = (candidate: LabelCandidate, placement: LabelPlacement) => {
    const sideLabel = Math.abs(placement.dx) > 4 && Math.abs(placement.dy) <= 8
    const lineOffset = placement.dy < 0
      ? (candidate.lines.length - 1) * labelLineHeightPx
      : sideLabel
        ? ((candidate.lines.length - 1) * labelLineHeightPx) / 2
        : 0
    const x = candidate.baseX + mapPixels(placement.dx)
    const y = candidate.baseY + mapPixels(placement.dy - lineOffset)
    const screenX = (candidate.baseX - view.x) * renderScale + placement.dx
    const screenY = (candidate.baseY - view.y) * renderScale + placement.dy - lineOffset
    const longestLine = Math.max(...candidate.lines.map((line) => Array.from(line).length))
    const width = longestLine * labelFontPx * 0.59 + 10
    const height = candidate.lines.length * labelLineHeightPx + 5
    const left = placement.anchor === 'start'
      ? screenX - 3
      : placement.anchor === 'end'
        ? screenX - width + 3
        : screenX - width / 2
    const top = screenY - labelFontPx * 0.9 - 2

    placedLabels.push({
      ...candidate,
      placement,
      x,
      y,
      rect: {
        left,
        top,
        right: left + width,
        bottom: top + height,
      },
    })
  }

  stations.forEach((station) => {
    if (!shouldShowStationLabel({
      station,
      activeStationId,
      routeSet,
      routeEndpoints,
      focusedLine,
      zoomLevel,
      isOverview,
    })) return

    const active = activeStationId === station.id
    const endpoint = routeEndpoints.has(station.id)
    const onRoute = routeSet.has(station.id)
    const terminal = terminalIds.has(station.id)
    const placement = labelPosition(station)
    const maxChars = compactCanvas
      ? (terminal || isOverview ? 17 : 20)
      : 24
    const linesForLabel = wrapLabel(stationName(station), maxChars)

    placeLabel({
      key: `station-${station.id}`,
      baseX: station.mapX,
      baseY: station.mapY,
      lines: linesForLabel,
      priority: active ? 1000 : endpoint ? 950 : onRoute ? 900 : terminal ? 800 : 500,
      placements: [placement],
      className: [
        'station-label',
        isOverview ? 'overview-label' : '',
        active ? 'is-active-label' : '',
        onRoute ? 'is-route-label' : '',
      ].filter(Boolean).join(' '),
      plate: active || endpoint,
    }, placement)
  })

  if (isOverview) {
    TRANSFER_HUBS.forEach(({ ids, placement }) => {
      if (
        ids.some((id) => id === activeStationId || routeEndpoints.has(id))
      ) return

      const first = stationById.get(ids[0])!
      const second = stationById.get(ids[1])!
      const center = midpoint(
        { x: first.mapX, y: first.mapY },
        { x: second.mapX, y: second.mapY },
      )
      const firstLines = wrapLabel(stationName(first), compactCanvas ? 18 : 23)
      const secondLines = wrapLabel(stationName(second), compactCanvas ? 18 : 23)

      placeLabel({
        key: `hub-${ids.join('-')}`,
        baseX: center.x,
        baseY: center.y,
        lines: [...firstLines, ...secondLines],
        priority: 850,
        placements: [placement],
        className: 'station-label transfer-hub-label overview-label',
      }, placement)
    })
  }

  return {
    placedLabels,
    renderScale,
    mapPixels,
    compactCanvas,
    isOverview,
    labelFontPx,
    labelLineHeightPx,
    labelStrokePx,
  }
}
