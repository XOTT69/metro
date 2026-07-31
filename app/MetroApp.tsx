import { useEffect, useRef, useState } from "react";
import {
  ArrowUpDown,
  Bell,
  BellRing,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCheck,
  CircleHelp,
  ExternalLink,
  LocateFixed,
  Map as MapIcon,
  Route,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  LINE_META,
  LINE_STATIONS,
  STATION_BY_ID,
  estimateTripMinutes,
  getRoute,
  getServiceInterval,
  getStationPredictions,
  routeTransfers,
  type LineId,
  type ServiceDay,
  type Station,
} from "./metro-data";
import { formatTimer } from "./components/station-time";
import { normalizeStationName } from "./station-search";
import { getNearestStation } from "./hooks/useNearestStation";
import { useTransportAlerts } from "./city-transit/hooks/useTransportAlerts";
import type { TransportAlert } from "./city-transit/model";

type View = "schedule" | "map" | "about" | "settings";
type Theme = "light" | "dark" | "system";
type SavedRoute = { from: string; to: string };
type RouteLeg = { line: LineId; stationIds: string[]; direction: string };

const lineIds: LineId[] = ["red", "blue", "green"];
const OFFICIAL_UPDATES_URL = "http://metro.kyiv.ua/";
const STATION_ALIASES: Record<string, string[]> = {
  "ploshcha-ukrainskykh-heroiv": ["льва толстого", "толстого"],
  "palats-sportu": ["спорт", "палац"],
  "maidan-nezalezhnosti": ["майдан", "незалежності"],
  "kontraktova-ploshcha": ["контрактова", "контракт"],
  "politekhnichnyi-instytut": ["кпі", "політех"],
  "vystavkovyi-tsentr": ["вднг", "виставковий"],
  "heroiv-dnipra": ["героїв", "дніпра"],
  "zoloti-vorota": ["золоті", "ворота"],
};
const kyivFormatter = new Intl.DateTimeFormat("uk-UA", {
  timeZone: "Europe/Kyiv",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function clockTime(date: Date) {
  return date.toLocaleTimeString("uk-UA", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function routeKey(from: string, to: string) {
  return `${from}:${to}`;
}

function getRouteLegs(route: string[]): RouteLeg[] {
  if (route.length < 2) return [];
  const legs: RouteLeg[] = [];
  let start = 0;

  for (let index = 1; index <= route.length; index += 1) {
    const changedLine =
      index === route.length ||
      STATION_BY_ID[route[index - 1]].line !== STATION_BY_ID[route[index]].line;
    if (!changedLine) continue;
    const stationIds = route.slice(start, index);
    const line = STATION_BY_ID[stationIds[0]].line;
    const stations = LINE_STATIONS[line];
    const fromIndex = stations.findIndex(({ id }) => id === stationIds[0]);
    const toIndex = stations.findIndex(({ id }) => id === stationIds.at(-1));
    legs.push({
      line,
      stationIds,
      direction: LINE_META[line].terminus[toIndex > fromIndex ? 1 : 0],
    });
    start = index;
  }
  return legs;
}

function subtractMinutes(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const result = (hours * 60 + mins - minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(result / 60)).padStart(2, "0")}:${String(result % 60).padStart(2, "0")}`;
}

function RouteSteps({ route }: { route: string[] }) {
  const legs = getRouteLegs(route);
  if (!legs.length) return null;
  return (
    <section className="route-steps" aria-label="Деталі маршруту">
      <header><p className="eyebrow">По лініях</p><h2>Як їхати</h2></header>
      <ol>
        {legs.map((leg, index) => (
          <li key={`${leg.line}:${leg.stationIds[0]}`}>
            <span className="route-step__line" style={{ backgroundColor: LINE_META[leg.line].color }}>{LINE_META[leg.line].code}</span>
            <div>
              <b>{leg.stationIds.length > 1 ? `До «${leg.direction}»` : `Перехід на «${STATION_BY_ID[leg.stationIds[0]].name}»`}</b>
              <p>{leg.stationIds.length > 1 ? `${STATION_BY_ID[leg.stationIds[0]].name} → ${STATION_BY_ID[leg.stationIds.at(-1)!].name} · ${leg.stationIds.length - 1} станц.` : "Пересадка між лініями"}</p>
            </div>
            {index < legs.length - 1 && <small>Пересадка</small>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function AlertsInbox({
  alerts,
  error,
  unreadIds,
  onMarkRead,
  onMarkAllRead,
  onClose,
}: {
  alerts: TransportAlert[];
  error: boolean;
  unreadIds: Set<string>;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}) {
  return (
    <section className="alerts-inbox" aria-label="Оперативні зміни метро">
      <header>
        <div><p>Оперативні зміни</p><small>metro.kyiv.ua</small></div>
        <div><button type="button" onClick={onMarkAllRead} disabled={!unreadIds.size}><CheckCheck size={15} />Прочитано</button><button type="button" onClick={onClose} aria-label="Закрити сповіщення"><X size={17} /></button></div>
      </header>
      {error ? <p className="alerts-inbox__empty">Не вдалося оновити стрічку. Спробуйте пізніше.</p> : alerts.length ? <div className="alerts-inbox__list">
        {alerts.map((alert) => {
          const unread = unreadIds.has(alert.id);
          const critical = /тривог|зупин|обмежен|не курсують/iu.test(`${alert.title} ${alert.text}`);
          return <a className={`${unread ? "is-unread" : ""} ${critical ? "is-critical" : ""}`} href={alert.url} target="_blank" rel="noreferrer" key={alert.id} onClick={() => onMarkRead(alert.id)}>
            <span>{critical ? <BellRing size={14} /> : <Bell size={14} />}</span><div><b>{alert.title}</b><small>{new Date(alert.publishedAt).toLocaleString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div>{unread ? <i>нове</i> : <Check size={14} />}
          </a>;
        })}
      </div> : <p className="alerts-inbox__empty">Нових оперативних повідомлень немає.</p>}
      <a className="alerts-inbox__source" href={OFFICIAL_UPDATES_URL} target="_blank" rel="noreferrer">Відкрити сайт метрополітену <ExternalLink size={13} /></a>
    </section>
  );
}

function getInitialDay(now: Date): ServiceDay {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    weekday: "short",
  }).format(now);
  return weekday === "Sat" || weekday === "Sun" ? "weekend" : "weekday";
}

function MetroMark() {
  return <span className="metro-mark" aria-hidden="true">М</span>;
}

function StationPicker({
  stationId,
  onChange,
  label = "Станція",
}: {
  stationId: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [query, setQuery] = useState(() => STATION_BY_ID[stationId]?.name ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const normalizedQuery = normalizeStationName(query);
  const stationMatches = (station: Station) => {
    if (!normalizedQuery) return true;
    return [station.name, ...(STATION_ALIASES[station.id] ?? [])]
      .some((value) => normalizeStationName(value).includes(normalizedQuery));
  };

  useEffect(() => {
    setQuery(STATION_BY_ID[stationId]?.name ?? "");
  }, [stationId]);

  return (
    <div className={`station-picker ${isOpen ? "is-open" : ""}`}>
      <label>
        <span>{label}</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          placeholder="Почніть вводити назву"
          aria-label={label}
          aria-expanded={isOpen}
          aria-controls={`${label}-stations`}
        />
        <i aria-hidden="true"><Search size={18} strokeWidth={2.2} /></i>
      </label>
      {isOpen && (
        <div className="station-results" id={`${label}-stations`}>
          {lineIds.map((line) => {
            const stations = LINE_STATIONS[line].filter(stationMatches);
            if (!stations.length) return null;
            return (
              <section key={line}>
                <header><i style={{ backgroundColor: LINE_META[line].color }} />{LINE_META[line].code}<span>{LINE_META[line].name}</span></header>
                {stations.map((station) => (
                  <button
                    type="button"
                    key={station.id}
                    className={station.id === stationId ? "is-selected" : ""}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(station.id);
                      setIsOpen(false);
                    }}
                  >
                    {station.name}
                  </button>
                ))}
              </section>
            );
          })}
          {!lineIds.some((line) => LINE_STATIONS[line].some(stationMatches)) && <p>Нічого не знайдено. Спробуйте іншу назву.</p>}
        </div>
      )}
    </div>
  );
}

function DirectionCard({
  station,
  directionIndex,
  active,
  now,
  day,
  onClick,
}: {
  station: Station;
  directionIndex: number;
  active: boolean;
  now: Date;
  day: ServiceDay;
  onClick: () => void;
}) {
  const prediction = getStationPredictions(station, now, day)[directionIndex];
  return (
    <button className={`direction-card ${active ? "is-active" : ""}`} onClick={onClick}>
      <span className="direction-card__top">
        <span>{directionIndex === 0 ? "←" : "→"} У напрямку</span>
        <b style={{ backgroundColor: LINE_META[station.line].color }}>{LINE_META[station.line].code}</b>
      </span>
      <strong>{prediction.direction}</strong>
      <small>відправлення о {prediction.clockTime}</small>
      <b>{formatTimer(prediction.seconds)}</b>
    </button>
  );
}

function MetroMap({ route }: { route: string[] }) {
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const clampZoom = (value: number) => Math.min(3, Math.max(1, value));
  const distance = () => {
    const [first, second] = [...pointersRef.current.values()];
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 2) {
      const initialDistance = distance();
      pinchRef.current = initialDistance ? { distance: initialDistance, zoom } : null;
      dragRef.current = null;
    } else {
      dragRef.current = { x: event.clientX, y: event.clientY, left: canvas.scrollLeft, top: canvas.scrollTop };
    }
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const nextDistance = distance();
      if (nextDistance) setZoom(clampZoom(pinchRef.current.zoom * (nextDistance / pinchRef.current.distance)));
      return;
    }
    if (pointersRef.current.size === 1 && dragRef.current) {
      canvas.scrollLeft = dragRef.current.left - (event.clientX - dragRef.current.x);
      canvas.scrollTop = dragRef.current.top - (event.clientY - dragRef.current.y);
    }
  };
  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (!pointersRef.current.size) dragRef.current = null;
  };

  return (
    <section className="map-panel" aria-label="Схема київського метро">
      <div className="map-panel__heading">
        <p className="eyebrow">Офіційна схема</p>
        <h1>Карта метро</h1>
        <span>Збільшуйте та переміщайте карту жестами або кнопками.</span>
      </div>
      {route.length > 1 && <div className="map-route-summary" aria-label="Маршрут на схемі">
        <span>Ваш шлях</span>{getRouteLegs(route).map((leg) => <b key={`${leg.line}:${leg.stationIds[0]}`} style={{ backgroundColor: LINE_META[leg.line].color }}>{LINE_META[leg.line].code}</b>)}
        <small>{STATION_BY_ID[route[0]].name} → {STATION_BY_ID[route.at(-1)!].name}</small>
      </div>}
      <div className="map-photo" aria-label="Оригінальна карта київського метро">
        <div className="map-zoom-controls">
          <button onClick={() => setZoom((value) => clampZoom(value - 0.25))} disabled={zoom === 1} aria-label="Віддалити карту">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((value) => clampZoom(value + 0.25))} disabled={zoom === 3} aria-label="Збільшити карту">+</button>
        </div>
        <div
          className="map-photo__canvas"
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <img src="/kyiv-metro-map-v1.12.3.png" alt="Офіційна схема Київського метро та швидкісного транспорту" style={{ width: `${zoom * 100}%` }} />
        </div>
      </div>
      <p className="map-note">Версія схеми 1.12.3 · метро, швидкісний трамвай та міська електричка.</p>
    </section>
  );
}

export default function MetroApp() {
  const [view, setView] = useState<View>(() =>
    new URLSearchParams(window.location.search).get("view") === "map" ? "map" : "schedule",
  );
  const [now, setNow] = useState(() => new Date());
  const [stationId, setStationId] = useState("");
  const [toId, setToId] = useState("");
  const [direction, setDirection] = useState(0);
  const [day, setDay] = useState<ServiceDay>(() => getInitialDay(new Date()));
  const [favorites, setFavorites] = useState<string[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [theme, setTheme] = useState<Theme>("system");
  const [showBoth, setShowBoth] = useState(true);
  const [arriveBy, setArriveBy] = useState("");
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "error">("idle");
  const [storageReady, setStorageReady] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<"idle" | "unsupported" | "denied">("idle");
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [readAlertIds, setReadAlertIds] = useState<string[]>([]);
  const { alerts, alertsError } = useTransportAlerts();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const storedFavorites = window.localStorage.getItem("metro-kyiv:favorites");
    const storedRoutes = window.localStorage.getItem("metro-kyiv:saved-routes");
    const storedTheme = window.localStorage.getItem("metro-kyiv:theme") as Theme | null;
    const storedBoth = window.localStorage.getItem("metro-kyiv:both-directions");
    const storedAlertsEnabled = window.localStorage.getItem("metro-kyiv:metro-alerts");
    const storedReadAlertIds = window.localStorage.getItem("metro-kyiv:read-alerts");
    if (storedFavorites) {
      try {
        const parsed = JSON.parse(storedFavorites);
        if (Array.isArray(parsed)) {
          setFavorites(
            parsed.filter(
              (id): id is string => typeof id === "string" && Boolean(STATION_BY_ID[id]),
            ),
          );
        }
      } catch {
        // A damaged browser cache must not prevent the app from opening.
      }
    }
    if (storedRoutes) {
      try {
        const parsed = JSON.parse(storedRoutes);
        if (Array.isArray(parsed)) {
          setSavedRoutes(
            parsed.filter(
              (item): item is SavedRoute =>
                typeof item?.from === "string" && typeof item?.to === "string" &&
                Boolean(STATION_BY_ID[item.from]) && Boolean(STATION_BY_ID[item.to]),
            ).slice(0, 6),
          );
        }
      } catch {
        // Ignore a damaged local cache and keep the app usable.
      }
    }
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") setTheme(storedTheme);
    if (storedBoth) setShowBoth(storedBoth === "true");
    if (storedAlertsEnabled === "true") setAlertsEnabled(true);
    if (storedReadAlertIds) {
      try {
        const parsed = JSON.parse(storedReadAlertIds);
        if (Array.isArray(parsed)) setReadAlertIds(parsed.filter((id): id is string => typeof id === "string").slice(-50));
      } catch {
        // The inbox can safely start fresh if its local state is damaged.
      }
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem("metro-kyiv:favorites", JSON.stringify(favorites));
  }, [favorites, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem("metro-kyiv:saved-routes", JSON.stringify(savedRoutes));
  }, [savedRoutes, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem("metro-kyiv:theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem("metro-kyiv:both-directions", String(showBoth));
  }, [showBoth, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem("metro-kyiv:metro-alerts", String(alertsEnabled));
  }, [alertsEnabled, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem("metro-kyiv:read-alerts", JSON.stringify(readAlertIds.slice(-50)));
  }, [readAlertIds, storageReady]);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!storageReady || !alertsEnabled || !alerts[0]) return;
    const alert = alerts[0];
    const storageKey = "metro-kyiv:last-alert-id";
    const previousId = window.localStorage.getItem(storageKey);
    if (!previousId) {
      window.localStorage.setItem(storageKey, alert.id);
      return;
    }
    if (previousId === alert.id) return;
    window.localStorage.setItem(storageKey, alert.id);
    if (Notification.permission !== "granted") return;
    const show = async () => {
      const title = /тривог|зупин|обмежен|не курсують/iu.test(`${alert.title} ${alert.text}`)
        ? "Метро Київ — важлива зміна"
        : "Метро Київ — оновлення";
      const options = {
        body: alert.title,
        icon: "/metro-logo.svg",
        badge: "/metro-logo.svg",
        tag: "metro-kyiv-alert",
      };
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, options);
      } else {
        new Notification(title, options);
      }
    };
    void show().catch(() => undefined);
  }, [alerts, alertsEnabled, storageReady]);
  useEffect(() => {
    if (!storageReady || !alerts.length) return;
    const initializedKey = "metro-kyiv:alerts-inbox-initialized";
    if (window.localStorage.getItem(initializedKey)) return;
    setReadAlertIds((items) => [...new Set([...items, ...alerts.map((alert) => alert.id)])].slice(-50));
    window.localStorage.setItem(initializedKey, "true");
  }, [alerts, storageReady]);

  const station = STATION_BY_ID[stationId];
  const destination = STATION_BY_ID[toId];
  const hasJourney = Boolean(station && destination);
  const route = hasJourney ? getRoute(stationId, toId) : [];
  const tripMinutes = estimateTripMinutes(route);
  const transfers = routeTransfers(route);
  const nextRouteStation = route[1] ? STATION_BY_ID[route[1]] : undefined;
  const recommendedDirection = station && nextRouteStation?.line === station.line
    ? LINE_META[station.line].terminus[
        LINE_STATIONS[station.line].findIndex(({ id }) => id === nextRouteStation.id) >
        LINE_STATIONS[station.line].findIndex(({ id }) => id === station.id)
          ? 1
          : 0
      ]
    : null;
  const predictions = station ? getStationPredictions(station, now, day) : null;
  const activePrediction = predictions?.[direction];
  const journeyPrediction = recommendedDirection
    ? predictions?.find((prediction) => prediction.direction === recommendedDirection)
    : activePrediction;
  const interval = getServiceInterval(now, day);
  const schedule = activePrediction ? Array.from({ length: 8 }, (_, index) =>
    clockTime(
      new Date(
        now.getTime() +
          (activePrediction.seconds + index * activePrediction.intervalSeconds) *
            1000,
      ),
    ),
  ) : [];
  const favorite = favorites.includes(stationId);
  const isSavedRoute = hasJourney && savedRoutes.some(
    (item) => item.from === stationId && item.to === toId,
  );
  const estimatedArrival = journeyPrediction
    ? clockTime(new Date(now.getTime() + (journeyPrediction.seconds + tripMinutes * 60) * 1000))
    : null;
  const leaveBy = arriveBy && journeyPrediction
    ? subtractMinutes(arriveBy, tripMinutes + Math.max(3, Math.ceil(journeyPrediction.seconds / 60)))
    : null;

  useEffect(() => {
    if (!stationId || !toId) return;
    const journey = getRoute(stationId, toId);
    const nextStation = journey[1] ? STATION_BY_ID[journey[1]] : undefined;
    const currentStation = STATION_BY_ID[stationId];
    if (!currentStation || !nextStation || nextStation.line !== currentStation.line) return;
    const stations = LINE_STATIONS[currentStation.line];
    setDirection(stations.findIndex(({ id }) => id === nextStation.id) > stations.findIndex(({ id }) => id === stationId) ? 1 : 0);
  }, [stationId, toId]);

  const swapStations = () => {
    setStationId(toId);
    setToId(stationId);
  };
  const toggleFavorite = () => setFavorites((items) => favorite ? items.filter((id) => id !== stationId) : [...items, stationId]);
  const toggleSavedRoute = () => {
    if (!hasJourney || stationId === toId) return;
    setSavedRoutes((items) => {
      const key = routeKey(stationId, toId);
      return items.some((item) => routeKey(item.from, item.to) === key)
        ? items.filter((item) => routeKey(item.from, item.to) !== key)
        : [{ from: stationId, to: toId }, ...items].slice(0, 6);
    });
  };
  const findNearest = () => {
    if (!navigator.geolocation) {
      setGeoStatus("error");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setStationId(getNearestStation(coords.latitude, coords.longitude).id);
        setGeoStatus("idle");
      },
      () => setGeoStatus("error"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };
  const enableAlerts = async () => {
    if (!("Notification" in window)) {
      setNotificationStatus("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNotificationStatus("denied");
      return;
    }
    if (alerts[0]) window.localStorage.setItem("metro-kyiv:last-alert-id", alerts[0].id);
    setAlertsEnabled(true);
    setNotificationStatus("idle");
  };
  const markAlertRead = (id: string) => {
    setReadAlertIds((items) => items.includes(id) ? items : [...items, id].slice(-50));
  };
  const markAllAlertsRead = () => {
    setReadAlertIds((items) => [...new Set([...items, ...alerts.map((alert) => alert.id)])].slice(-50));
  };
  const unreadAlertIds = new Set(alerts.filter((alert) => !readAlertIds.includes(alert.id)).map((alert) => alert.id));
  const shareStation = async () => {
    if (!station) return;
    const url = `${window.location.origin}/?station=${stationId}`;
    if (navigator.share) await navigator.share({ title: `Метро Київ — ${station.name}`, url });
    else await navigator.clipboard?.writeText(url);
  };

  return (
    <main className="metro-app">
      <header className="app-header">
        <button className="brand" onClick={() => setView("schedule")} aria-label="Метро Київ, головна">
          <MetroMark /><span><b>Метро Київ</b><small>графік руху</small></span>
        </button>
        <div className="header-actions">
          <div className="live-clock"><i />{kyivFormatter.format(now)}</div>
          <div className="alerts-trigger">
            <button type="button" onClick={() => setIsAlertsOpen((value) => !value)} aria-label="Оперативні зміни метро" aria-expanded={isAlertsOpen}>
              <Bell size={19} />{unreadAlertIds.size > 0 && <i>{unreadAlertIds.size > 9 ? "9+" : unreadAlertIds.size}</i>}
            </button>
            {isAlertsOpen && <AlertsInbox alerts={alerts} error={alertsError} unreadIds={unreadAlertIds} onMarkRead={markAlertRead} onMarkAllRead={markAllAlertsRead} onClose={() => setIsAlertsOpen(false)} />}
          </div>
        </div>
      </header>

      {view === "schedule" && (
        <section className="schedule-view">
          <div className="hero-copy">
            <h1>Маршрут</h1>
          </div>
          <section className="journey-panel" aria-label="Побудова маршруту метро">
            <StationPicker stationId={stationId} onChange={setStationId} label="Звідки" />
            <button className="swap-stations" onClick={swapStations} disabled={!stationId || !toId} aria-label="Поміняти станції місцями"><ArrowUpDown size={18} /></button>
            <StationPicker stationId={toId} onChange={setToId} label="Куди" />
            {hasJourney && <div className="journey-result">
              {stationId === toId ? <b>Ви вже на станції «{station?.name}»</b> : <b>≈ {tripMinutes} хв · {route.length - 1} станцій{transfers ? ` · ${transfers} пересадка` : " · без пересадок"}</b>}
            </div>}
          </section>
          <div className="route-actions">
            <button type="button" onClick={findNearest} disabled={geoStatus === "loading"}>
              <LocateFixed size={15} />{geoStatus === "loading" ? "Шукаємо найближчу…" : "Моя найближча"}
            </button>
            {geoStatus === "error" && <span>Не вдалося визначити геопозицію.</span>}
          </div>
          {savedRoutes.length > 0 && <section className="saved-routes" aria-label="Збережені маршрути">
            <header><p className="eyebrow">Швидко</p><h2>Мої маршрути</h2></header>
            <div>{savedRoutes.map((item) => <button type="button" key={routeKey(item.from, item.to)} onClick={() => { setStationId(item.from); setToId(item.to); }}>
              <span>{STATION_BY_ID[item.from].name}</span><i>→</i><span>{STATION_BY_ID[item.to].name}</span>
            </button>)}</div>
          </section>}
          {hasJourney && station && destination && predictions && activePrediction && <>
            <section className="journey-hero">
              <div><p>Ваша поїздка</p><strong>≈ {tripMinutes} хв</strong><span>прибуття близько <b>{estimatedArrival}</b></span></div>
              <div className="journey-hero__direction"><i style={{ backgroundColor: LINE_META[station.line].color }}>{LINE_META[station.line].code}</i><b>{recommendedDirection ? `До «${recommendedDirection}»` : "Маршрут на цій станції"}</b></div>
              {stationId !== toId && <button type="button" onClick={toggleSavedRoute} aria-pressed={isSavedRoute} aria-label="Зберегти маршрут">{isSavedRoute ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}</button>}
            </section>
            <div className={`directions ${showBoth ? "directions--both" : ""}`}>
              {predictions.map((_, index) => (showBoth || index === direction) && <DirectionCard key={index} station={station} directionIndex={index} active={direction === index} now={now} day={day} onClick={() => setDirection(index)} />)}
            </div>
            <section className="timer-board">
              <p>До відправлення</p>
              <strong>{formatTimer(activePrediction.seconds)}</strong>
              <span>орієнтовно о {activePrediction.clockTime}</span>
              <div className="timer-board__journey">{recommendedDirection ? <>До <b>{destination.name}</b> — сідайте у напрямку <b>«{recommendedDirection}»</b>.</> : stationId === toId ? "Оберіть іншу станцію призначення." : `До ${destination.name}: ≈ ${tripMinutes} хв.`}</div>
              <div className="timer-board__details"><span>{LINE_META[station.line].code}</span><span>{interval.label}</span></div>
            </section>
            {stationId !== toId && <section className="arrive-by-card">
              <div><p className="eyebrow">Поспішаю</p><h2>Треба прибути до</h2></div>
              <label><input type="time" value={arriveBy} onChange={(event) => setArriveBy(event.target.value)} aria-label="Час прибуття" />{leaveBy && <span>Почніть поїздку до <b>{leaveBy}</b></span>}</label>
            </section>}
            <RouteSteps route={route} />
            <button className="open-map-route" type="button" onClick={() => setView("map")}>Показати маршрут на схемі →</button>
            <div className="day-toggle" role="group" aria-label="Тип дня">
              <button className={day === "weekday" ? "is-active" : ""} onClick={() => setDay("weekday")}>Будні</button>
              <button className={day === "weekend" ? "is-active" : ""} onClick={() => setDay("weekend")}>Вихідні</button>
            </div>
            <section className="next-trains">
              <header><div><p className="eyebrow">Наступні</p><h2>Відправлення</h2></div><button onClick={shareStation}>Поділитися</button></header>
              <div className="time-grid">{schedule.map((time, index) => <span className={index === 0 ? "is-next" : ""} key={`${time}-${index}`}>{time}{index === 0 && <small>далі</small>}</span>)}</div>
              <p className="fine-print">Розраховано за офіційними інтервалами, не за live-даними.</p>
            </section>
            <button className="favorite-inline" onClick={toggleFavorite} aria-pressed={favorite}>{favorite ? "★ Станцію збережено" : "☆ Зберегти станцію"}</button>
          </>}
        </section>
      )}

      {view === "map" && <MetroMap route={route} />}

      {view === "about" && <section className="info-page"><p className="eyebrow">Про застосунок</p><h1>Метро Київ — простий спосіб звірити час.</h1><div className="info-card"><h2>Джерело даних</h2><p>Станції, напрямки, режим роботи та інтервали руху отримані з відкритих даних Києва. Інформація завантажується в застосунок і доступна офлайн.</p></div><div className="info-card"><h2>Як працює таймер</h2><p>Це розрахунок до наступного відправлення, який оновлюється щосекунди. Він враховує лінію, напрямок, тип дня та офіційні погодинні інтервали, але не відстежує фактичне положення поїзда.</p></div><div className="info-card warning"><h2>Важливо</h2><p>Під час повітряної тривоги або змін у роботі метро рух може відрізнятися від розрахунку. Орієнтуйтеся на оголошення Київського метрополітену.</p></div></section>}

      {view === "settings" && <section className="settings-page"><p className="eyebrow">Налаштування</p><h1>Підлаштуйте під себе</h1><div className="setting-group"><h2>Тема оформлення</h2><div className="theme-options">{(["light", "dark", "system"] as Theme[]).map((option) => <button className={theme === option ? "is-active" : ""} onClick={() => setTheme(option)} key={option}>{option === "light" ? "☀️ Світла" : option === "dark" ? "☾ Темна" : "◐ Системна"}</button>)}</div></div><div className="setting-row"><div><h2>Таймери в обох напрямках</h2><p>Показувати обидва напрямки на головному екрані одразу.</p></div><button className={`switch ${showBoth ? "is-on" : ""}`} onClick={() => setShowBoth((value) => !value)} aria-pressed={showBoth}><i /></button></div><div className="setting-row"><div><h2>Системні сповіщення</h2><p>{alertsEnabled ? "Увімкнені для нових офіційних повідомлень, поки застосунок відкритий." : notificationStatus === "unsupported" ? "Ваш браузер не підтримує системні сповіщення." : notificationStatus === "denied" ? "Дозвіл вимкнено в браузері." : "Зміни та тривоги завжди доступні через дзвіночок у шапці."}</p></div><button onClick={enableAlerts} disabled={alertsEnabled}>{alertsEnabled ? "Увімкнено" : "Увімкнути"}</button></div><div className="setting-row"><div><h2>Обрані станції</h2><p>{favorites.length ? favorites.map((id) => STATION_BY_ID[id]?.name).join(", ") : "Ще немає збережених станцій."}</p></div><button onClick={() => setFavorites([])} disabled={!favorites.length}>Очистити</button></div><div className="setting-row"><div><h2>Мої маршрути</h2><p>{savedRoutes.length ? `${savedRoutes.length} збережено на цьому пристрої.` : "Збережених маршрутів ще немає."}</p></div><button onClick={() => setSavedRoutes([])} disabled={!savedRoutes.length}>Очистити</button></div><p className="fine-print">Застосунок не передає вашу геолокацію чи маршрути на сервер. Оперативні повідомлення надходять із RSS Київського метрополітену.</p></section>}

      <nav className="bottom-nav" aria-label="Навігація">
        <button className={view === "schedule" ? "is-active" : ""} onClick={() => setView("schedule")}><span><Route size={19} /></span>Маршрут</button>
        <button className={view === "map" ? "is-active" : ""} onClick={() => setView("map")}><span><MapIcon size={19} /></span>Карта</button>
        <button className={view === "about" ? "is-active" : ""} onClick={() => setView("about")}><span><CircleHelp size={19} /></span>Довідка</button>
        <button className={view === "settings" ? "is-active" : ""} onClick={() => setView("settings")}><span><SlidersHorizontal size={19} /></span>Ще</button>
      </nav>
    </main>
  );
}
