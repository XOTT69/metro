import type { TransportAlert } from "./model";

export type TransitAlertsPanelProps = {
  alerts: TransportAlert[];
  error: boolean;
  enabled: boolean;
  onEnable: () => void;
};

export default function TransitAlertsPanel({
  alerts,
  error,
  enabled,
  onEnable,
}: TransitAlertsPanelProps) {
  return (
    <div className="transport-alerts-panel">
      <div className="transport-section-heading">
        <div>
          <small>Оперативно від міста</small>
          <h2>Зміни руху</h2>
        </div>
        <button
          type="button"
          className={enabled ? "is-enabled" : ""}
          onClick={onEnable}
        >
          {enabled ? "✓ Увімкнено" : "Сповіщати"}
        </button>
      </div>
      <div className="transport-alert-list">
        {alerts.length ? (
          alerts.map((alert) => (
            <a key={alert.id} href={alert.url} target="_blank" rel="noreferrer">
              <span>{alert.source}</span>
              <strong>{alert.title}</strong>
              <p>{alert.text}</p>
              <small>
                {new Date(alert.publishedAt).toLocaleString("uk-UA", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · відкрити ↗
              </small>
            </a>
          ))
        ) : (
          <div className="transport-empty" role={error ? "status" : undefined}>
            <h2>
              {error ? "Не вдалося оновити зміни" : "Оновлень поки немає"}
            </h2>
            <p>
              {error
                ? "Перевірте з’єднання. Ми спробуємо ще раз автоматично."
                : "Нові повідомлення міста з’являться тут автоматично."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
