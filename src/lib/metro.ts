import { lines, stationById, stations, transferPairs } from '../data/metro'
import type { LineId, RoutePlan, RoutePreference, RouteStep, Station } from '../types'

interface Edge {
  to: string
  minutes: number
  type: 'ride' | 'transfer'
  line?: LineId
}

const graph = new Map<string, Edge[]>()

const addEdge = (from: string, edge: Edge) => {
  const current = graph.get(from) ?? []
  current.push(edge)
  graph.set(from, current)
}

Object.values(lines).forEach((line) => {
  line.stationIds.forEach((stationId, index) => {
    const next = line.stationIds[index + 1]
    if (!next) return
    const minutes = line.segmentMinutes[index] ?? 2.4
    addEdge(stationId, { to: next, minutes, type: 'ride', line: line.id })
    addEdge(next, { to: stationId, minutes, type: 'ride', line: line.id })
  })
})

transferPairs.forEach(([a, b]) => {
  addEdge(a, { to: b, minutes: 4, type: 'transfer' })
  addEdge(b, { to: a, minutes: 4, type: 'transfer' })
})

export const getSavedRoutePreference = (): RoutePreference => {
  if (typeof window === 'undefined') return 'fastest'
  try {
    const stored = JSON.parse(window.localStorage.getItem('metro-route-preference') ?? 'null')
    return stored === 'fewest-transfers' ? 'fewest-transfers' : 'fastest'
  } catch {
    return 'fastest'
  }
}

const getOptimizationCost = (edge: Edge, preference: RoutePreference) => {
  if (preference === 'fewest-transfers' && edge.type === 'transfer') return edge.minutes + 60
  return edge.minutes
}

export const planRoute = (
  fromId: string,
  toId: string,
  preference: RoutePreference = getSavedRoutePreference(),
): RoutePlan | null => {
  const from = stationById.get(fromId)
  const to = stationById.get(toId)
  if (!from || !to || fromId === toId) return null

  const costs = new Map<string, number>(stations.map((station) => [station.id, Number.POSITIVE_INFINITY]))
  const actualMinutes = new Map<string, number>(stations.map((station) => [station.id, Number.POSITIVE_INFINITY]))
  const previous = new Map<string, { stationId: string; edge: Edge }>()
  const unvisited = new Set(stations.map((station) => station.id))
  costs.set(fromId, 0)
  actualMinutes.set(fromId, 0)

  while (unvisited.size > 0) {
    let currentId: string | null = null
    let currentCost = Number.POSITIVE_INFINITY

    unvisited.forEach((stationId) => {
      const cost = costs.get(stationId) ?? Number.POSITIVE_INFINITY
      if (cost < currentCost) {
        currentCost = cost
        currentId = stationId
      }
    })

    if (!currentId || currentCost === Number.POSITIVE_INFINITY) break
    if (currentId === toId) break
    unvisited.delete(currentId)

    for (const edge of graph.get(currentId) ?? []) {
      if (!unvisited.has(edge.to)) continue
      const alternativeCost = currentCost + getOptimizationCost(edge, preference)
      const alternativeMinutes = (actualMinutes.get(currentId) ?? 0) + edge.minutes
      const knownCost = costs.get(edge.to) ?? Number.POSITIVE_INFINITY
      const knownMinutes = actualMinutes.get(edge.to) ?? Number.POSITIVE_INFINITY

      if (alternativeCost < knownCost || (alternativeCost === knownCost && alternativeMinutes < knownMinutes)) {
        costs.set(edge.to, alternativeCost)
        actualMinutes.set(edge.to, alternativeMinutes)
        previous.set(edge.to, { stationId: currentId, edge })
      }
    }
  }

  if (!previous.has(toId)) return null

  const stationIds = [toId]
  const edges: Edge[] = []
  let cursor = toId
  while (cursor !== fromId) {
    const item = previous.get(cursor)
    if (!item) return null
    stationIds.unshift(item.stationId)
    edges.unshift(item.edge)
    cursor = item.stationId
  }

  const steps: RouteStep[] = []
  edges.forEach((edge, index) => {
    const edgeFrom = stationIds[index]
    const edgeTo = stationIds[index + 1]
    const current = steps.at(-1)

    if (edge.type === 'ride' && current?.type === 'ride' && current.line === edge.line) {
      current.to = edgeTo
      current.stationIds.push(edgeTo)
      current.minutes += edge.minutes
      return
    }

    steps.push({
      type: edge.type,
      line: edge.line,
      from: edgeFrom,
      to: edgeTo,
      stationIds: [edgeFrom, edgeTo],
      minutes: edge.minutes,
    })
  })

  const journeyMinutes = edges.reduce((total, edge) => total + edge.minutes, 0)

  return {
    from,
    to,
    stationIds,
    steps,
    totalMinutes: Math.max(1, Math.round(journeyMinutes)),
    stationCount: stationIds.length - 1 - steps.filter((step) => step.type === 'transfer').length,
    transferCount: steps.filter((step) => step.type === 'transfer').length,
    preference,
  }
}

export const getDirectionName = (lineId: LineId, fromId: string, toId: string) => {
  const line = lines[lineId]
  return line.stationIds.indexOf(toId) > line.stationIds.indexOf(fromId) ? line.terminalEnd : line.terminalStart
}

export const getHeadwayMinutes = (lineId: LineId, date = new Date()) => {
  const hour = date.getHours() + date.getMinutes() / 60
  const weekday = date.getDay() > 0 && date.getDay() < 6
  if (hour < 5.5 || hour >= 23) return 0

  const peak = weekday && ((hour >= 7 && hour < 10) || (hour >= 17 && hour < 20))
  const late = hour >= 21.5 || hour < 6.5
  const lineAdjustment = lineId === 'M3' ? 0.5 : lineId === 'M2' ? 0.2 : 0
  return Number(((peak ? 3 : late ? 7 : 4.5) + lineAdjustment).toFixed(1))
}

const hash = (value: string) => Array.from(value).reduce((total, char) => total + char.charCodeAt(0), 0)

export const getNextTrainSeconds = (station: Station, towardEnd: boolean, now = new Date()) => {
  const headway = getHeadwayMinutes(station.line, now)
  if (!headway) return null
  const cycle = Math.round(headway * 60)
  const secondsToday = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  const offset = hash(`${station.id}-${towardEnd ? 'end' : 'start'}`) % cycle
  const result = cycle - ((secondsToday + offset) % cycle)
  return result === cycle ? 0 : result
}

export const formatCountdown = (seconds: number | null) => {
  if (seconds === null) return 'рух завершено'
  if (seconds < 60) return `${Math.max(1, seconds)} с`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const radius = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const findNearestStation = (lat: number, lng: number, source: Station[] = stations) =>
  source
    .map((station) => ({ station, distance: haversineKm(lat, lng, station.lat, station.lng) }))
    .sort((a, b) => a.distance - b.distance)[0]
