# Метро Києва

**Metro Kyiv** — встановлюваний вебзастосунок для планування поїздок Київським метрополітеном. Працює на телефоні та комп'ютері, підтримує офлайн-режим і не потребує власного сервера для базового функціоналу.

> Незалежний сервіс. Не є офіційним застосунком Київського метрополітену.

## Що вже реалізовано

- усі 52 чинні станції трьох ліній;
- найкоротший маршрут із пересадками;
- орієнтовний час поїздки та кількість станцій;
- інтерактивна SVG-схема з підсвічуванням маршруту;
- сторінки станцій і розрахунковий таймер наступного поїзда;
- обрані станції в `localStorage`;
- пошук найближчої станції за геолокацією;
- світла, темна та системна тема;
- поширення маршруту через посилання;
- встановлення як PWA та робота без інтернету;
- автоматичне уточнення координат з офіційного GeoJSON API Києва з локальним fallback;
- клавіатурна навігація, керування фокусом і підтримка зменшеної анімації;
- автоматичні Lighthouse, bundle і production smoke-перевірки.

> Таймери та час у дорозі зараз є розрахунковими. Застосунок не заявляє live-позицію поїздів.

## Локальний запуск

```bash
npm install
npm run dev
```

Production-перевірка:

```bash
npm run typecheck
npm run validate:data
npm run build
npm run validate:dist
npm run preview
```

Перевірка вже розгорнутого сайту:

```bash
npm run smoke:production -- https://example.pages.dev/
```

Smoke-тест перевіряє HTML-оболонку, JavaScript і CSS, маніфест, Service Worker, `version.json`, юридичні сторінки, `robots.txt` та ключові deep links.

## Деплой

### Рекомендовано: Cloudflare Pages

Рекомендована назва Cloudflare-проєкту — `metro-kyiv`. Базова адреса матиме вигляд `metro-kyiv.pages.dev`, якщо вона доступна.

Налаштування проєкту:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js: `22`

Для автоматичної перевірки Cloudflare-деплою створіть у GitHub repository variable `PRODUCTION_URL` і вкажіть повну адресу Pages-проєкту. Workflow **Production smoke** також можна запустити вручну з будь-якою URL.

### GitHub Pages

У репозиторії є workflow `.github/workflows/deploy-pages.yml`. Після злиття в `main`:

1. відкрийте **Settings → Pages**;
2. у **Build and deployment → Source** виберіть **GitHub Actions**;
3. запустіть workflow або зробіть push у `main`.

Адреса: `https://xott69.github.io/metro/`.

Після успішного workflow **Deploy PWA to GitHub Pages** автоматично запускається **Production smoke**. Якщо `PRODUCTION_URL` не задано, перевіряється GitHub Pages-адреса.

### Vercel

Також працює без додаткового налаштування:

- Framework: `Vite`
- Build command: `npm run build`
- Output: `dist`

## Версія збірки

Перед `dev` і `build` скрипт `scripts/generate-version.mjs` створює `version.json` з:

- версією з `package.json`;
- коротким SHA коміту;
- часом створення збірки.

Цей файл використовується production-smoke тестом, тому застарілий або неповний деплой не може пройти перевірку.

## Релізи

Тег у форматі `vX.Y.Z` запускає `.github/workflows/release.yml`. Workflow:

1. звіряє тег із версією `package.json`;
2. запускає типізацію, перевірку всіх маршрутів, build і bundle validation;
3. створює ZIP production-збірки;
4. додає SHA-256 файл;
5. публікує GitHub Release з автоматично сформованими нотатками.

## Структура

```text
src/
  components/          UI-компоненти
  data/metro.ts        станції, лінії та резервні координати
  lib/metro.ts         граф, Dijkstra, інтервали, геолокація
  lib/officialData.ts  інтеграція з відкритими даними Києва
public/                іконки PWA та заголовки кешування
scripts/               data, build, Lighthouse і production smoke-перевірки
```

## Джерело даних

Застосунок використовує відкритий ArcGIS-шар КМДА «Станції Київського метрополітену (точкові)»:

`https://gisserver.kyivcity.gov.ua/mayno/rest/services/KYIV_API/transport_public/MapServer/4`

Під час недоступності API застосунок продовжує працювати з вбудованим набором даних.
