import { useEffect, useMemo, useRef, useState } from "react";
import { transitModeLabel, type TransitPlan } from "../transit-router";

function distanceMeters(
  first: { lat: number; lon: number },
  second: { lat: number; lon: number },
) {
  const latScale = 111_320;
  const lonScale = Math.cos(((first.lat + second.lat) * Math.PI) / 360) * 111_320;
  return Math.hypot(
    (first.lat - second.lat) * latScale,
    (first.lon - second.lon) * lonScale,
  );
}

export default function ActiveJourneyPanel({
  plan,
  legIndex,
  startedAt,
  onAdvance,
  onShowMap,
  onFinish,
}: {
  plan: TransitPlan;
  legIndex: number;
  startedAt: number;
  onAdvance: () => void;
  onShowMap: () => void;
  onFinish: () => void;
}) {
  const [, setTick] = useState(0);
  const notifiedLeg = useRef(-1);
  const leg = plan.legs[Math.min(legIndex, plan.legs.length - 1)];
  const lastLeg = legIndex >= plan.legs.length - 1;
  const remainingMinutes = useMemo(
    () =>
      Math.max(
        1,
        Math.round(
          plan.legs
            .slice(legIndex)
            .reduce((sum, item) => sum + item.seconds + item.waitSeconds, 0) /
            60,
        ),
      ),
    [legIndex, plan.legs],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (notifiedLeg.current < 0) {
      notifiedLeg.current = legIndex;
      return;
    }
    if (notifiedLeg.current === legIndex) return;
    notifiedLeg.current = legIndex;
    navigator.vibrate?.(120);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(lastLeg ? "Фінальний етап поїздки" : "Наступний етап", {
        body: leg.route
          ? `${transitModeLabel(leg.mode)} ${leg.route.short}: до ${leg.to.name}`
          : `Прямуйте пішки до ${leg.to.name}`,
        icon: "/metro-logo.svg",
      });
    }
  }, [lastLeg, leg, legIndex]);

  useEffect(() => {
    if (!navigator.geolocation || lastLeg) return;
    const watch = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (
          distanceMeters(
            { lat: coords.latitude, lon: coords.longitude },
            leg.to,
          ) <= 100
        ) {
          onAdvance();
        }
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 12_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [lastLeg, leg.to, onAdvance]);

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - startedAt) / 60_000));
  return (
    <section className="transport-active-journey" aria-live="polite">
      <header>
        <div>
          <small>Поїздка триває · {elapsedMinutes} хв</small>
          <strong>≈ {remainingMinutes} хв залишилося</strong>
        </div>
        <button type="button" onClick={onFinish}>Завершити</button>
      </header>
      <div className="transport-journey-progress" aria-label={`Етап ${legIndex + 1} з ${plan.legs.length}`}>
        <i style={{ width: `${((legIndex + 1) / plan.legs.length) * 100}%` }} />
      </div>
      <div className="transport-current-step">
        <span style={{ background: leg.route?.color || "#61716a" }}>
          {leg.route?.short || "↟"}
        </span>
        <div>
          <small>{leg.route ? transitModeLabel(leg.mode) : "Пішки"}</small>
          <h2>
            {leg.route
              ? `Сідайте на ${leg.route.short}`
              : `Прямуйте до ${leg.to.name}`}
          </h2>
          <p>
            {leg.from.name} → <strong>{leg.to.name}</strong>
          </p>
        </div>
      </div>
      <div className="transport-next-stop">
        <span>{lastLeg ? "Фініш" : "Наступна контрольна точка"}</span>
        <strong>{leg.to.name}</strong>
        <small>
          ≈ {Math.max(1, Math.round((leg.seconds + leg.waitSeconds) / 60))} хв
          {leg.stops > 1 ? ` · ${leg.stops} зуп.` : ""}
        </small>
      </div>
      <div className="transport-journey-actions">
        <button type="button" onClick={onShowMap}>⌖ Показати на карті</button>
        <button type="button" className="is-primary" onClick={lastLeg ? onFinish : onAdvance}>
          {lastLeg ? "Я прибув" : "Наступний етап →"}
        </button>
      </div>
    </section>
  );
}
