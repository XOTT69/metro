import { transitModeLabel, type TransitPlan } from "../transit-router";
import { MODE_COLOR, MODE_ICON } from "./display";

export function PlanServices({ plan }: { plan: TransitPlan }) {
  return (
    <div className="transport-plan-services" aria-label="Транспорт у маршруті">
      {plan.legs
        .filter((leg) => leg.route)
        .map((leg, index) => (
          <span
            key={`${leg.route!.id}-${index}`}
            style={{ background: leg.route!.color }}
          >
            {leg.route!.short}
          </span>
        ))}
      {!plan.legs.some((leg) => leg.route) && <span>Пішки</span>}
    </div>
  );
}

export function PlanDetails({ plan }: { plan: TransitPlan }) {
  const journeyLegs = plan.legs.reduce<
    {
      leg: TransitPlan["legs"][number];
      index: number;
      isTransfer: boolean;
      transferNumber: number;
      latestRouteId: string | null;
    }[]
  >((items, leg, index) => {
    const previous = items.at(-1);
    const latestRouteId = previous?.latestRouteId || null;
    const isTransfer = Boolean(
      leg.route && latestRouteId && leg.route.id !== latestRouteId,
    );
    return [
      ...items,
      {
        leg,
        index,
        isTransfer,
        transferNumber:
          (previous?.transferNumber || 0) + (isTransfer ? 1 : 0),
        latestRouteId: leg.route?.id || latestRouteId,
      },
    ];
  }, []);
  return (
    <ol className="transport-journey">
      <li className="is-endpoint is-start">
        <span>А</span>
        <div>
          <small>Початок</small>
          <strong>{plan.from.name}</strong>
        </div>
      </li>
      {journeyLegs.map(({ leg, index, isTransfer, transferNumber }) => (
        <li
          className={isTransfer ? "is-transfer" : undefined}
          key={`${leg.from.id}-${leg.to.id}-${index}`}
        >
          <span
            className="transport-journey-mode"
            style={{ background: leg.route?.color || MODE_COLOR.walk }}
          >
            {leg.route?.short || MODE_ICON.walk}
          </span>
          <div>
            {isTransfer && (
              <em className="transport-transfer-label">
                Пересадка {transferNumber}
              </em>
            )}
            <small>
              {leg.route
                ? `${transitModeLabel(leg.mode)} · ${leg.route.long}`
                : "Пішки"}
            </small>
            <strong>
              {leg.from.name} → {leg.to.name}
            </strong>
            <span>
              ≈ {Math.max(1, Math.round((leg.seconds + leg.waitSeconds) / 60))} хв
              {leg.route && leg.stops > 1 ? ` · ${leg.stops} зуп.` : ""}
            </span>
          </div>
        </li>
      ))}
      <li className="is-endpoint is-finish">
        <span>Б</span>
        <div>
          <small>Фініш</small>
          <strong>{plan.to.name}</strong>
        </div>
      </li>
    </ol>
  );
}
