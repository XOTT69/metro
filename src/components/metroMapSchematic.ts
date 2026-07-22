import { lines, stationById } from '../data/metro'
import type { LineId, Station } from '../types'

export interface MapPoint {
  x: number
  y: number
}

export interface LabelPlacement {
  dx: number
  dy: number
  anchor: 'start' | 'middle' | 'end'
}

export const MAP_BOUNDS = {
  x: 0,
  y: 0,
  width: 930,
  height: 1260,
}

export const SCHEMATIC_POINTS: Record<string, MapPoint> = {
  akademmistechko: { x: 70, y: 300 },
  zhytomyrska: { x: 115, y: 345 },
  sviatoshyn: { x: 160, y: 390 },
  nyvky: { x: 205, y: 435 },
  beresteiska: { x: 250, y: 480 },
  shuliavska: { x: 295, y: 525 },
  'politekhnichnyi-instytut': { x: 340, y: 570 },
  vokzalna: { x: 395, y: 610 },
  universytet: { x: 450, y: 610 },
  teatralna: { x: 505, y: 610 },
  khreshchatyk: { x: 560, y: 610 },
  arsenalna: { x: 610, y: 650 },
  dnipro: { x: 660, y: 690 },
  hidropark: { x: 705, y: 690 },
  livoberezhna: { x: 745, y: 670 },
  darnytsia: { x: 785, y: 635 },
  chernihivska: { x: 820, y: 600 },
  lisova: { x: 850, y: 565 },

  'heroiv-dnipra': { x: 560, y: 70 },
  minska: { x: 560, y: 120 },
  obolon: { x: 560, y: 170 },
  pochaina: { x: 560, y: 220 },
  'tarasa-shevchenka': { x: 560, y: 270 },
  'kontraktova-ploshcha': { x: 560, y: 320 },
  'poshtova-ploshcha': { x: 560, y: 370 },
  'maidan-nezalezhnosti': { x: 560, y: 560 },
  'ploshcha-ukrainskykh-heroiv': { x: 520, y: 760 },
  olimpiiska: { x: 520, y: 820 },
  'palats-ukraina': { x: 520, y: 880 },
  lybidska: { x: 520, y: 940 },
  demiivska: { x: 505, y: 1000 },
  holosiivska: { x: 480, y: 1050 },
  vasylkivska: { x: 445, y: 1100 },
  'vystavkovyi-tsentr': { x: 405, y: 1140 },
  ipodrom: { x: 360, y: 1170 },
  teremky: { x: 315, y: 1170 },

  syrets: { x: 220, y: 330 },
  dorohozhychi: { x: 260, y: 370 },
  lukianivska: { x: 300, y: 410 },
  'zoloti-vorota': { x: 495, y: 660 },
  'palats-sportu': { x: 560, y: 760 },
  klovska: { x: 605, y: 805 },
  pecherska: { x: 645, y: 850 },
  zvirynetska: { x: 685, y: 895 },
  vydubychi: { x: 725, y: 940 },
  slavutych: { x: 765, y: 985 },
  osokorky: { x: 800, y: 1030 },
  pozniaky: { x: 830, y: 1065 },
  kharkivska: { x: 860, y: 1065 },
  vyrlytsia: { x: 885, y: 1030 },
  boryspilska: { x: 890, y: 985 },
  'chervonyi-khutir': { x: 890, y: 935 },
}

const LABEL_PLACEMENTS: Record<string, LabelPlacement> = {
  akademmistechko: { dx: 14, dy: -12, anchor: 'start' },
  zhytomyrska: { dx: 14, dy: -12, anchor: 'start' },
  sviatoshyn: { dx: 14, dy: -12, anchor: 'start' },
  nyvky: { dx: 14, dy: -12, anchor: 'start' },
  beresteiska: { dx: 14, dy: -12, anchor: 'start' },
  shuliavska: { dx: 14, dy: -12, anchor: 'start' },
  'politekhnichnyi-instytut': { dx: -18, dy: -18, anchor: 'end' },
  vokzalna: { dx: -14, dy: -17, anchor: 'end' },
  universytet: { dx: 0, dy: 27, anchor: 'middle' },
  teatralna: { dx: -22, dy: -24, anchor: 'end' },
  khreshchatyk: { dx: 28, dy: -18, anchor: 'start' },
  arsenalna: { dx: 12, dy: -18, anchor: 'start' },
  dnipro: { dx: 0, dy: 28, anchor: 'middle' },
  hidropark: { dx: 0, dy: -18, anchor: 'middle' },
  livoberezhna: { dx: 0, dy: 28, anchor: 'middle' },
  darnytsia: { dx: -8, dy: -18, anchor: 'end' },
  chernihivska: { dx: 8, dy: 25, anchor: 'start' },
  lisova: { dx: -12, dy: -14, anchor: 'end' },

  'heroiv-dnipra': { dx: -16, dy: 5, anchor: 'end' },
  minska: { dx: -16, dy: 5, anchor: 'end' },
  obolon: { dx: -16, dy: 5, anchor: 'end' },
  pochaina: { dx: -16, dy: 5, anchor: 'end' },
  'tarasa-shevchenka': { dx: -16, dy: 4, anchor: 'end' },
  'kontraktova-ploshcha': { dx: -16, dy: 4, anchor: 'end' },
  'poshtova-ploshcha': { dx: -16, dy: 4, anchor: 'end' },
  'maidan-nezalezhnosti': { dx: 27, dy: -18, anchor: 'start' },
  'ploshcha-ukrainskykh-heroiv': { dx: -20, dy: 5, anchor: 'end' },
  olimpiiska: { dx: -16, dy: 5, anchor: 'end' },
  'palats-ukraina': { dx: -16, dy: 5, anchor: 'end' },
  lybidska: { dx: -16, dy: 5, anchor: 'end' },
  demiivska: { dx: -16, dy: 5, anchor: 'end' },
  holosiivska: { dx: -16, dy: 5, anchor: 'end' },
  vasylkivska: { dx: -14, dy: -13, anchor: 'end' },
  'vystavkovyi-tsentr': { dx: 0, dy: -19, anchor: 'middle' },
  ipodrom: { dx: 12, dy: -19, anchor: 'start' },
  teremky: { dx: -12, dy: -19, anchor: 'end' },

  syrets: { dx: 14, dy: -11, anchor: 'start' },
  dorohozhychi: { dx: 14, dy: -11, anchor: 'start' },
  lukianivska: { dx: 14, dy: -11, anchor: 'start' },
  'zoloti-vorota': { dx: -22, dy: 25, anchor: 'end' },
  'palats-sportu': { dx: 22, dy: -18, anchor: 'start' },
  klovska: { dx: 15, dy: -12, anchor: 'start' },
  pecherska: { dx: 15, dy: -12, anchor: 'start' },
  zvirynetska: { dx: 15, dy: 19, anchor: 'start' },
  vydubychi: { dx: 15, dy: 19, anchor: 'start' },
  slavutych: { dx: -14, dy: 19, anchor: 'end' },
  osokorky: { dx: -14, dy: 19, anchor: 'end' },
  pozniaky: { dx: -12, dy: 22, anchor: 'end' },
  kharkivska: { dx: -12, dy: 40, anchor: 'end' },
  vyrlytsia: { dx: -14, dy: -12, anchor: 'end' },
  boryspilska: { dx: -14, dy: -12, anchor: 'end' },
  'chervonyi-khutir': { dx: -14, dy: -12, anchor: 'end' },
}

export const pointForStation = (stationOrId: Station | string): MapPoint => {
  const station = typeof stationOrId === 'string' ? stationById.get(stationOrId) : stationOrId
  if (!station) return { x: MAP_BOUNDS.width / 2, y: MAP_BOUNDS.height / 2 }
  return SCHEMATIC_POINTS[station.id] ?? { x: station.mapX, y: station.mapY }
}

export const placementForStation = (station: Station): LabelPlacement => {
  const manual = LABEL_PLACEMENTS[station.id]
  if (manual) return manual
  if (station.line === 'M1') return { dx: 0, dy: station.order % 2 === 0 ? 26 : -18, anchor: 'middle' }
  if (station.line === 'M2') return { dx: -16, dy: 5, anchor: 'end' }
  return { dx: 15, dy: station.order % 2 === 0 ? -12 : 19, anchor: 'start' }
}

export const pointsForLine = (lineId: LineId) => lines[lineId].stationIds.map(pointForStation)

const distance = (first: MapPoint, second: MapPoint) => Math.hypot(second.x - first.x, second.y - first.y)

export const roundedPath = (points: MapPoint[], radius = 18) => {
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

export const RIVER_PATH = 'M 690 -40 C 660 180 715 350 680 560 C 650 760 710 980 675 1340'

export const LINE_BADGES: Array<{ line: LineId; stationId: string; dx: number; dy: number }> = [
  { line: 'M1', stationId: 'akademmistechko', dx: -25, dy: -26 },
  { line: 'M1', stationId: 'lisova', dx: 24, dy: -24 },
  { line: 'M2', stationId: 'heroiv-dnipra', dx: 0, dy: -30 },
  { line: 'M2', stationId: 'teremky', dx: -28, dy: 0 },
  { line: 'M3', stationId: 'syrets', dx: -25, dy: -24 },
  { line: 'M3', stationId: 'chervonyi-khutir', dx: 0, dy: -30 },
]
