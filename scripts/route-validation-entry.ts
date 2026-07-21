import { lines, stationById, stations, transferPairs } from '../src/data/metro'
import { planRoute } from '../src/lib/metro'
import { getHeadwayEstimate, getUpcomingTrainSeconds } from '../src/lib/service'

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message)
}

assert(stations.length === 52, `Expected 52 stations, found ${stations.length}`)
assert(new Set(stations.map((station) => station.id)).size === stations.length, 'Station IDs must be unique')
assert(new Set(stations.map((station) => station.code)).size === stations.length, 'Station codes must be unique')

Object.values(lines).forEach((line) => {
  assert(line.stationIds.length >= 2, `${line.id} must contain stations`)
  assert(line.segmentMinutes.length === line.stationIds.length - 1, `${line.id} segment count is invalid`)
  line.stationIds.forEach((stationId, index) => {
    const station = stationById.get(stationId)
    assert(station, `${line.id} references missing station ${stationId}`)
    assert(station.line === line.id, `${stationId} belongs to the wrong line`)
    assert(station.order === index, `${stationId} has invalid order`)
  })
})

transferPairs.forEach(([from, to]) => {
  const first = stationById.get(from)
  const second = stationById.get(to)
  assert(first && second, `Transfer ${from} → ${to} references a missing station`)
  assert(first.transferTo?.includes(to), `Transfer ${from} → ${to} is not declared on ${from}`)
  assert(second.transferTo?.includes(from), `Transfer ${from} → ${to} is not declared on ${to}`)
})

let checkedRoutes = 0
for (const from of stations) {
  for (const to of stations) {
    if (from.id === to.id) continue
    for (const preference of ['fastest', 'fewest-transfers'] as const) {
      const route = planRoute(from.id, to.id, preference)
      assert(route, `No ${preference} route from ${from.id} to ${to.id}`)
      assert(route.stationIds[0] === from.id, `Route starts at wrong station: ${from.id} → ${to.id}`)
      assert(route.stationIds.at(-1) === to.id, `Route ends at wrong station: ${from.id} → ${to.id}`)
      assert(route.totalMinutes > 0, `Route time must be positive: ${from.id} → ${to.id}`)
      checkedRoutes += 1
    }
  }
}

const sampleStation = stationById.get('vokzalna')!
const peakDate = new Date('2026-07-20T08:00:00+03:00')
const offPeakDate = new Date('2026-07-20T13:00:00+03:00')
const weekendDate = new Date('2026-07-19T13:00:00+03:00')
assert(getHeadwayEstimate('M1', peakDate)?.minMinutes === 2.5, 'Peak headway profile is invalid')
assert(getHeadwayEstimate('M1', offPeakDate)?.minMinutes === 5, 'Off-peak headway profile is invalid')
assert(getHeadwayEstimate('M1', weekendDate)?.minMinutes === 6, 'Weekend headway profile is invalid')
const arrivals = getUpcomingTrainSeconds(sampleStation, true, 2, peakDate)
assert(arrivals[0] !== null && arrivals[1] !== null, 'Train countdown must be available during service')
assert(arrivals[0] >= 0 && arrivals[1] > arrivals[0], 'Upcoming train countdown order is invalid')

console.log(`Validated ${stations.length} stations and ${checkedRoutes} route variants.`)
