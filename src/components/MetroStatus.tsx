import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { lines } from '../data/metro'
import { useLanguage } from '../lib/i18n'
import {
  emptyMetroStatus,
  fetchMetroStatus,
  formatStatusAge,
  isStatusStale,
  loadCachedMetroStatus,
  type MetroNotice,
  type MetroStatusPayload,
  type ServiceState,
  type StatusSource,
} from '../lib/status'
import { useStoredState } from '../lib/storage'
import type { LineId } from '../types'
import { Icon } from './Icon'

interface Props {
  hidden?: boolean
}

const lineIds: LineId[] = ['M1', 'M2', 'M3']

const stateLabel: Record<ServiceState, string> = {
  normal: 'Змін не знайдено',
  changes: 'Є зміни',
  disrupted: 'Рух порушено',
  unknown: 'Немає свіжих даних',
}

const overallLabel: Record<ServiceState, string> = {
  normal: 'Повідомлень про зміни немає',
  changes: 'Є важливі зміни',
  disrupted: 'Є обмеження руху',
  unknown: 'Статус потребує перевірки',
}

const severityLabel: Record<MetroNotice['severity'], string> = {
  info: 'Інформація',
  warning: 'Зміни',
  critical: 'Важливо',
  resolved: 'Відновлено',
}

const formatPublishedAt = (value: string | null) => {
  if (!value) return 'Час публікації не визначено'
  return new Date(value).toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const sourceLabel: Record<StatusSource, string> = {
  network: 'Оновлено з офіційних джерел',
  cache: 'Показано останній збережений статус',
  none: 'Офіційні джерела зараз недоступні',
}

const useTopbarTarget = () => {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const sync = () => {
      const next = document.querySelector<HTMLElement>('.topbar-actions')
      setTarget((current) => current === next ? current : next)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { subtree: true, childList: true })
    return () => observer.disconnect()
  }, [])

  return target
}

export const MetroStatus = ({ hidden = false }: Props) => {
  const { language } = useLanguage()
  const cachedAtStart = useMemo(() => loadCachedMetroStatus(), [])
  const [payload, setPayload] = useState<MetroStatusPayload>(cachedAtStart ?? emptyMetroStatus())
  const [source, setSource] = useState<StatusSource>(cachedAtStart ? 'cache' : 'none')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [watchedLines, setWatchedLines] = useStoredState<LineId[]>('metro-status-watched-lines', [])
  const [notifiedNoticeIds, setNotifiedNoticeIds] = useStoredState<string[]>('metro-status-seen-notices', [])
  const [readNoticeIds, setReadNoticeIds] = useStoredState<string[]>('metro-status-read-notices', [])
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null)
  const watchedLinesRef = useRef(watchedLines)
  const notifiedNoticeIdsRef = useRef(notifiedNoticeIds)
  const topbarTarget = useTopbarTarget()

  useEffect(() => {
    watchedLinesRef.current = watchedLines
  }, [watchedLines])

  useEffect(() => {
    notifiedNoticeIdsRef.current = notifiedNoticeIds
  }, [notifiedNoticeIds])

  const notifyAboutNewNotices = useCallback((nextPayload: MetroStatusPayload, allowNotification: boolean) => {
    const currentIds = nextPayload.notices.map((notice) => notice.id)
    const previousIds = notifiedNoticeIdsRef.current

    if (previousIds.length === 0) {
      const initialIds = currentIds.slice(0, 40)
      notifiedNoticeIdsRef.current = initialIds
      setNotifiedNoticeIds(initialIds)
      return
    }

    const newRelevant = nextPayload.notices.filter((notice) =>
      notice.active
      && !previousIds.includes(notice.id)
      && watchedLinesRef.current.some((lineId) => notice.affectedLines.length === 0 || notice.affectedLines.includes(lineId)),
    )

    const mergedIds = [...new Set([...currentIds, ...previousIds])].slice(0, 60)
    if (mergedIds.join('|') !== previousIds.join('|')) {
      notifiedNoticeIdsRef.current = mergedIds
      setNotifiedNoticeIds(mergedIds)
    }

    if (!allowNotification || newRelevant.length === 0 || !('Notification' in window) || Notification.permission !== 'granted') return
    if (document.visibilityState === 'visible') return

    const notice = newRelevant[0]
    new Notification('Зміни в роботі метро', {
      body: notice.title,
      icon: '/metro-icon.svg',
      tag: `metro-status-${notice.id}`,
    })
  }, [setNotifiedNoticeIds])

  const refresh = useCallback(async (allowNotification = true, signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchMetroStatus(signal)
      setPayload(result.payload)
      setSource(result.source)
      setError(result.error ?? null)
      if (result.source === 'network') notifyAboutNewNotices(result.payload, allowNotification)
    } catch {
      // Aborted requests do not need a visible error.
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [notifyAboutNewNotices])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(false, controller.signal)
    const interval = window.setInterval(() => void refresh(true), 5 * 60 * 1000)
    const handleOnline = () => void refresh(true)
    window.addEventListener('online', handleOnline)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener('online', handleOnline)
    }
  }, [refresh])

  useEffect(() => {
    if (hidden) setOpen(false)
  }, [hidden])

  const activeNotices = payload.notices.filter((notice) => notice.active)
  const unreadNoticeIds = activeNotices.filter((notice) => !readNoticeIds.includes(notice.id)).map((notice) => notice.id)
  const unreadCount = unreadNoticeIds.length
  const stale = isStatusStale(payload.fetchedAt)
  const notificationPermission = 'Notification' in window ? Notification.permission : 'unsupported'

  const toggleWatch = (lineId: LineId) => {
    setWatchedLines((current) => current.includes(lineId)
      ? current.filter((item) => item !== lineId)
      : [...current, lineId])
  }

  const markNoticeRead = (noticeId: string) => {
    setReadNoticeIds((current) => current.includes(noticeId) ? current : [...current, noticeId].slice(-80))
  }

  const markAllRead = () => {
    setReadNoticeIds((current) => [...new Set([...current, ...activeNotices.map((notice) => notice.id)])].slice(-100))
  }

  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationMessage('Цей браузер не підтримує системні сповіщення.')
      return
    }
    const permission = await Notification.requestPermission()
    setNotificationMessage(permission === 'granted'
      ? 'Сповіщення ввімкнено. Вони працюють для нових повідомлень, поки PWA запущений.'
      : 'Браузер не надав дозвіл на сповіщення.')
  }

  if (hidden) return null

  const bellButton = (
    <button
      type="button"
      className={`topbar-notification-button icon-button ${unreadCount > 0 ? 'has-unread' : ''}`}
      onClick={() => setOpen(true)}
      aria-label={language === 'uk'
        ? `Сповіщення метро${unreadCount ? `, непрочитаних: ${unreadCount}` : ', нових немає'}`
        : `Metro notifications${unreadCount ? `, unread: ${unreadCount}` : ', no new items'}`}
      title={language === 'uk' ? 'Сповіщення метро' : 'Metro notifications'}
    >
      <Icon name="bell" size={20} />
      {unreadCount > 0 && <b>{Math.min(unreadCount, 99)}</b>}
    </button>
  )

  return (
    <>
      {topbarTarget && createPortal(bellButton, topbarTarget)}

      {open && (
        <div className="metro-status-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="metro-status-panel" role="dialog" aria-modal="true" aria-label="Статус роботи метро">
            <header className="status-panel-header">
              <div>
                <span className="eyebrow">Оперативна інформація</span>
                <h2>Сповіщення метро</h2>
                <p>{overallLabel[payload.overall]}{unreadCount > 0 ? ` · ${unreadCount} непрочитаних` : ' · усе прочитано'}</p>
              </div>
              <div className="status-header-actions">
                <button type="button" className="icon-button" onClick={() => void refresh(false)} disabled={loading} aria-label="Оновити статус">
                  <Icon name="refresh" className={loading ? 'status-spin' : ''} />
                </button>
                <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Закрити"><Icon name="close" /></button>
              </div>
            </header>

            <div className={`status-freshness source-${source}`}>
              <span className="status-freshness-icon"><Icon name={source === 'network' ? 'check' : 'offline'} size={18} /></span>
              <span>
                <strong>{sourceLabel[source]}</strong>
                <small>Оновлено {formatStatusAge(payload.fetchedAt)}{payload.partial ? ' · частина джерел недоступна' : ''}</small>
              </span>
            </div>

            <div className="status-line-grid" aria-label="Статус ліній">
              {lineIds.map((lineId) => (
                <article className={`status-line-card state-${payload.lineStatus[lineId]}`} key={lineId}>
                  <span className="status-line-badge" style={{ background: lines[lineId].color }}>{lineId}</span>
                  <span><strong>{lines[lineId].name}</strong><small>{stateLabel[payload.lineStatus[lineId]]}</small></span>
                  <button
                    type="button"
                    className={watchedLines.includes(lineId) ? 'is-watched' : ''}
                    onClick={() => toggleWatch(lineId)}
                    aria-label={`${watchedLines.includes(lineId) ? 'Не стежити' : 'Стежити'} за ${lineId}`}
                  >
                    {watchedLines.includes(lineId) ? <Icon name="check" size={15} /> : '+'}
                  </button>
                </article>
              ))}
            </div>

            <section className="status-notification-card card">
              <div>
                <strong>Системні сповіщення за бажанням</strong>
                <p>{watchedLines.length > 0 ? `Вибрано: ${watchedLines.join(', ')}` : 'Оберіть потрібні лінії кнопкою «+».'}</p>
              </div>
              <button type="button" className="secondary-button compact-button" onClick={requestNotifications} disabled={notificationPermission === 'granted' || notificationPermission === 'unsupported'}>
                {notificationPermission === 'granted' ? 'Увімкнено' : 'Увімкнути'}
              </button>
              {notificationMessage && <small className="notification-message">{notificationMessage}</small>}
              <small>Сповіщення надходять про нові офіційні повідомлення для вибраних ліній, поки PWA запущений.</small>
            </section>

            <section className="status-notices-section">
              <div className="section-heading status-notices-heading">
                <div><span className="eyebrow">Офіційні публікації</span><h3>Останні повідомлення</h3></div>
                {unreadCount > 0 ? (
                  <button type="button" className="secondary-button compact-button" onClick={markAllRead}>Позначити все прочитаним</button>
                ) : (
                  <span className="all-read-label"><Icon name="check" size={15} /> Усе прочитано</span>
                )}
              </div>

              {payload.notices.length > 0 ? (
                <div className="status-notice-list">
                  {payload.notices.map((notice) => {
                    const isRead = readNoticeIds.includes(notice.id)
                    return (
                      <a
                        className={`status-notice-card severity-${notice.severity} ${isRead ? 'is-read' : 'is-unread'}`}
                        href={notice.url}
                        target="_blank"
                        rel="noreferrer"
                        key={`${notice.sourceName}-${notice.id}`}
                        onClick={() => markNoticeRead(notice.id)}
                      >
                        <span className="notice-severity">{severityLabel[notice.severity]}</span>
                        {!isRead && <span className="notice-unread-dot" aria-label="Непрочитане" />}
                        <strong>{notice.title}</strong>
                        <p>{notice.summary}</p>
                        <footer>
                          <span>{notice.sourceName}</span>
                          <time dateTime={notice.publishedAt ?? undefined}>{formatPublishedAt(notice.publishedAt)}</time>
                          <span className="notice-lines">{notice.affectedLines.length ? notice.affectedLines.join(' · ') : 'Усі лінії / загальна інформація'}</span>
                        </footer>
                      </a>
                    )
                  })}
                </div>
              ) : (
                <div className="status-empty card">
                  <Icon name={source === 'none' ? 'offline' : 'check'} size={30} />
                  <h3>{source === 'none' ? 'Не вдалося отримати офіційні повідомлення' : 'Свіжих повідомлень про зміни не знайдено'}</h3>
                  <p>Це не є гарантією безперебійної роботи. Перед важливою поїздкою перевірте офіційні канали та оголошення на станціях.</p>
                </div>
              )}
            </section>

            {(error || stale) && (
              <p className="status-warning"><Icon name="info" size={16} /> {error ? 'Не вдалося отримати свіжі дані — показано доступний кеш.' : 'Дані давно не оновлювалися. Перевірте офіційні джерела.'}</p>
            )}

            <footer className="status-sources">
              <strong>Джерела</strong>
              {payload.sources.map((item) => (
                <a href={item.url} target="_blank" rel="noreferrer" key={item.url}>
                  <i className={item.ok ? 'source-ok' : 'source-error'} /> {item.name}
                </a>
              ))}
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
