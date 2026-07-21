import type { LineId } from '../types'

export type NoticeSeverity = 'info' | 'warning' | 'critical' | 'resolved'
export type ServiceState = 'normal' | 'changes' | 'disrupted' | 'unknown'
export type StatusSource = 'network' | 'cache' | 'none'

export interface MetroNotice {
  id: string
  title: string
  summary: string
  url: string
  sourceName: string
  publishedAt: string | null
  severity: NoticeSeverity
  affectedLines: LineId[]
  active: boolean
}

export interface MetroStatusSource {
  name: string
  url: string
  ok: boolean
}

export interface MetroStatusPayload {
  fetchedAt: string
  overall: ServiceState
  lineStatus: Record<LineId, ServiceState>
  notices: MetroNotice[]
  sources: MetroStatusSource[]
  partial: boolean
}

export interface MetroStatusResult {
  payload: MetroStatusPayload
  source: StatusSource
  error?: string
}

const CACHE_KEY = 'metro-service-status-cache-v1'

export const emptyMetroStatus = (): MetroStatusPayload => ({
  fetchedAt: new Date(0).toISOString(),
  overall: 'unknown',
  lineStatus: { M1: 'unknown', M2: 'unknown', M3: 'unknown' },
  notices: [],
  sources: [
    { name: 'Офіційний портал Києва', url: 'https://kyivcity.gov.ua/news/', ok: false },
    { name: 'Департамент транспортної інфраструктури КМДА', url: 'https://dti.kyivcity.gov.ua/news', ok: false },
  ],
  partial: true,
})

const isServiceState = (value: unknown): value is ServiceState =>
  value === 'normal' || value === 'changes' || value === 'disrupted' || value === 'unknown'

const isLineId = (value: unknown): value is LineId => value === 'M1' || value === 'M2' || value === 'M3'

const parsePayload = (value: unknown): MetroStatusPayload | null => {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<MetroStatusPayload>
  if (typeof candidate.fetchedAt !== 'string' || Number.isNaN(new Date(candidate.fetchedAt).getTime())) return null
  if (!isServiceState(candidate.overall)) return null
  if (!candidate.lineStatus || typeof candidate.lineStatus !== 'object') return null

  const lineStatus = candidate.lineStatus as Partial<Record<LineId, ServiceState>>
  if (!isServiceState(lineStatus.M1) || !isServiceState(lineStatus.M2) || !isServiceState(lineStatus.M3)) return null

  const notices = Array.isArray(candidate.notices)
    ? candidate.notices.flatMap((notice): MetroNotice[] => {
      if (!notice || typeof notice !== 'object') return []
      const item = notice as Partial<MetroNotice>
      if (typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.url !== 'string') return []
      const severity: NoticeSeverity = item.severity === 'critical' || item.severity === 'warning' || item.severity === 'resolved' ? item.severity : 'info'
      return [{
        id: item.id,
        title: item.title,
        summary: typeof item.summary === 'string' ? item.summary : 'Деталі доступні в офіційному повідомленні.',
        url: item.url,
        sourceName: typeof item.sourceName === 'string' ? item.sourceName : 'Офіційне джерело',
        publishedAt: typeof item.publishedAt === 'string' ? item.publishedAt : null,
        severity,
        affectedLines: Array.isArray(item.affectedLines) ? item.affectedLines.filter(isLineId) : [],
        active: Boolean(item.active),
      }]
    })
    : []

  const sources = Array.isArray(candidate.sources)
    ? candidate.sources.flatMap((source): MetroStatusSource[] => {
      if (!source || typeof source !== 'object') return []
      const item = source as Partial<MetroStatusSource>
      if (typeof item.name !== 'string' || typeof item.url !== 'string') return []
      return [{ name: item.name, url: item.url, ok: Boolean(item.ok) }]
    })
    : []

  return {
    fetchedAt: candidate.fetchedAt,
    overall: candidate.overall,
    lineStatus: { M1: lineStatus.M1, M2: lineStatus.M2, M3: lineStatus.M3 },
    notices,
    sources,
    partial: Boolean(candidate.partial),
  }
}

export const loadCachedMetroStatus = (): MetroStatusPayload | null => {
  try {
    const stored = localStorage.getItem(CACHE_KEY)
    return stored ? parsePayload(JSON.parse(stored)) : null
  } catch {
    return null
  }
}

const saveCachedMetroStatus = (payload: MetroStatusPayload) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    // Private browsing or a full storage quota should not break the status screen.
  }
}

export const fetchMetroStatus = async (signal?: AbortSignal): Promise<MetroStatusResult> => {
  try {
    const response = await fetch('/api/metro-status', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const payload = parsePayload(await response.json())
    if (!payload) throw new Error('Некоректна відповідь сервера')
    saveCachedMetroStatus(payload)
    return { payload, source: 'network' }
  } catch (error) {
    if (signal?.aborted) throw error
    const cached = loadCachedMetroStatus()
    if (cached) return { payload: cached, source: 'cache', error: error instanceof Error ? error.message : 'Помилка мережі' }
    return { payload: emptyMetroStatus(), source: 'none', error: error instanceof Error ? error.message : 'Помилка мережі' }
  }
}

export const formatStatusAge = (isoDate: string) => {
  const timestamp = new Date(isoDate).getTime()
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'ще не оновлювалося'
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 1) return 'щойно'
  if (minutes < 60) return `${minutes} хв тому`
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} год тому`
  return new Date(timestamp).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export const isStatusStale = (isoDate: string) => {
  const timestamp = new Date(isoDate).getTime()
  return !Number.isFinite(timestamp) || timestamp <= 0 || Date.now() - timestamp > 30 * 60 * 1000
}
