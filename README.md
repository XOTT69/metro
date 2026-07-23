# Metro Kyiv

Встановлюваний статичний офлайн-планувальник поїздок Київським
метрополітеном. Застосунок збирається у звичайний каталог `dist` і не потребує
серверного runtime.

[Відкрити Metro Kyiv](https://metro-kyiv.pages.dev/)

## Можливості

- усі 52 чинні станції трьох ліній;
- найкоротший маршрут, пересадки, кількість станцій та орієнтовний час;
- інтерактивна SVG-схема з підсвічуванням маршруту;
- сторінка-картка станції з розрахунковим таймером у двох напрямках;
- обрані станції та тема в `localStorage`;
- найближча станція за геолокацією;
- посилання на маршрут через `?from=…&to=…`;
- PWA-маніфест, service worker та офлайн-навігація;
- уточнення координат з офіційного GeoJSON API Києва з локальним fallback;
- клавіатурна навігація та `prefers-reduced-motion`.

## Локальний запуск

Потрібен Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Production-перевірка:

```bash
npm run check:production
npm test
```

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

## Дані

Координати уточнюються з відкритого шару «Станції Київського метрополітену»
порталу даних Києва. Якщо API недоступний, застосунок використовує локальні
координати. Таймер наступного поїзда є розрахунковим і не показує оперативні
затримки.
