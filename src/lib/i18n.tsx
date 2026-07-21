import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { lines, stationById } from '../data/metro'
import type { LineId, Station } from '../types'
import { useStoredState } from './storage'

export type Language = 'uk' | 'en'

const uk = {
  appName: 'Метро Києва',
  appTagline: 'маршрути та схема',
  homeAria: 'На головну',
  install: 'Встановити',
  installApp: 'Встановити застосунок',
  themeLight: 'Світла тема',
  themeDark: 'Темна тема',
  themeSystem: 'Системна тема',
  offlineBanner: 'Офлайн-режим: схема й маршрути продовжують працювати',
  coordinatesOfficial: 'Координати КМДА оновлено',
  coordinatesLoading: 'Оновлюємо дані…',
  coordinatesOffline: 'Офлайн-дані',
  whereTo: 'Куди їдемо?',
  routeIntro: 'Маршрут між усіма 52 станціями з пересадками та орієнтовним часом у дорозі.',
  from: 'Звідки',
  to: 'Куди',
  swapStations: 'Поміняти станції місцями',
  locating: 'Шукаємо…',
  nearestStation: 'Найближча станція',
  showOnMap: 'Показати на схемі',
  quickRoutes: 'Швидкі маршрути',
  home: 'Дім',
  goHome: 'Додому',
  work: 'Робота',
  goWork: 'На роботу',
  chooseStation: 'Обрати станцію',
  stationNotSelected: 'Станцію не вибрано',
  repeatQuickly: 'Швидко повторити',
  recentRoutes: 'Недавні маршрути',
  clear: 'Очистити',
  quickAccess: 'Швидкий доступ',
  favoriteStations: 'Обрані станції',
  all: 'Усі',
  towards: 'до',
  currentRoute: 'Поточний маршрут',
  openRoute: 'Відкрити маршрут',
  yourStations: 'Ваші станції',
  favorites: 'Обране',
  favoritesIntro: 'Зберігайте станції, якими користуєтесь найчастіше.',
  personalization: 'Персоналізація',
  homeAndWork: 'Дім і робота',
  homeAndWorkIntro: 'Оберіть найближчі станції для маршрутів в один дотик.',
  intervalNow: 'інтервал зараз',
  routeFromHere: 'Звідси',
  routeToHere: 'Сюди',
  removeFavorite: 'Видалити з обраного',
  noFavorites: 'Обраних станцій ще немає',
  noFavoritesIntro: 'Відкрийте станцію на схемі та натисніть зірочку.',
  openMap: 'Відкрити схему',
  aboutData: 'Про дані',
  aboutDataText: 'Назви, структура мережі та координати базуються на відкритих даних Києва. Інтервали й час маршруту розрахункові, а не live. «Метро Києва» — незалежний сервіс і не є офіційним застосунком Київського метрополітену.',
  navRoute: 'Маршрут',
  navMap: 'Схема',
  navFavorites: 'Обране',
  navTourist: 'Місця',
  mainNavigation: 'Основна навігація',
  chooseDeparture: 'Оберіть станцію відправлення',
  chooseDestination: 'Оберіть станцію призначення',
  chooseHome: 'Оберіть станцію біля дому',
  chooseWork: 'Оберіть станцію біля роботи',
  updateAvailable: 'Доступне оновлення',
  newVersionReady: 'Нова версія вже готова',
  update: 'Оновити',
  copied: 'Посилання скопійовано',
  offlineReady: 'Застосунок готовий працювати без інтернету',
  geolocationUnsupported: 'Геолокація не підтримується браузером',
  geolocationFailed: 'Не вдалося отримати геолокацію',
  nearestIs: 'Найближча станція',
  installed: 'Застосунок встановлено',
  iosInstall: 'На iPhone: Поділитися → На початковий екран',
  metroRouteShare: 'Маршрут метро',
  approximately: 'приблизно',
  language: 'Мова',
  switchToEnglish: 'Switch to English',
  switchToUkrainian: 'Перемкнути українською',
  kyivMetro: 'Київський метрополітен',
  allStations: 'Усі станції',
  stationSearchPlaceholder: 'Назва українською або англійською',
  clearSearch: 'Очистити пошук',
  lineFilter: 'Фільтр за лінією',
  transfer: 'Пересадка',
  stationNotFound: 'Станцію не знайдено',
  stationNotFoundIntro: 'Перевірте написання або виберіть іншу лінію.',
  resetFilters: 'Скинути фільтри',
  closeCatalog: 'Закрити каталог',
  close: 'Закрити',
  stationNamePlaceholder: 'Назва станції',
  allStationsGroup: 'Усі станції',
  station: 'Станція',
  back: 'Назад',
  addFavorite: 'Додати в обране',
  shareStation: 'Поділитися станцією',
  routeFromStation: 'Маршрут звідси',
  routeToStation: 'Маршрут сюди',
  trainMovement: 'Рух поїздів',
  nextTrain: 'Наступний поїзд',
  calculated: 'Розрахунок',
  inDirection: 'У напрямку',
  typicalInterval: 'типовий інтервал зараз',
  terminalStation: 'Кінцева станція',
  reverseDirection: 'Рух у зворотному напрямку',
  timersWarning: 'Таймери не є live-відстеженням. Вони розраховані за типовими інтервалами та можуть відрізнятися від фактичного руху.',
  onLine: 'На лінії',
  neighbouringStations: 'Сусідні станції',
  previous: 'Попередня',
  next: 'Наступна',
  lineStart: 'Початок лінії',
  lineEnd: 'Кінець лінії',
  interchange: 'Перехід',
  transfers: 'Пересадки',
  location: 'Розташування',
  stationOnMap: 'Станція на мапі',
  openCoordinates: 'Відкрити координати',
  stationData: 'Про дані станції',
  stationDataText: 'Назва, лінія, порядок і координати зберігаються для офлайн-роботи. Розрахункові інтервали не замінюють офіційні оперативні повідомлення метрополітену.',
  startTrip: 'Почати поїздку',
  share: 'Поділитися',
  routeMode: 'Режим побудови маршруту',
  fastest: 'Найшвидший',
  fastestHint: 'Мінімальний час у дорозі',
  fewerTransfers: 'Менше пересадок',
  fewerTransfersHint: 'Простіший маршрут, іноді довший',
  routeStats: 'Параметри маршруту',
  arrivalAt: 'Прибуття о',
  changeTo: 'Пересісти на',
  transitionAbout: 'Перехід приблизно',
  directionTo: 'У напрямку',
  estimatedTimeNote: 'Час орієнтовний і враховує середній рух та переходи між лініями.',
  activeTrip: 'Активна поїздка',
  finishTrip: 'Завершити поїздку',
  routeProgress: 'маршруту',
  arrived: 'Прибули',
  left: 'залишилось',
  finalStation: 'Кінцева станція',
  youAreHere: 'Ви зараз тут',
  arrivedAt: 'Ви прибули на станцію',
  continueRoute: 'Продовжуйте за маршрутом',
  goToStation: 'Перейдіть до станції',
  rideTowards: 'Їдьте в напрямку',
  untilStation: 'до',
  nextOnRoute: 'Далі за маршрутом',
  stage: 'Етап',
  of: 'із',
  nextLower: 'наступна',
  manualTripNote: 'Перемикайте станції вручну. Застосунок не відстежує рух поїзда в реальному часі.',
  finish: 'Завершити',
  nextStationAction: 'Наступна станція',
  interactiveMap: 'Інтерактивна схема',
  mapGestureHint: 'Перетягуйте схему, масштабуйте колесом або двома пальцями.',
  focusRoute: 'Маршрут',
  mapScale: 'Масштаб карти',
  zoomOut: 'Зменшити',
  zoomIn: 'Збільшити',
  showFullMap: 'Показати всю схему',
  mapLines: 'Лінії метро',
  allLines: 'Уся схема',
  stationsOnLine: 'Станції лінії',
  selectStationHint: 'Натисніть на станцію',
  touristEyebrow: 'Київ для гостей',
  touristTitle: 'Популярні місця поруч із метро',
  touristIntro: 'Оберіть пам’ятку, побудуйте маршрут до найближчої станції та відкрийте пішохідну точку на мапі.',
  touristSearch: 'Пошук місця',
  touristAll: 'Усі місця',
  touristHistory: 'Історія',
  touristParks: 'Парки',
  touristCulture: 'Культура',
  touristViews: 'Краєвиди',
  touristNear: 'Найближча станція',
  touristWalk: 'пішки',
  buildRoute: 'Побудувати маршрут',
  stationDetails: 'Про станцію',
  openPlaceMap: 'Відкрити місце на мапі',
  touristNoResults: 'Місць за цим запитом не знайдено',
  touristNoteTitle: 'Перед відвідуванням',
  touristNote: 'Графік роботи, доступність і правила відвідування можуть змінюватися. Перевіряйте офіційні сторінки конкретного місця.',
  independentService: 'Незалежний неофіційний сервіс',
  stationsLauncher: 'Станції',
} as const

const en: Record<keyof typeof uk, string> = {
  appName: 'Kyiv Metro', appTagline: 'routes and map', homeAria: 'Home', install: 'Install', installApp: 'Install app',
  themeLight: 'Light theme', themeDark: 'Dark theme', themeSystem: 'System theme',
  offlineBanner: 'Offline mode: the map and route planner are still available', coordinatesOfficial: 'Kyiv open-data coordinates updated', coordinatesLoading: 'Updating data…', coordinatesOffline: 'Offline data',
  whereTo: 'Where are you going?', routeIntro: 'Plan a route between all 52 stations with transfers and an estimated travel time.',
  from: 'From', to: 'To', swapStations: 'Swap stations', locating: 'Locating…', nearestStation: 'Nearest station', showOnMap: 'Show on map', quickRoutes: 'Quick routes',
  home: 'Home', goHome: 'Go home', work: 'Work', goWork: 'Go to work', chooseStation: 'Choose station', stationNotSelected: 'No station selected',
  repeatQuickly: 'Repeat quickly', recentRoutes: 'Recent routes', clear: 'Clear', quickAccess: 'Quick access', favoriteStations: 'Favorite stations', all: 'All', towards: 'to',
  currentRoute: 'Current route', openRoute: 'Open route', yourStations: 'Your stations', favorites: 'Favorites', favoritesIntro: 'Save the stations you use most often.',
  personalization: 'Personalization', homeAndWork: 'Home and work', homeAndWorkIntro: 'Choose nearby stations for one-tap routes.', intervalNow: 'current interval', routeFromHere: 'From here', routeToHere: 'To here', removeFavorite: 'Remove from favorites',
  noFavorites: 'No favorite stations yet', noFavoritesIntro: 'Open a station on the map and tap the star.', openMap: 'Open map', aboutData: 'About the data',
  aboutDataText: 'Station names, network structure and coordinates are based on Kyiv open data. Headways and journey times are estimates, not live tracking. Kyiv Metro is an independent service and is not an official Kyiv Metro app.',
  navRoute: 'Route', navMap: 'Map', navFavorites: 'Favorites', navTourist: 'Places', mainNavigation: 'Main navigation',
  chooseDeparture: 'Choose departure station', chooseDestination: 'Choose destination station', chooseHome: 'Choose a station near home', chooseWork: 'Choose a station near work',
  updateAvailable: 'Update available', newVersionReady: 'A new version is ready', update: 'Update', copied: 'Link copied', offlineReady: 'The app is ready to work offline',
  geolocationUnsupported: 'Geolocation is not supported by this browser', geolocationFailed: 'Unable to get your location', nearestIs: 'Nearest station', installed: 'App installed', iosInstall: 'On iPhone: Share → Add to Home Screen',
  metroRouteShare: 'Metro route', approximately: 'about', language: 'Language', switchToEnglish: 'Switch to English', switchToUkrainian: 'Switch to Ukrainian',
  kyivMetro: 'Kyiv Metro', allStations: 'All stations', stationSearchPlaceholder: 'Name in Ukrainian or English', clearSearch: 'Clear search', lineFilter: 'Filter by line', transfer: 'Transfer',
  stationNotFound: 'Station not found', stationNotFoundIntro: 'Check the spelling or choose another line.', resetFilters: 'Reset filters', closeCatalog: 'Close station catalog', close: 'Close', stationNamePlaceholder: 'Station name', allStationsGroup: 'All stations',
  station: 'Station', back: 'Back', addFavorite: 'Add to favorites', shareStation: 'Share station', routeFromStation: 'Route from here', routeToStation: 'Route to here',
  trainMovement: 'Train service', nextTrain: 'Next train', calculated: 'Estimate', inDirection: 'Towards', typicalInterval: 'typical current interval', terminalStation: 'Terminus', reverseDirection: 'Service in the opposite direction',
  timersWarning: 'Timers are not live tracking. They are calculated from typical headways and may differ from actual service.', onLine: 'On this line', neighbouringStations: 'Neighboring stations', previous: 'Previous', next: 'Next', lineStart: 'Start of line', lineEnd: 'End of line',
  interchange: 'Interchange', transfers: 'Transfers', location: 'Location', stationOnMap: 'Station on the map', openCoordinates: 'Open coordinates', stationData: 'About station data',
  stationDataText: 'The station name, line, order and coordinates are stored for offline use. Estimated headways do not replace official service alerts.',
  startTrip: 'Start trip', share: 'Share', routeMode: 'Route preference', fastest: 'Fastest', fastestHint: 'Minimum travel time', fewerTransfers: 'Fewer transfers', fewerTransfersHint: 'Simpler route, sometimes longer',
  routeStats: 'Route details', arrivalAt: 'Arrival at', changeTo: 'Change to', transitionAbout: 'Transfer about', directionTo: 'Towards', estimatedTimeNote: 'Travel time is an estimate based on typical running and transfer times.',
  activeTrip: 'Active trip', finishTrip: 'End trip', routeProgress: 'of route', arrived: 'Arrived', left: 'left', finalStation: 'Final station', youAreHere: 'You are here', arrivedAt: 'You have arrived at', continueRoute: 'Continue along the route', goToStation: 'Walk to station', rideTowards: 'Ride towards', untilStation: 'to', nextOnRoute: 'Next on your route', stage: 'Step', of: 'of', nextLower: 'next', manualTripNote: 'Advance stations manually. The app does not track the train in real time.', finish: 'Finish', nextStationAction: 'Next station',
  interactiveMap: 'Interactive map', mapGestureHint: 'Drag the map and zoom with the mouse wheel or two fingers.', focusRoute: 'Route', mapScale: 'Map scale', zoomOut: 'Zoom out', zoomIn: 'Zoom in', showFullMap: 'Show the full map', mapLines: 'Metro lines', allLines: 'Full map', stationsOnLine: 'Stations on line', selectStationHint: 'Tap a station',
  touristEyebrow: 'Kyiv for visitors', touristTitle: 'Popular places near the metro', touristIntro: 'Choose a landmark, build a route to the nearest station and open the walking destination on the map.', touristSearch: 'Search places', touristAll: 'All places', touristHistory: 'History', touristParks: 'Parks', touristCulture: 'Culture', touristViews: 'Views', touristNear: 'Nearest station', touristWalk: 'walk', buildRoute: 'Build route', stationDetails: 'Station details', openPlaceMap: 'Open place on map', touristNoResults: 'No places match this search', touristNoteTitle: 'Before you visit', touristNote: 'Opening hours, accessibility and visitor rules may change. Check the official page of the place before visiting.', independentService: 'Independent unofficial service', stationsLauncher: 'Stations',
}

export type TranslationKey = keyof typeof uk

interface LanguageContextValue {
  language: Language
  locale: 'uk-UA' | 'en-GB'
  setLanguage: (language: Language) => void
  toggleLanguage: () => void
  t: (key: TranslationKey) => string
  stationName: (station?: Station | null) => string
  lineName: (lineId: LineId) => string
  terminalName: (lineId: LineId, edge: 'start' | 'end') => string
  minuteLabel: string
  stationCount: (count: number) => string
  transferCount: (count: number) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const initialLanguage = (): Language => {
  const query = new URL(window.location.href).searchParams.get('lang')
  if (query === 'en' || query === 'uk') return query
  return navigator.language.toLocaleLowerCase().startsWith('uk') ? 'uk' : 'en'
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useStoredState<Language>('metro-language', initialLanguage())
  const locale = language === 'uk' ? 'uk-UA' : 'en-GB'

  useEffect(() => {
    document.documentElement.lang = language
    const url = new URL(window.location.href)
    if (language === 'uk') url.searchParams.delete('lang')
    else url.searchParams.set('lang', language)
    window.history.replaceState(null, '', url)
  }, [language])

  const value = useMemo<LanguageContextValue>(() => {
    const dictionary = language === 'uk' ? uk : en
    const stationName = (station?: Station | null) => station ? (language === 'uk' ? station.name : station.nameEn) : ''
    const terminalName = (lineId: LineId, edge: 'start' | 'end') => {
      const line = lines[lineId]
      const stationId = edge === 'start' ? line.stationIds[0] : line.stationIds[line.stationIds.length - 1]
      return stationName(stationById.get(stationId))
    }
    return {
      language,
      locale,
      setLanguage,
      toggleLanguage: () => setLanguage(language === 'uk' ? 'en' : 'uk'),
      t: (key) => dictionary[key],
      stationName,
      lineName: (lineId) => language === 'uk' ? lines[lineId].name : lines[lineId].nameEn,
      terminalName,
      minuteLabel: language === 'uk' ? 'хв' : 'min',
      stationCount: (count) => {
        if (language === 'en') return `${count} ${count === 1 ? 'station' : 'stations'}`
        const lastTwo = count % 100
        const last = count % 10
        const noun = lastTwo >= 11 && lastTwo <= 14 ? 'станцій' : last === 1 ? 'станція' : last >= 2 && last <= 4 ? 'станції' : 'станцій'
        return `${count} ${noun}`
      },
      transferCount: (count) => {
        if (language === 'en') return count === 0 ? 'No transfers' : `${count} ${count === 1 ? 'transfer' : 'transfers'}`
        if (count === 0) return 'Без пересадок'
        return count === 1 ? '1 пересадка' : `${count} пересадки`
      },
    }
  }, [language, locale, setLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export const useLanguage = () => {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider')
  return value
}
