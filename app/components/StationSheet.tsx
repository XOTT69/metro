import {
  useEffect,
  useEffectEvent,
  useRef,
} from "react";
import {
  LINE_META,
  getServiceInterval,
  type Station,
} from "../metro-data";
import TimerDirections from "./TimerDirections";

export type StationSheetProps = {
  station: Station;
  favorite: boolean;
  tracked: boolean;
  now: Date;
  onFavorite: () => void;
  onTrack: () => void;
  onUseFrom: () => void;
  onUseTo: () => void;
  onClose: () => void;
};

export default function StationSheet({
  station,
  favorite,
  tracked,
  now,
  onFavorite,
  onTrack,
  onUseFrom,
  onUseTo,
  onClose,
}: StationSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const closeSheet = useEffectEvent(onClose);
  const line = LINE_META[station.line];
  const service = getServiceInterval(now);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSheet();
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;

      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled])',
        ),
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <aside
        ref={sheetRef}
        className="station-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          className="icon-button close-button"
          onClick={onClose}
          aria-label="Закрити інформацію про станцію"
        >
          ×
        </button>
        <div className="station-sheet__line" style={{ color: line.color }}>
          <span>{line.code}</span>
          {line.name} лінія
        </div>
        <h2 id="station-sheet-title">{station.name}</h2>
        <p className="muted">{service.label}</p>
        <TimerDirections station={station} now={now} />

        <div className="station-sheet__actions">
          <button className="primary-button" type="button" onClick={onTrack}>
            {tracked ? "✓ Таймер відстежується" : "◷ Відстежувати таймер"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={onFavorite}
          >
            {favorite ? "★ В обраному" : "☆ Додати в обране"}
          </button>
          <button className="ghost-button" type="button" onClick={onUseFrom}>
            Звідси
          </button>
          <button className="ghost-button" type="button" onClick={onUseTo}>
            Сюди
          </button>
        </div>

        <p className="fine-print">
          Це прогноз за типовим інтервалом, а не дані диспетчерської системи.
          Затримки, повітряна тривога та оперативні зміни тут не враховані.
        </p>
      </aside>
    </div>
  );
}
