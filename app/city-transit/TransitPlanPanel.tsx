import type { TransitCoordinate, TransitPlan } from "../transit-router";
import AddressField from "./AddressField";
import { PlanDetails, PlanServices } from "./PlanDetails";

export type TransitPlanPanelProps = {
  fromPoint: TransitCoordinate | null;
  toPoint: TransitCoordinate | null;
  regionRouteRequested: boolean;
  plans: TransitPlan[];
  activePlan: TransitPlan | null;
  activePlanIndex: number;
  onFromSelect: (point: TransitCoordinate) => void;
  onToSelect: (point: TransitCoordinate) => void;
  onSwap: () => void;
  onLocate: () => void;
  onStartPicking: (target: "from" | "to") => void;
  onPlanSelect: (index: number) => void;
  onError: (message: string) => void;
};

export default function TransitPlanPanel({
  fromPoint,
  toPoint,
  regionRouteRequested,
  plans,
  activePlan,
  activePlanIndex,
  onFromSelect,
  onToSelect,
  onSwap,
  onLocate,
  onStartPicking,
  onPlanSelect,
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

      {!fromPoint || !toPoint ? (
        <div className="transport-empty">
          <span>↗</span>
          <h2>{!fromPoint ? "Оберіть точку старту" : "Куди їдемо?"}</h2>
          <p>
            Введіть адресу або виберіть точку на карті. Після другої точки
            варіанти з’являться автоматично.
          </p>
        </div>
      ) : regionRouteRequested ? (
        <div className="transport-region-note">
          <span>Київська область</span>
          <h2>Адресу знайдено, але маршрут не вигадуємо</h2>
          <p>
            Для поїздок областю потрібні офіційні розклади приміських
            перевізників. Карта й пошук області працюють, а неточний розрахунок
            часу ми свідомо не показуємо.
          </p>
        </div>
      ) : plans.length ? (
        <>
          <div className="transport-results-heading">
            <span>Знайдено {plans.length} варіанти</span>
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
                    {new Date(
                      Date.now() + activePlan.totalMinutes * 60_000,
                    ).toLocaleTimeString("uk-UA", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
              <PlanDetails plan={activePlan} />
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
