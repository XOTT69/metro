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
  return (
    <ol className="transport-journey">
      <li className="is-endpoint is-start">
        <span>А</span>
        <div>
          <small>Початок</small>
          <strong>{plan.from.name}</strong>
        </div>
      </li>
      {plan.legs.map((leg, index) => (
        <li key={`${leg.from.id}-${leg.to.id}-${index}`}>
          <span
            className="transport-journey-mode"
            style={{ background: leg.route?.color || MODE_COLOR.walk }}
          >
            {leg.route?.short || MODE_ICON.walk}
          </span>
          <div>
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
