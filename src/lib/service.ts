import { lines } from '../data/metro'
import type { LineId, Station } from '../types'

export type ServicePeriod = 'closed' | 'weekday-peak' | 'weekday-offpeak' | 'weekend'
export type ActiveServicePeriod = Exclude<ServicePeriod, 'closed'>

export interface HeadwayEstimate {
  period: ActiveServicePeriod
  minMinutes: number
  maxMinutes: number
  nominalMinutes: number
  sourceDate: string
  isEstimated: true
}

export const HEADWAY_SOURCE = {
  title: 'КМДА: інтервали руху поїздів Київського метрополітену',
  publishedAt: '2026-06-23',
  url: 'https://kyivcity.gov.ua/news/minulogo_tizhnya_stolichnim_metro_skoristalisya_51_milyona_pasazhiriv_iz_yakikh_ponad_13_milyona__pilgoviki_1047585/',
} as const

const SERVICE_START_MINUTE = 5 * 60 + 30
const SERVICE_END_MINUTE = 23 * 60
const MORNING_PEAK_START = 7 * 60
const MORNING_PEAK_END = 10 * 60
const EVENING_PEAK_START = 17 * 60
const EVENING_PEAK_END = 20 * 60

const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
const isWeekday = (date: Date) => date.getDay() >= 1 && date.getDay() <= 5

export const getServicePeriod = (date = new Date()): ServicePeriod => {
  const minute = minuteOfDay(date)
  if (minute < SERVICE_START_MINUTE || minute >= SERVICE_END_MINUTE) return 'closed'
  if (!isWeekday(date)) return 'weekend'
  if ((minute >= MORNING_PEAK_START && minute < MORNING_PEAK_END)
    || (minute >= EVENING_PEAK_START && minute < EVENING_PEAK_END)) return 'weekday-peak'
  return 'weekday-offpeak'
}

export const getHeadwayEstimate = (_lineId: LineId, date = new Date()): HeadwayEstimate | null => {
  const period = getServicePeriod(date)
  if (period === 'closed') return null

  const [minMinutes, maxMinutes] = period === 'weekday-peak'
    ? [2.5, 3.5]
    : period === 'weekday-offpeak'
      ? [5, 6]
      : [6, 7]

  return {
    period,
    minMinutes,
    maxMinutes,
    nominalMinutes: (minMinutes + maxMinutes) / 2,
    sourceDate: HEADWAY_SOURCE.publishedAt,
    isEstimated: true,
  }
}

export const formatHeadwayRange = (estimate: HeadwayEstimate | null, language: 'uk' | 'en' = 'uk') => {
  if (!estimate) return language === 'uk' ? 'рух завершено' : 'service ended'
  const format = (value: number) => {
    const minutes = Math.floor(value)
    const seconds = Math.round((value - minutes) * 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  return `${format(estimate.minMinutes)}–${format(estimate.maxMinutes)} ${language === 'uk' ? 'хв' : 'min'}`
}

const periodAnchorSeconds = (period: ActiveServicePeriod) => {
  if (period === 'weekday-peak') return 0
  return SERVICE_START_MINUTE * 60
}

const linePhaseSeconds: Record<LineId, number> = { M1: 0, M2: 37, M3: 71 }

const travelSecondsFromTerminal = (station: Station, towardEnd: boolean) => {
  const line = lines[station.line]
  const index = line.stationIds.indexOf(station.id)
  if (index < 0) return 0
  const segmentMinutes = towardEnd
    ? line.segmentMinutes.slice(0, index)
    : line.segmentMinutes.slice(index)
  return Math.round(segmentMinutes.reduce((total, minutes) => total + minutes, 0) * 60)
}

const anchorForCurrentPeriod = (date: Date, period: ActiveServicePeriod) => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  if (period === 'weekday-peak') {
    const minute = minuteOfDay(date)
    const peakStart = minute >= EVENING_PEAK_START ? EVENING_PEAK_START : MORNING_PEAK_START
    start.setMinutes(peakStart)
    return start.getTime()
  }

  if (period === 'weekday-offpeak') {
    const minute = minuteOfDay(date)
    const offPeakStart = minute >= EVENING_PEAK_END
      ? EVENING_PEAK_END
      : minute >= MORNING_PEAK_END
        ? MORNING_PEAK_END
        : SERVICE_START_MINUTE
    start.setMinutes(offPeakStart)
    return start.getTime()
  }

  start.setMinutes(periodAnchorSeconds(period) / 60)
  return start.getTime()
}

export const getNextTrainSeconds = (
  station: Station,
  towardEnd: boolean,
  now = new Date(),
  ordinal = 0,
): number | null => {
  const estimate = getHeadwayEstimate(station.line, now)
  if (!estimate) return null

  const cycleSeconds = Math.round(estimate.nominalMinutes * 60)
  const periodStart = anchorForCurrentPeriod(now, estimate.period)
  const directionPhase = towardEnd ? 0 : Math.round(cycleSeconds * 0.42)
  const firstArrival = periodStart
    + (linePhaseSeconds[station.line] + directionPhase + travelSecondsFromTerminal(station, towardEnd)) * 1000
  const elapsed = now.getTime() - firstArrival
  const cyclesElapsed = elapsed <= 0 ? 0 : Math.ceil(elapsed / (cycleSeconds * 1000))
  const arrival = firstArrival + (cyclesElapsed + Math.max(0, ordinal)) * cycleSeconds * 1000
  return Math.max(0, Math.ceil((arrival - now.getTime()) / 1000))
}

export const getUpcomingTrainSeconds = (
  station: Station,
  towardEnd: boolean,
  count = 2,
  now = new Date(),
) => Array.from({ length: count }, (_, index) => getNextTrainSeconds(station, towardEnd, now, index))
