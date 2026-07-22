import { useEffect, useState } from 'react'
import { lines, stationById } from '../data/metro'
import type { LineId, Station } from '../types'

const API_ROOT = 'https://gisserver.kyivcity.gov.ua/mayno/rest/services/KYIV_API/transport_public/MapServer'
const INTERVALS_ENDPOINT = `${API_ROOT}/14/query?where=1%3D1&outFields=*&returnGeometry=false&f=json`
const TRAINS_ENDPOINT = `${API_ROOT}/13/query?where=1%3D1&outFields=*&returnGeometry=false&f=json`
const HOURS_ENDPOINT = `${API_ROOT}/12/query?where=1%3D1&outFields=*&returnGeometry=false&f=json`

interface ArcFeature<T> { attributes?: T }
interface ArcResponse<T> { features?: Array<ArcFeature<T>>; error?: { message?: string } }

interface IntervalAttributes {
  line?: string
  timeperiod?: string
  st_weekday?: string
  rv_weekday?: string
  st_holiday?: string
  rv_holiday?: string
}

interface TrainAttributes {
  code1?: string
  name?: string
  line?: string
  napryamok?: string
  first_trn1?: string
  first_trn2?: string
  last_trn1?: string
  last_trn2?: string
}

interface HoursAttributes {
  code1?: string
  name?: string
  line?: string
  halls_cnt?: number
  halls_open?: number
  open_max?: string
  close_min?: string
}

export interface OfficialInterval {
  line: LineId
  startSeconds: number
  endSeconds: number
  towardEndWeekday: number | null
  towardStartWeekday: number | null
  towardEndHoliday: number | null
  towardStartHoliday: number | null
  sourcePeriod: string
}

export interface DirectionTimes {
  first: string[]
  last: string[]
}

export interface OfficialStationSchedule {
  open?: string
  close?: string
  halls?: number
  hallsOpen?: number
  towardStart: DirectionTimes
  towardEnd: DirectionTimes
}

export interface OfficialScheduleData {
  intervals: OfficialInterval[]
  stations: Record<string, OfficialStationSchedule>
  loadedAt: number
}

export type OfficialScheduleState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: OfficialScheduleData; error: null }
  | { status: 'error'; data: null; error: Error }

const emptyDirection = (): DirectionTimes => ({ first: [], last: [] })
const emptyStationSchedule = (): OfficialStationSchedule => ({ towardStart: emptyDirection(), towardEnd: emptyDirection() })

const normalize = (value = '') => value
  .toLowerCase()
  .replace(/[’'«»".]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const lineFromOfficial = (value = ''): LineId | null => {
  const normalized = normalize(value)
  if (normalized.includes('святошин') || normalized.includes('бровар') || normalized === 'm1') return 'M1'
  if (normalized.includes('оболон') || normalized.includes('теремк') || normalized === 'm2') return 'M2'
  if (normalized.includes('сирець') || normalized.includes('печер') || normalized === 'm3') return 'M3'
  return null
}

const parseClockParts = (value?: string) => {
  if (!value) return null
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] ?? 0)
  if (![hours, minutes, seconds].every(Number.isFinite) || minutes > 59 || seconds > 59) return null
  return { hours, minutes, seconds }
}

export const parseClockSeconds = (value?: string) => {
  const parts = parseClockParts(value)
  return parts ? parts.hours * 3600 + parts.minutes * 60 + parts.seconds : null
}

const parseDurationSeconds = (value?: string) => {
  if (!value) return null
  const cleaned = value.trim().replace(',', '.').replace(/\s*(хв|мин|min)\.?\s*$/i, '')
  const clock = parseClockParts(cleaned)
  if (clock) return clock.hours * 3600 + clock.minutes * 60 + clock.seconds
  const decimal = Number(cleaned)
  return Number.isFinite(decimal) && decimal > 0 ? Math.round(decimal * 60) : null
}

const parsePeriod = (value?: string) => {
  if (!value) return null
  const [rawStart, rawEnd] = value.split(/\s*[–—-]\s*/)
  const start = parseClockSeconds(rawStart)
  const end = parseClockSeconds(rawEnd)
  if (start === null || end === null) return null
  return { start, end: end <= start ? end + 86400 : end }
}

const cleanTimes = (...values: Array<string | undefined>) => [...new Set(values
  .map((value) => value?.trim())
  .filter((value): value is string => Boolean(value && parseClockParts(value))))]
  .sort((a, b) => (parseClockSeconds(a) ?? 0) - (parseClockSeconds(b) ?? 0))

const findStationId = (name?: string, code?: string) => {
  if (code) {
    const byCode = [...stationById.values()].find((station) => normalize(station.code) === normalize(code))
    if (byCode) return byCode.id
  }
  if (!name) return null
  const normalized = normalize(name)
  return [...stationById.values()].find((station) => normalize(station.name) === normalized)?.id ?? null
}

const mergeDirection = (target: DirectionTimes, first: string[], last: string[]) => {
  target.first = [...new Set([...target.first, ...first])].sort((a, b) => (parseClockSeconds(a) ?? 0) - (parseClockSeconds(b) ?? 0))
  target.last = [...new Set([...target.last, ...last])].sort((a, b) => (parseClockSeconds(a) ?? 0) - (parseClockSeconds(b) ?? 0))
}

const directionForRow = (station: Station, direction = ''): 'towardStart' | 'towardEnd' | null => {
  const normalized = normalize(direction)
  const line = lines[station.line]
  if (normalized.includes(normalize(line.terminalStart))) return 'towardStart'
  if (normalized.includes(normalize(line.terminalEnd))) return 'towardEnd'
  if (normalized.includes('прям')) return 'towardEnd'
  if (normalized.includes('зворот')) return 'towardStart'
  return null
}

const fetchLayer = async <T,>(endpoint: string, signal?: AbortSignal): Promise<T[]> => {
  const response = await fetch(endpoint, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`Official schedule API: ${response.status}`)
  const payload = await response.json() as ArcResponse<T>
  if (payload.error) throw new Error(payload.error.message || 'Official schedule API error')
  return (payload.features ?? []).map((feature) => feature.attributes).filter(Boolean) as T[]
}

let cache: OfficialScheduleData | null = null
let inFlight: Promise<OfficialScheduleData> | null = null

export const loadOfficialSchedule = async (signal?: AbortSignal): Promise<OfficialScheduleData> => {
  if (cache) return cache
  if (inFlight) return inFlight

  inFlight = Promise.all([
    fetchLayer<IntervalAttributes>(INTERVALS_ENDPOINT, signal),
    fetchLayer<TrainAttributes>(TRAINS_ENDPOINT, signal),
    fetchLayer<HoursAttributes>(HOURS_ENDPOINT, signal),
  ]).then(([intervalRows, trainRows, hoursRows]) => {
    const intervals = intervalRows.flatMap((row): OfficialInterval[] => {
      const line = lineFromOfficial(row.line)
      const period = parsePeriod(row.timeperiod)
      if (!line || !period) return []
      return [{
        line,
        startSeconds: period.start,
        endSeconds: period.end,
        towardEndWeekday: parseDurationSeconds(row.st_weekday),
        towardStartWeekday: parseDurationSeconds(row.rv_weekday),
        towardEndHoliday: parseDurationSeconds(row.st_holiday),
        towardStartHoliday: parseDurationSeconds(row.rv_holiday),
        sourcePeriod: row.timeperiod ?? '',
      }]
    })

    const stationSchedules: Record<string, OfficialStationSchedule> = {}
    for (const row of hoursRows) {
      const stationId = findStationId(row.name, row.code1)
      if (!stationId) continue
      stationSchedules[stationId] = {
        ...(stationSchedules[stationId] ?? emptyStationSchedule()),
        open: row.open_max?.trim() || stationSchedules[stationId]?.open,
        close: row.close_min?.trim() || stationSchedules[stationId]?.close,
        halls: Number.isFinite(Number(row.halls_cnt)) ? Number(row.halls_cnt) : stationSchedules[stationId]?.halls,
        hallsOpen: Number.isFinite(Number(row.halls_open)) ? Number(row.halls_open) : stationSchedules[stationId]?.hallsOpen,
      }
    }

    for (const row of trainRows) {
      const stationId = findStationId(row.name, row.code1)
      if (!stationId) continue
      const station = stationById.get(stationId)
      if (!station) continue
      const schedule = stationSchedules[stationId] ?? emptyStationSchedule()
      stationSchedules[stationId] = schedule
      const direction = directionForRow(station, row.napryamok)
      const first = cleanTimes(row.first_trn1, row.first_trn2)
      const last = cleanTimes(row.last_trn1, row.last_trn2)
      if (direction) {
        mergeDirection(schedule[direction], first, last)
      } else {
        const startIndex = lines[station.line].stationIds.indexOf(station.id)
        if (startIndex === 0) mergeDirection(schedule.towardEnd, first, last)
        else if (startIndex === lines[station.line].stationIds.length - 1) mergeDirection(schedule.towardStart, first, last)
        else {
          const target = schedule.towardEnd.first.length || schedule.towardEnd.last.length ? schedule.towardStart : schedule.towardEnd
          mergeDirection(target, first, last)
        }
      }
    }

    cache = { intervals, stations: stationSchedules, loadedAt: Date.now() }
    return cache
  }).finally(() => { inFlight = null })

  return inFlight
}

export const useOfficialSchedule = (): OfficialScheduleState => {
  const [state, setState] = useState<OfficialScheduleState>({ status: 'loading', data: null, error: null })

  useEffect(() => {
    const controller = new AbortController()
    loadOfficialSchedule(controller.signal)
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', data: null, error: error instanceof Error ? error : new Error(String(error)) })
      })
    return () => controller.abort()
  }, [])

  return state
}

const currentInterval = (data: OfficialScheduleData, line: LineId, now: Date) => {
  const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  return data.intervals.find((item) => {
    if (item.line !== line) return false
    const comparable = item.endSeconds > 86400 && seconds < item.startSeconds ? seconds + 86400 : seconds
    return comparable >= item.startSeconds && comparable < item.endSeconds
  }) ?? null
}

export const getOfficialIntervalSeconds = (
  data: OfficialScheduleData,
  line: LineId,
  towardEnd: boolean,
  now = new Date(),
) => {
  const interval = currentInterval(data, line, now)
  if (!interval) return null
  const holiday = now.getDay() === 0 || now.getDay() === 6
  if (holiday) return towardEnd ? interval.towardEndHoliday : interval.towardStartHoliday
  return towardEnd ? interval.towardEndWeekday : interval.towardStartWeekday
}

const stationTravelSeconds = (station: Station, towardEnd: boolean) => {
  const line = lines[station.line]
  const index = line.stationIds.indexOf(station.id)
  if (index < 0) return 0
  const segments = towardEnd ? line.segmentMinutes.slice(0, index) : line.segmentMinutes.slice(index)
  return Math.round(segments.reduce((sum, value) => sum + value, 0) * 60)
}

const asDateOnServiceDay = (clock: string, now: Date, nextDay = false) => {
  const parts = parseClockParts(clock)
  if (!parts) return null
  const date = new Date(now)
  date.setHours(parts.hours, parts.minutes, parts.seconds, 0)
  if (nextDay) date.setDate(date.getDate() + 1)
  return date
}

const lastDepartureDate = (times: string[], now: Date) => {
  const dates = times.map((time) => asDateOnServiceDay(time, now)).filter((date): date is Date => Boolean(date))
  return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null
}

export const getOfficialStationSchedule = (data: OfficialScheduleData, stationId: string) =>
  data.stations[stationId] ?? null

export const getOfficialDirectionTimes = (data: OfficialScheduleData, station: Station, towardEnd: boolean) => {
  const schedule = getOfficialStationSchedule(data, station.id)
  return schedule ? (towardEnd ? schedule.towardEnd : schedule.towardStart) : null
}

export const getOfficialNextTrainSeconds = (
  data: OfficialScheduleData,
  station: Station,
  towardEnd: boolean,
  now = new Date(),
  ordinal = 0,
): number | null => {
  const interval = currentInterval(data, station.line, now)
  const cycleSeconds = getOfficialIntervalSeconds(data, station.line, towardEnd, now)
  if (!interval || !cycleSeconds || cycleSeconds <= 0) return null

  const directionTimes = getOfficialDirectionTimes(data, station, towardEnd)
  const lastDeparture = directionTimes ? lastDepartureDate(directionTimes.last, now) : null
  if (lastDeparture && now.getTime() > lastDeparture.getTime()) return null

  const periodStart = new Date(now)
  periodStart.setHours(0, 0, 0, 0)
  periodStart.setSeconds(interval.startSeconds)
  if (interval.startSeconds > now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) periodStart.setDate(periodStart.getDate() - 1)

  const directionPhase = towardEnd ? 0 : Math.round(cycleSeconds * 0.47)
  const linePhase: Record<LineId, number> = { M1: 0, M2: 17, M3: 31 }
  const firstArrival = periodStart.getTime() + (linePhase[station.line] + directionPhase + stationTravelSeconds(station, towardEnd)) * 1000
  const elapsed = now.getTime() - firstArrival
  const cyclesElapsed = elapsed <= 0 ? 0 : Math.ceil(elapsed / (cycleSeconds * 1000))
  const arrival = firstArrival + (cyclesElapsed + Math.max(0, ordinal)) * cycleSeconds * 1000
  if (lastDeparture && arrival > lastDeparture.getTime()) return null
  return Math.max(0, Math.ceil((arrival - now.getTime()) / 1000))
}

export const getNextFirstTrain = (data: OfficialScheduleData, station: Station, towardEnd: boolean, now = new Date()) => {
  const times = getOfficialDirectionTimes(data, station, towardEnd)?.first ?? []
  const candidates = times
    .map((time) => ({ time, date: asDateOnServiceDay(time, now) }))
    .filter((item): item is { time: string; date: Date } => Boolean(item.date))
    .map((item) => item.date.getTime() > now.getTime() ? item : { time: item.time, date: asDateOnServiceDay(item.time, now, true)! })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  return candidates[0] ?? null
}

export const formatOfficialInterval = (seconds: number | null) => {
  if (!seconds) return '—'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export const OFFICIAL_SCHEDULE_SOURCE = {
  title: 'Відкриті дані Києва: розклад та інтервали Київського метрополітену',
  url: 'https://data.kyivcity.gov.ua/dataset/rozklad-rukhu-miskoho-elektrychnoho-ta-avtomobilnoho-transportu-dep-transport',
} as const
