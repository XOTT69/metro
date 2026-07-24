import { LINE_META, STATION_BY_ID, type LineId } from "../metro-data";
import { RouteItinerary, RouteJourney } from "../components/RouteDetails";
import MetroTripAssistant from "../components/MetroTripAssistant";
import StationSelect from "../components/StationSelect";
import type { GeoStatus } from "../app-types";

const LINE_IDS: LineId[] = ["red", "blue", "green"];

export type PlannerViewProps = {
  from: string;
  to: string;
  route: string[];
  tripMinutes: number;
  transfers: number;
  saved: boolean;
  geoStatus: GeoStatus;
  onFromChange: (id: string) => void;
  onToChange: (id: string) => void;
  onSwap: () => void;
  onFindNearest: () => void;
  onOpenMap: () => void;
  onShare: () => void;
  onSave: () => void;
  onStation: (id: string) => void;
};

export default function PlannerView({
  from,
  to,
  route,
  tripMinutes,
  transfers,
  saved,
  geoStatus,
  onFromChange,
  onToChange,
  onSwap,
  onFindNearest,
  onOpenMap,
  onShare,
  onSave,
  onStation,
}: PlannerViewProps) {
  const stationsCount = Math.max(0, route.length - 1);

  return (
    <div className="workspace">
      <section className="planner-panel">
        <div className="eyebrow">
          <span>52 станції</span>
          <span>3 лінії</span>
          <span>оновлені назви</span>
        </div>
        <h1>
          Маршрут Києвом
          <br />
          без <em>метушні.</em>
        </h1>
        <p className="intro">
          Оберіть станції — побачите найкоротший шлях, пересадки, час і
          зрозумілу схему поїздки.
        </p>

        <div className="route-form">
          <div className="route-dot route-dot--from" />
          <StationSelect label="Звідки" value={from} onChange={onFromChange} />
          <button
            className="swap-button"
            onClick={onSwap}
            aria-label="Поміняти станції місцями"
          >
            ⇅
          </button>
          <div className="route-dot route-dot--to" />
          <StationSelect label="Куди" value={to} onChange={onToChange} />
          <button className="nearest-button" onClick={onFindNearest}>
            ◎ {geoStatus === "loading" ? "Визначаємо…" : "Моя найближча станція"}
          </button>
        </div>

        <section className="route-summary" aria-live="polite">
          <div className="summary-main">
            <span>Орієнтовна поїздка</span>
            <strong>≈ {tripMinutes} хв</strong>
          </div>
          <div className="summary-stats">
            <div>
              <strong>{stationsCount}</strong>
              <span>перегонів</span>
            </div>
            <div>
              <strong>{transfers}</strong>
              <span>{transfers === 1 ? "пересадка" : "пересадки"}</span>
            </div>
            <div>
              <strong>{route.length}</strong>
              <span>точок маршруту</span>
            </div>
          </div>
          <div className="route-actions">
            <button className="primary-button" onClick={onOpenMap}>
              Відкрити велику схему
            </button>
            <button className="secondary-button" onClick={onShare}>
              Поділитися
            </button>
            <button
              className="secondary-button route-save-button"
              onClick={onSave}
              aria-pressed={saved}
            >
              {saved ? "★ Збережено" : "☆ Зберегти"}
            </button>
          </div>
          <details className="route-details">
            <summary>Усі станції маршруту</summary>
            <RouteItinerary route={route} onStation={onStation} />
          </details>
        </section>

        <MetroTripAssistant
          route={route}
          tripMinutes={tripMinutes}
          onStation={onStation}
        />
      </section>

      <section className="map-panel">
        <div className="map-panel__header">
          <div>
            <span className="eyebrow-label">Поїздка крок за кроком</span>
            <h2>
              {STATION_BY_ID[from].name} → {STATION_BY_ID[to].name}
            </h2>
          </div>
          <div className="map-legend">
            {LINE_IDS.map((line) => (
              <span key={line}>
                <i style={{ background: LINE_META[line].color }} />
                {LINE_META[line].code}
              </span>
            ))}
          </div>
        </div>
        <RouteJourney route={route} onStation={onStation} />
        <div className="map-caption">
          <span>Маршрут розкладено за лініями та пересадками</span>
          <strong>Натисніть назву станції — відкриється її таймер</strong>
        </div>
      </section>
    </div>
  );
}
