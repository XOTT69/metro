import type {
  TransitCoordinate,
  TransitPlan,
  TransitRouteProfile,
} from "../transit-router";
import type { SavedPlaceKind, SavedPlaces } from "./hooks/useSavedPlaces";
import AddressField from "./AddressField";
import { PlanDetails, PlanServices } from "./PlanDetails";

function formatClock(minute: number) {
  const normalized = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
    normalized % 60,
  ).padStart(2, "0")}`;
}

export type TransitPlanPanelProps = {
  fromPoint: TransitCoordinate | null;
  toPoint: TransitCoordinate | null;
  regionRouteRequested: boolean;
  planning: boolean;
  journeyTimeMode: "depart" | "arrive";
  journeyTime: string;
  selectedMinute: number;
  plans: TransitPlan[];
  activePlan: TransitPlan | null;
  activePlanIndex: number;
  routeProfile: TransitRouteProfile;
  hasFavoriteRoutes: boolean;
  savedPlaces: SavedPlaces;
  onFromSelect: (point: TransitCoordinate) => void;
  onToSelect: (point: TransitCoordinate) => void;
  onSwap: () => void;
  onLocate: () => void;
  onStartPicking: (target: "from" | "to") => void;
  onPlanSelect: (index: number) => void;
  onRouteProfileChange: (profile: TransitRouteProfile) => void;
  onJourneyTimeModeChange: (mode: "depart" | "arrive") => void;
  onJourneyTimeChange: (time: string) => void;
  onStartJourney: () => void;
  onSavePlace: (kind: SavedPlaceKind, point: TransitCoordinate) => void;
  onRemovePlace: (kind: SavedPlaceKind) => void;
  onError: (message: string) => void;
};

export default function TransitPlanPanel({
  fromPoint,
  toPoint,
  regionRouteRequested,
  planning,
  journeyTimeMode,
  journeyTime,
  selectedMinute,
  plans,
  activePlan,
  activePlanIndex,
  routeProfile,
  hasFavoriteRoutes,
  savedPlaces,
  onFromSelect,
  onToSelect,
  onSwap,
  onLocate,
  onStartPicking,
  onPlanSelect,
  onRouteProfileChange,
  onJourneyTimeModeChange,
  onJourneyTimeChange,
  onStartJourney,
  onSavePlace,
  onRemovePlace,
  onError,
}: TransitPlanPanelProps) {
  return (
    <div className="transport-plan-panel">
      <div className="transport-address-card">
        <AddressField
          marker="A"
          label="Звідки"
          point={fromPoint}
          placeholder="Адреса, зупинка або місто"
          onSelect={onFromSelect}
          onError={onError}
        />
        <button
          type="button"
          className="transport-swap"
          onClick={onSwap}
          aria-label="Поміняти адреси місцями"
        >
          ⇅
        </button>
        <AddressField
          marker="Б"
          label="Куди"
          point={toPoint}
          placeholder="Куди потрібно доїхати"
          onSelect={onToSelect}
          onError={onError}
        />
        <div className="transport-address-actions">
          <button type="button" onClick={onLocate}>◎ Моє місце</button>
          <button
            type="button"
            onClick={() => onStartPicking(fromPoint ? "to" : "from")}
          >
            ⌖ Вказати на карті
          </button>
        </div>
      </div>

      <section className="transport-saved-places" aria-labelledby="saved-places-title">
        <div className="transport-saved-places__heading">
          <div>
            <span>Швидкий старт</span>
            <h2 id="saved-places-title">Мої місця</h2>
          </div>
          <small>зберігаються лише тут</small>
        </div>
        <div className="transport-saved-places__grid">
          {(
            [
              ["home", "⌂", "Дім", savedPlaces.home],
              ["work", "▣", "Робота", savedPlaces.work],
            ] as const
          ).map(([kind, icon, label, place]) => (
            <article key={kind} className={place ? "is-ready" : ""}>
              <span aria-hidden="true">{icon}</span>
              <div>
                <small>{label}</small>
                <strong>{place?.name || "Ще не задано"}</strong>
              </div>
              {place ? (
                <div className="transport-saved-places__actions">
                  <button
                    type="button"
                    onClick={() => onFromSelect(place)}
                    aria-label={`Взяти ${label} як точку А`}
                    title="Точка А"
                  >
                    А
                  </button>
                  <button
                    type="button"
                    onClick={() => onToSelect(place)}
                    aria-label={`Взяти ${label} як точку Б`}
                    title="Точка Б"
                  >
                    Б
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemovePlace(kind)}
                    aria-label={`Видалити місце ${label}`}
                    title="Видалити"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <small className="transport-saved-places__hint">Оберіть адресу нижче</small>
              )}
            </article>
          ))}
        </div>
        <div className="transport-saved-places__save">
          <button
            type="button"
            disabled={!fromPoint}
            onClick={() => fromPoint && onSavePlace("home", fromPoint)}
          >
            ⌂ Дім ← точка А
          </button>
          <button
            type="button"
            disabled={!toPoint}
            onClick={() => toPoint && onSavePlace("work", toPoint)}
          >
            ▣ Робота ← точка Б
          </button>
        </div>
      </section>

      <div className="transport-time-planner">
        <div role="radiogroup" aria-label="Час поїздки">
          <button type="button" role="radio" aria-checked={journeyTimeMode === "depart"} className={journeyTimeMode === "depart" ? "is-active" : ""} onClick={() => onJourneyTimeModeChange("depart")}>
            Виїхати
          </button>
          <button type="button" role="radio" aria-checked={journeyTimeMode === "arrive"} className={journeyTimeMode === "arrive" ? "is-active" : ""} onClick={() => onJourneyTimeModeChange("arrive")}>
            Прибути до
          </button>
        </div>
        <label>
          <span>Час</span>
          <input type="time" value={journeyTime} onChange={(event) => onJourneyTimeChange(event.target.value)} />
        </label>
      </div>

      <div className="transport-route-profiles" role="radiogroup" aria-label="Пріоритет маршруту">
        {(
          [
            ["fastest", "⚡", "Найшвидше"],
            ["fewest-transfers", "⇄", "Менше пересадок"],
            ["less-walking", "◌", "Менше пішки"],
            ["favorites", "★", "Мій транспорт"],
          ] as const
        ).map(([profile, icon, label]) => (
          <button
            type="button"
            role="radio"
            aria-checked={routeProfile === profile}
            aria-label={label}
            className={routeProfile === profile ? "is-active" : ""}
            onClick={() => onRouteProfileChange(profile)}
            title={
              profile === "favorites" && !hasFavoriteRoutes
                ? "Додайте маршрути в обране у вкладці «Транспорт»"
                : label
            }
            key={profile}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
            {profile === "favorites" && hasFavoriteRoutes && <i />}
          </button>
        ))}
      </div>

      {regionRouteRequested && fromPoint && toPoint && (
        <div className="transport-region-note is-compact" role="status">
          <span>Київська область</span>
          <p>
            Приміська ділянка — за офіційним реєстром перевізників; час та
            інтервал орієнтовні. Міська частина використовує GTFS.
          </p>
        </div>
      )}

      {!fromPoint || !toPoint ? (
        <div className="transport-empty">
          <span>↗</span>
          <h2>{!fromPoint ? "Оберіть точку старту" : "Куди їдемо?"}</h2>
          <p>
            Введіть адресу або виберіть точку на карті. Після другої точки
            варіанти з’являться автоматично.
          </p>
        </div>
      ) : planning ? (
        <div className="transport-empty" role="status">
          <span className="transport-planning-spinner" />
          <h2>Шукаємо найкращі варіанти…</h2>
          <p>Маршрутизація виконується окремо, карта залишається плавною.</p>
        </div>
      ) : plans.length ? (
        <>
          <div className="transport-results-heading">
            <span>
              {routeProfile === "fastest"
                ? "Найшвидші варіанти"
                : routeProfile === "fewest-transfers"
                  ? "Мінімум пересадок"
                  : routeProfile === "less-walking"
                    ? "Мінімум ходьби"
                    : "З урахуванням обраного"}
            </span>
            <strong>
              {activePlan?.totalMinutes
                ? `≈ ${activePlan.totalMinutes} хв`
                : "Маршрут"}
            </strong>
          </div>
          <div className="transport-plan-options">
            {plans.map((plan, index) => (
              <button
                type="button"
                key={`${plan.totalMinutes}-${index}`}
                className={activePlanIndex === index ? "is-active" : ""}
                onClick={() => onPlanSelect(index)}
              >
                <em>{index === 0 ? "Рекомендовано" : `Варіант ${index + 1}`}</em>
                <PlanServices plan={plan} />
                <span>
                  {plan.transfers ? `${plan.transfers} перес.` : "без пересадок"}
                  {" · "}
                  пішки {plan.walkMinutes} хв
                </span>
                <strong>{plan.totalMinutes}<small> хв</small></strong>
              </button>
            ))}
          </div>
          {activePlan && (
            <>
              <div className="transport-trip-summary">
                <div>
                  <small>Прибуття</small>
                  <strong>
                    {formatClock(
                      journeyTimeMode === "depart"
                        ? selectedMinute + activePlan.totalMinutes
                        : selectedMinute,
                    )}
                  </strong>
                </div>
                <div>
                  <small>Пересадки</small>
                  <strong>{activePlan.transfers}</strong>
                </div>
                <div>
                  <small>Пішки</small>
                  <strong>{activePlan.walkMinutes} хв</strong>
                </div>
              </div>
              <button type="button" className="transport-start-journey" onClick={onStartJourney}>
                <span aria-hidden="true">▶</span>
                <span><strong>Почати поїздку</strong><small>Навігація, GPS-прогрес і сповіщення</small></span>
              </button>
              <PlanDetails
                plan={activePlan}
                startMinute={
                  journeyTimeMode === "depart"
                    ? selectedMinute
                    : selectedMinute - activePlan.totalMinutes
                }
              />
            </>
          )}
        </>
      ) : (
        <div className="transport-empty">
          <span>!</span>
          <h2>Маршрут не знайдено</h2>
          <p>Спробуйте сусідню адресу або точку на карті.</p>
        </div>
      )}
    </div>
  );
}
