type LineId = 'M1' | 'M2' | 'M3'
type NoticeSeverity = 'info' | 'warning' | 'critical' | 'resolved'
type ServiceState = 'normal' | 'changes' | 'disrupted' | 'unknown'

interface SourceConfig {
  name: string
  listingUrl: string
  baseUrl: string
}

interface SourceResult {
  name: string
  url: string
  ok: boolean
}

interface MetroNotice {
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

interface FunctionContext {
  request: Request
}

const SOURCES: SourceConfig[] = [
  {
    name: 'Офіційний портал Києва',
    listingUrl: 'https://kyivcity.gov.ua/news/',
    baseUrl: 'https://kyivcity.gov.ua',
  },
  {
    name: 'Департамент транспортної інфраструктури КМДА',
    listingUrl: 'https://dti.kyivcity.gov.ua/news',
    baseUrl: 'https://dti.kyivcity.gov.ua',
  },
]

const MONTHS: Record<string, number> = {
  січня: 0,
  лютого: 1,
  березня: 2,
  квітня: 3,
  травня: 4,
  червня: 5,
  липня: 6,
  серпня: 7,
  вересня: 8,
  жовтня: 9,
  листопада: 10,
  грудня: 11,
}

const METRO_TERMS = [
  'метро',
  'метрополітен',
  'поїзд',
  'станці',
  'червоній ліні',
  'синій ліні',
  'зеленій ліні',
]

const decodeEntities = (value: string) => value
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&laquo;/gi, '«')
  .replace(/&raquo;/gi, '»')
  .replace(/&ndash;|&#8211;/gi, '–')
  .replace(/&mdash;|&#8212;/gi, '—')
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))

const stripHtml = (value: string) => decodeEntities(value)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const fetchText = async (url: string, timeoutMs = 7000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Metro-Kyiv-PWA/0.5 (+https://github.com/XOTT69/metro)',
      },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

const isMetroTitle = (title: string) => {
  const normalized = title.toLocaleLowerCase('uk-UA')
  return METRO_TERMS.some((term) => normalized.includes(term))
}

const extractArticleLinks = (html: string, source: SourceConfig) => {
  const links = new Map<string, string>()
  const anchorPattern = /<a\b[^>]*href=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorPattern.exec(html))) {
    const href = match[2]
    const title = stripHtml(match[3])
    if (title.length < 18 || !isMetroTitle(title)) continue

    try {
      const url = new URL(href, source.baseUrl)
      if (!url.pathname.includes('/news/')) continue
      url.hash = ''
      links.set(url.toString(), title)
    } catch {
      // Ignore malformed links from the source page.
    }
  }

  return [...links.entries()].slice(0, 8).map(([url, title]) => ({ url, title }))
}

const parsePublishedAt = (plainText: string) => {
  const match = plainText.match(/(?:Опубліковано\s+)?(\d{1,2})\s+(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)\s+(\d{4})(?:\s+року)?(?:\s+о|\s*,)?\s*(\d{1,2}):(\d{2})/i)
  if (!match) return null

  const day = Number(match[1])
  const month = MONTHS[match[2].toLocaleLowerCase('uk-UA')]
  const year = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  if (!Number.isFinite(day + month + year + hour + minute)) return null

  const utcOffsetHours = month >= 2 && month <= 9 ? 3 : 2
  return new Date(Date.UTC(year, month, day, hour - utcOffsetHours, minute)).toISOString()
}

const extractSummary = (html: string, title: string) => {
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((paragraph) => paragraph.length >= 70)
    .filter((paragraph) => !paragraph.includes('технічні питання'))
    .filter((paragraph) => !paragraph.includes('Офіційний портал'))

  const first = paragraphs.find((paragraph) => !paragraph.startsWith(title)) ?? paragraphs[0]
  if (!first) return 'Деталі доступні в офіційному повідомленні.'
  return first.length > 280 ? `${first.slice(0, 277).trim()}…` : first
}

const inferLines = (text: string): LineId[] => {
  const value = text.toLocaleLowerCase('uk-UA')
  const lines: LineId[] = []

  if (/червон|святошинсько|академмістечко|лісова|арсенальна|дніпро|гідропарк|лівобережна|дарниця|чернігівська/.test(value)) lines.push('M1')
  if (/син(ій|я|ьої)|оболонсько|героїв дніпра|теремки|майдан незалежності|площа українських героїв|олімпійська|либідська|деміївська/.test(value)) lines.push('M2')
  if (/зелен|сирецько|сирець|червоний хутір|золоті ворота|палац спорту|видубичі|позняки|харківська|бориспільська/.test(value)) lines.push('M3')
  if (/усіх трьох|всіх трьох|на всіх лініях|на трьох лініях/.test(value)) return ['M1', 'M2', 'M3']

  return lines
}

const inferSeverity = (text: string): NoticeSeverity => {
  const value = text.toLocaleLowerCase('uk-UA')
  if (/відновил|рух відновлено|звичайному режимі|обмеження скасовано|відкрили для пасажирів/.test(value)) return 'resolved'
  if (/не курсу|закрит|призупин|зупинен|не працю|евакуац/.test(value)) return 'critical'
  if (/зміни|обмеж|збільш.*інтервал|тимчас|інтервал руху|ремонт/.test(value)) return 'warning'
  return 'info'
}

const noticeId = (url: string) => {
  const path = new URL(url).pathname.replace(/^\/+|\/+$/g, '')
  return path.split('/').pop() || path
}

const parseArticle = async (candidate: { url: string; title: string }, source: SourceConfig): Promise<MetroNotice> => {
  let html = ''
  try {
    html = await fetchText(candidate.url)
  } catch {
    return {
      id: noticeId(candidate.url),
      title: candidate.title,
      summary: 'Відкрийте офіційне повідомлення для деталей.',
      url: candidate.url,
      sourceName: source.name,
      publishedAt: null,
      severity: inferSeverity(candidate.title),
      affectedLines: inferLines(candidate.title),
      active: false,
    }
  }

  const plainText = stripHtml(html)
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  const title = h1 ? stripHtml(h1[1]) : candidate.title
  const publishedAt = parsePublishedAt(plainText)
  const severity = inferSeverity(`${title} ${plainText.slice(0, 2500)}`)
  const affectedLines = inferLines(`${title} ${plainText.slice(0, 2500)}`)
  const ageMs = publishedAt ? Date.now() - new Date(publishedAt).getTime() : Number.POSITIVE_INFINITY
  const active = (severity === 'warning' || severity === 'critical') && ageMs >= -24 * 60 * 60 * 1000 && ageMs <= 72 * 60 * 60 * 1000

  return {
    id: noticeId(candidate.url),
    title,
    summary: extractSummary(html, title),
    url: candidate.url,
    sourceName: source.name,
    publishedAt,
    severity,
    affectedLines,
    active,
  }
}

const stateForLine = (lineId: LineId, notices: MetroNotice[], sourcesAvailable: boolean): ServiceState => {
  const relevant = notices.filter((notice) => notice.active && (notice.affectedLines.length === 0 || notice.affectedLines.includes(lineId)))
  if (relevant.some((notice) => notice.severity === 'critical')) return 'disrupted'
  if (relevant.some((notice) => notice.severity === 'warning')) return 'changes'
  return sourcesAvailable ? 'normal' : 'unknown'
}

export const onRequestGet = async (_context: FunctionContext): Promise<Response> => {
  const sourceResults: SourceResult[] = []
  const collected: MetroNotice[] = []

  await Promise.all(SOURCES.map(async (source) => {
    try {
      const listing = await fetchText(source.listingUrl)
      const candidates = extractArticleLinks(listing, source)
      const notices = await Promise.all(candidates.map((candidate) => parseArticle(candidate, source)))
      collected.push(...notices)
      sourceResults.push({ name: source.name, url: source.listingUrl, ok: true })
    } catch {
      sourceResults.push({ name: source.name, url: source.listingUrl, ok: false })
    }
  }))

  const deduped = [...new Map(collected.map((notice) => [notice.url, notice])).values()]
    .filter((notice) => !notice.publishedAt || Date.now() - new Date(notice.publishedAt).getTime() <= 14 * 24 * 60 * 60 * 1000)
    .sort((a, b) => (b.publishedAt ? new Date(b.publishedAt).getTime() : 0) - (a.publishedAt ? new Date(a.publishedAt).getTime() : 0))
    .slice(0, 12)

  const sourcesAvailable = sourceResults.some((source) => source.ok)
  const lineStatus = {
    M1: stateForLine('M1', deduped, sourcesAvailable),
    M2: stateForLine('M2', deduped, sourcesAvailable),
    M3: stateForLine('M3', deduped, sourcesAvailable),
  }

  const states = Object.values(lineStatus)
  const overall: ServiceState = states.includes('disrupted')
    ? 'disrupted'
    : states.includes('changes')
      ? 'changes'
      : states.every((state) => state === 'unknown')
        ? 'unknown'
        : 'normal'

  const body = {
    fetchedAt: new Date().toISOString(),
    overall,
    lineStatus,
    notices: deduped,
    sources: sourceResults,
    partial: sourceResults.some((source) => !source.ok),
  }

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
