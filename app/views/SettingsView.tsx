import type { Theme } from "../app-types";

export type SettingsViewProps = {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onInstall: () => void;
};

export default function SettingsView({
  theme,
  onThemeChange,
  onInstall,
}: SettingsViewProps) {
  return (
    <section className="settings-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow-label">Під вас</span>
          <h1>Налаштування</h1>
          <p>Усе зберігається лише на цьому пристрої.</p>
        </div>
      </div>
      <div className="settings-card">
        <h2>Тема оформлення</h2>
        <div className="theme-switcher" role="radiogroup" aria-label="Тема оформлення">
          {(
            [
              ["light", "☀ Світла"],
              ["dark", "☾ Темна"],
              ["system", "◐ Системна"],
            ] as [Theme, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              role="radio"
              aria-checked={theme === id}
              className={theme === id ? "is-active" : ""}
              onClick={() => onThemeChange(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="settings-card">
        <h2>Як працює таймер</h2>
        <p>
          Це математичний прогноз, синхронізований із поточним часом,
          напрямком, положенням станції на лінії та типовим інтервалом.
          Він не підключений до диспетчерської системи.
        </p>
        <p>
          Використані актуальні публічні інтервали: 2:30–3:30 у будні в
          години пік, 5–6 хв у міжпік та 6–7 хв у вихідні.
        </p>
        <a
          className="source-link"
          href="https://kyivcity.gov.ua/news/minulogo_tizhnya_stolichnim_metro_skoristalisya_ponad_51_milyona_pasazhiriv_iz_yakikh_mayzhe_14_milyona__pilgoviki/"
          target="_blank"
          rel="noreferrer"
        >
          Джерело інтервалів: Портал Києва ↗
        </a>
      </div>
      <div className="settings-card">
        <h2>Карта та дані</h2>
        <p>
          Координати автоматично уточнюються з відкритого GeoJSON API Києва;
          без мережі використовується локальний набір. Геолокація потрібна
          лише для пошуку найближчої станції й нікуди не надсилається.
        </p>
        <div className="source-list">
          <a href="https://guide.kyivcity.gov.ua/faq/karta-metro" target="_blank" rel="noreferrer">
            Kyiv City Guide ↗
          </a>
          <a
            href="https://a3.kyiv.ua/projects/metromap/license/assets/metromap_wagon_660x690_v1.8.8.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Вагонна схема «Агенти змін» ↗
          </a>
          <a href="https://inmetro.pp.ua/uk/Kyiv.php" target="_blank" rel="noreferrer">
            Інтерактивний довідник inMetro ↗
          </a>
        </div>
      </div>
      <div className="settings-card">
        <h2>Наземний транспорт і сповіщення</h2>
        <p>
          158 маршрутів і 1447 зупинок зібрано з офіційного GTFS Static
          Київпастрансу. Живі позиції надходять із GTFS Realtime та
          оновлюються кожні 30 секунд.
        </p>
        <p>
          Транспортні зміни беруться з офіційного каналу КМДА. Фонові
          перевірки доступні після встановлення PWA у браузерах, що
          підтримують Periodic Background Sync.
        </p>
        <div className="source-list">
          <a
            href="https://data.kyivcity.gov.ua/dataset/rozklad-rukhu-miskoho-elektrychnoho-ta-avtomobilnoho-transportu-dep-transport"
            target="_blank"
            rel="noreferrer"
          >
            GTFS і розклади Києва ↗
          </a>
          <a
            href="https://data.kyivcity.gov.ua/dataset/dani-pro-mistseznakhodzhennia-miskoho-elektrychnoho-ta-pasazhyrskoho-avtomobilnoho-tra-dep-transport"
            target="_blank"
            rel="noreferrer"
          >
            Транспорт наживо ↗
          </a>
          <a href="https://t.me/KyivCityOfficial" target="_blank" rel="noreferrer">
            Офіційний канал КМДА ↗
          </a>
        </div>
      </div>
      <div className="settings-card">
        <h2>Встановити Metro Kyiv</h2>
        <p>
          Після встановлення застосунок відкривається з домашнього екрана,
          пам’ятає обрані станції та працює без інтернету.
        </p>
        <button className="primary-button" onClick={onInstall}>
          Встановити PWA
        </button>
      </div>
    </section>
  );
}
