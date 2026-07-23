import type { TransportAlert } from "./model";

export type TransitAlertsPanelProps = {
  alerts: TransportAlert[];
  enabled: boolean;
  onEnable: () => void;
};

export default function TransitAlertsPanel({
  alerts,
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
          <div className="transport-empty">
            <h2>Оновлень поки немає</h2>
            <p>Нові повідомлення міста з’являться тут автоматично.</p>
          </div>
        )}
      </div>
    </div>
  );
}
