import { useState } from "react";
import { usePinchPanZoom } from "../use-pinch-pan-zoom";

export default function OfficialMapViewer() {
  const [zoom, setZoom] = useState(1);
  const mapGesture = usePinchPanZoom(zoom, setZoom, 1, 2.5);

  return (
    <section className="official-map" aria-labelledby="official-map-title">
      <div className="official-map__toolbar">
        <div>
          <span className="eyebrow-label">Вагонна схема · 2024</span>
          <strong id="official-map-title">Карта високої якості</strong>
        </div>
        <div className="official-map__actions" aria-label="Керування картою">
          <button
            type="button"
            onClick={() => setZoom(mapGesture.clampZoom(zoom - 0.25))}
            aria-label="Зменшити карту"
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom(mapGesture.clampZoom(zoom + 0.25))}
            aria-label="Збільшити карту"
          >
            +
          </button>
          <button type="button" onClick={() => setZoom(1)}>
            Вписати
          </button>
          <a href="/kyiv-metro-map-v1.12.3.pdf" target="_blank" rel="noreferrer">
            PDF ↗
          </a>
        </div>
      </div>
      <div
        className="official-map__scroll"
        ref={mapGesture.scrollRef}
        {...mapGesture.pointerHandlers}
        aria-label="Схема метро. Розведіть два пальці, щоб збільшити; зведіть, щоб зменшити."
      >
        <img
          src="/kyiv-metro-map-v1.12.3.png"
          alt="Повна схема Київського метро та швидкісного транспорту, версія 1.12.3 за 2024 рік"
          width="5717"
          height="5977"
          style={{ width: `${zoom * 100}%` }}
        />
      </div>
      <p className="official-map__credit">
        Схема{" "}
        <a
          href="https://a3.kyiv.ua/projects/metromap/"
          target="_blank"
          rel="noreferrer"
        >
          «Агентів змін»
        </a>
        , версія 1.12.3. Відтворена без змін для некомерційного використання.
      </p>
    </section>
  );
}
