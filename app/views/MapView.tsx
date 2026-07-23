import MetroMap from "../components/MetroMap";
import OfficialMapViewer from "../components/OfficialMapViewer";
import StationSelect from "../components/StationSelect";

export type MapViewProps = {
  from: string;
  to: string;
  route: string[];
  tripMinutes: number;
  transfers: number;
  onFromChange: (id: string) => void;
  onToChange: (id: string) => void;
  onSwap: () => void;
  onBack: () => void;
  onStation: (id: string) => void;
};

export default function MapView({
  from,
  to,
  route,
  tripMinutes,
  transfers,
  onFromChange,
  onToChange,
  onSwap,
  onBack,
  onStation,
}: MapViewProps) {
  return (
    <section className="full-map-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow-label">Висока якість · актуальна версія</span>
          <h1>Чітка схема метро</h1>
          <p>
            Повна вагонна карта у високій роздільності. Збільшуйте її до 250% —
            назви не накладаються і залишаються читабельними.
          </p>
        </div>
        <button className="primary-button" onClick={onBack}>
          ← До маршруту
        </button>
      </div>
      <div className="full-map-routebar">
        <StationSelect compact label="Звідки" value={from} onChange={onFromChange} />
        <button type="button" onClick={onSwap} aria-label="Поміняти станції місцями">
          ⇄
        </button>
        <StationSelect compact label="Куди" value={to} onChange={onToChange} />
        <span>≈ {tripMinutes} хв · {transfers} перес.</span>
      </div>
      <OfficialMapViewer />
      <details className="interactive-map-details">
        <summary>
          <span>
            <strong>Інтерактивний маршрут</strong>
            <small>Станції без підписів поверх ліній — назва показується окремо</small>
          </span>
          <span aria-hidden="true">Розгорнути ↓</span>
        </summary>
        <div className="interactive-map-frame">
          <MetroMap route={route} onStation={onStation} />
        </div>
      </details>
    </section>
  );
}
