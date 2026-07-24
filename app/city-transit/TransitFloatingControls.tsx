import type { CSSProperties } from "react";
import { LINE_META, type LineId } from "../metro-data";
import {
  transitModeLabel,
  type TransitNetworkData,
  type TransitPlan,
} from "../transit-router";
import type { PanelTab } from "./model";

export default function TransitFloatingControls({
  panelOpen,
  panelTab,
  pickingPoint,
  mapPointTarget,
  selectedRoute,
  selectedRouteVehicleCount,
  selectedMetroLine,
  favoriteRoutes,
  journeyActive,
  activePlan,
  journeyLegIndex,
  alertsCount,
  onPanel,
  onMap,
  onCancelPicking,
  onFavorite,
  onClearRoute,
  onClearMetro,
}: {
  panelOpen: boolean;
  panelTab: PanelTab;
  pickingPoint: boolean;
  mapPointTarget: "from" | "to";
  selectedRoute: TransitNetworkData["routes"][number] | null;
  selectedRouteVehicleCount: number;
  selectedMetroLine: LineId | null;
  favoriteRoutes: string[];
  journeyActive: boolean;
  activePlan: TransitPlan | null;
  journeyLegIndex: number;
  alertsCount: number;
  onPanel: (tab: PanelTab) => void;
  onMap: () => void;
  onCancelPicking: () => void;
  onFavorite: (routeId: string) => void;
  onClearRoute: () => void;
  onClearMetro: () => void;
}) {
  const activeLeg = activePlan?.legs[journeyLegIndex];
  const remainingMinutes = activePlan
    ? Math.max(
        1,
        Math.round(
          activePlan.legs
            .slice(journeyLegIndex)
            .reduce((sum, leg) => sum + leg.seconds + leg.waitSeconds, 0) / 60,
        ),
      )
    : 0;
  return (
    <>
      {!panelOpen && (
        <button type="button" className="transport-panel-reopen" onClick={() => onPanel(panelTab)}>
          <span>☰</span>
          <strong>{panelTab === "plan" ? "Маршрут" : panelTab === "catalog" ? "Транспорт" : "Зміни"}</strong>
        </button>
      )}
      {pickingPoint && (
        <div className="transport-picking-banner">
          <strong>Точка {mapPointTarget === "from" ? "А" : "Б"}</strong>
          <span>Торкніться потрібного місця на карті</span>
          <button type="button" onClick={onCancelPicking}>Скасувати</button>
        </div>
      )}
      {(selectedRoute || selectedMetroLine) && !panelOpen && (
        <div className="transport-selected-card">
          {selectedRoute ? (
            <>
              <span style={{ background: `#${selectedRoute[4]}` }}>{selectedRoute[1]}</span>
              <div>
                <small>{transitModeLabel(selectedRoute[3])} · {selectedRouteVehicleCount ? `${selectedRouteVehicleCount} на карті` : "маршрут"}</small>
                <strong>{selectedRoute[2]}</strong>
              </div>
              <div className="transport-selected-card-actions">
                <button type="button" onClick={() => onFavorite(selectedRoute[0])} aria-label={favoriteRoutes.includes(selectedRoute[0]) ? "Видалити маршрут з обраного" : "Додати маршрут в обране"}>
                  {favoriteRoutes.includes(selectedRoute[0]) ? "★" : "☆"}
                </button>
                <button type="button" onClick={onClearRoute} aria-label="Закрити вибраний маршрут">×</button>
              </div>
            </>
          ) : (
            <>
              <span style={{ background: LINE_META[selectedMetroLine!].color }}>{LINE_META[selectedMetroLine!].code}</span>
              <div><small>Метрополітен</small><strong>{LINE_META[selectedMetroLine!].name}</strong></div>
              <div className="transport-selected-card-actions"><button type="button" onClick={onClearMetro} aria-label="Закрити лінію метро">×</button></div>
            </>
          )}
        </div>
      )}
      {journeyActive && activePlan && activeLeg && !panelOpen && (
        <button type="button" className="transport-active-mini" onClick={() => onPanel("plan")}>
          <span style={{ background: activeLeg.route?.color || "#61716a" } as CSSProperties}>{activeLeg.route?.short || "↟"}</span>
          <span><small>Наступна точка</small><strong>{activeLeg.to.name}</strong></span>
          <b>≈ {remainingMinutes} хв</b>
        </button>
      )}
      <nav className="transport-bottom-nav" aria-label="Навігація транспортом">
        <button type="button" className={!panelOpen ? "is-active" : ""} onClick={onMap}><span>⌖</span>Карта</button>
        {([ ["plan", "↗", "Маршрут"], ["catalog", "≋", "Транспорт"], ["alerts", "!", "Зміни"] ] as const).map(([tab, icon, label]) => (
          <button type="button" className={panelTab === tab && panelOpen ? "is-active" : ""} onClick={() => onPanel(tab)} key={tab}>
            <span>{icon}</span>{label}{tab === "alerts" && alertsCount > 0 && <i>{alertsCount}</i>}
          </button>
        ))}
      </nav>
    </>
  );
}
