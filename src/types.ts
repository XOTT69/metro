export type LineId = 'M1' | 'M2' | 'M3'

export type ThemeMode = 'system' | 'light' | 'dark'

export interface Station {
  id: string
  code: string
  name: string
  nameEn: string
  line: LineId
  order: number
  lat: number
  lng: number
  mapX: number
  mapY: number
  transferTo?: string[]
  accessible?: boolean
}

export interface MetroLine {
  id: LineId
  name: string
  nameEn: string
  color: string
  terminalStart: string
  terminalEnd: string
  stationIds: string[]
  segmentMinutes: number[]
}

export interface RouteStep {
  type: 'ride' | 'transfer'
  line?: LineId
  from: string
  to: string
  stationIds: string[]
  minutes: number
}

export interface RoutePlan {
  from: Station
  to: Station
  stationIds: string[]
  steps: RouteStep[]
  totalMinutes: number
  stationCount: number
  transferCount: number
}
