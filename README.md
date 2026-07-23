# Metro Kyiv

Встановлюваний статичний офлайн-планувальник поїздок Київським
метрополітеном. Застосунок збирається у звичайний каталог `dist` і не потребує
серверного runtime.

[Відкрити Metro Kyiv](https://metro-kyiv.pages.dev/)

## Можливості

- усі 52 чинні станції трьох ліній;
- найкоротший маршрут, пересадки, кількість станцій та орієнтовний час;
- інтерактивна SVG-схема з підсвічуванням маршруту;
- масштабована SVG-схема з рознесеними підписами та чіткими пересадками;
- секундний розрахунковий таймер у двох напрямках для кожної станції;
- постійно відстежувана станція, пошук і таймери всіх 52 станцій;
- обрані станції та тема в `localStorage`;
- найближча станція за геолокацією;
- посилання на маршрут через `?from=…&to=…`;
- PWA-маніфест, service worker та офлайн-навігація;
- уточнення координат з офіційного GeoJSON API Києва з локальним fallback;
- клавіатурна навігація та `prefers-reduced-motion`.

Таймер використовує оприлюднені містом типові інтервали: у будні
2:30–3:30 хв у пікові години та 5–6 хв у міжпік, у вихідні — 6–7 хв.
Це розрахунок, а не оперативні дані диспетчерської системи.

## Локальний запуск

Потрібен Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Production-перевірка:

```bash
npm run lint
npm run typecheck
npm run test:model
npm run test:ui
npm run check:production
npm test
```

`npm run lint` запускає ESLint для TypeScript, React Hooks, Cloudflare
Functions і Node-скриптів. `npm run typecheck` перевіряє весь `app/**`,
`src/**` та `functions/**`.

Компонентні тести запускаються через Vitest + React Testing Library у
jsdom. Окремо перевіряються станційні поля, обидва напрямки таймера,
керування відстежуваною станцією та focus-trap модального вікна.

## GitHub і Cloudflare Pages

GitHub workflow `Production quality` запускає lint/typecheck, build,
bundle-check, smoke та Lighthouse.

Cloudflare Pages підключений до GitHub напряму і не потребує API-токена в
репозиторії. Налаштування Pages:

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

Після push у `main` Cloudflare сам збирає та публікує нову версію на
`https://metro-kyiv.pages.dev`.

### Змінні середовища

`REALTIME_UPSTREAM_URL` — необов’язковий URL офіційного GTFS Realtime
upstream. Якщо змінну не задано, застосунок використовує поточний сумісний
hostname із коду. Її можна додати в Cloudflare Pages → Settings →
Environment variables без зберігання токенів у GitHub.

Усі запити до зовнішніх джерел мають 7-секундний timeout. Geocoder
ідентифікує застосунок через `User-Agent` і `Referer`, кешує результати на
edge та показує атрибуцію OpenStreetMap.

## Дані

Координати уточнюються з відкритого шару «Станції Київського метрополітену»
порталу даних Києва. Якщо API недоступний, застосунок використовує локальні
координати. Таймер наступного поїзда є розрахунковим і не показує оперативні
затримки.
