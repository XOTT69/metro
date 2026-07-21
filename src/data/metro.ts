import type { LineId, MetroLine, Station } from '../types'

const s = (
  id: string,
  code: string,
  name: string,
  nameEn: string,
  line: LineId,
  order: number,
  lat: number,
  lng: number,
  mapX: number,
  mapY: number,
  transferTo?: string[],
  accessible = false,
): Station => ({ id, code, name, nameEn, line, order, lat, lng, mapX, mapY, transferTo, accessible })

export const stations: Station[] = [
  s('akademmistechko', 'M1-01', 'Академмістечко', 'Akademmistechko', 'M1', 0, 50.4648, 30.3551, 72, 322, undefined, true),
  s('zhytomyrska', 'M1-02', 'Житомирська', 'Zhytomyrska', 'M1', 1, 50.4561, 30.3653, 112, 322, undefined, true),
  s('sviatoshyn', 'M1-03', 'Святошин', 'Sviatoshyn', 'M1', 2, 50.4578, 30.3907, 152, 322),
  s('nyvky', 'M1-04', 'Нивки', 'Nyvky', 'M1', 3, 50.4587, 30.4041, 192, 322),
  s('beresteiska', 'M1-05', 'Берестейська', 'Beresteiska', 'M1', 4, 50.4592, 30.4192, 232, 322),
  s('shuliavska', 'M1-06', 'Шулявська', 'Shuliavska', 'M1', 5, 50.4548, 30.4454, 272, 322),
  s('politekhnichnyi-instytut', 'M1-07', 'Політехнічний інститут', 'Politekhnichnyi Instytut', 'M1', 6, 50.4508, 30.4662, 312, 322),
  s('vokzalna', 'M1-08', 'Вокзальна', 'Vokzalna', 'M1', 7, 50.4413, 30.4899, 352, 322),
  s('universytet', 'M1-09', 'Університет', 'Universytet', 'M1', 8, 50.4442, 30.506, 392, 322),
  s('teatralna', 'M1-10', 'Театральна', 'Teatralna', 'M1', 9, 50.4452, 30.518, 432, 286, ['zoloti-vorota']),
  s('khreshchatyk', 'M1-11', 'Хрещатик', 'Khreshchatyk', 'M1', 10, 50.4472, 30.5229, 478, 246, ['maidan-nezalezhnosti']),
  s('arsenalna', 'M1-12', 'Арсенальна', 'Arsenalna', 'M1', 11, 50.443, 30.5453, 526, 220),
  s('dnipro', 'M1-13', 'Дніпро', 'Dnipro', 'M1', 12, 50.4411, 30.559, 572, 202),
  s('hidropark', 'M1-14', 'Гідропарк', 'Hidropark', 'M1', 13, 50.4459, 30.5768, 618, 202),
  s('livoberezhna', 'M1-15', 'Лівобережна', 'Livoberezhna', 'M1', 14, 50.4519, 30.5981, 664, 202, undefined, true),
  s('darnytsia', 'M1-16', 'Дарниця', 'Darnytsia', 'M1', 15, 50.4557, 30.6132, 710, 202),
  s('chernihivska', 'M1-17', 'Чернігівська', 'Chernihivska', 'M1', 16, 50.4599, 30.6305, 756, 202),
  s('lisova', 'M1-18', 'Лісова', 'Lisova', 'M1', 17, 50.4645, 30.645, 802, 202, undefined, true),

  s('heroiv-dnipra', 'M2-01', 'Героїв Дніпра', 'Heroiv Dnipra', 'M2', 0, 50.5227, 30.498, 480, 42),
  s('minska', 'M2-02', 'Мінська', 'Minska', 'M2', 1, 50.5122, 30.4985, 480, 76),
  s('obolon', 'M2-03', 'Оболонь', 'Obolon', 'M2', 2, 50.5015, 30.4982, 480, 110),
  s('pochaina', 'M2-04', 'Почайна', 'Pochaina', 'M2', 3, 50.486, 30.4979, 480, 144, undefined, true),
  s('tarasa-shevchenka', 'M2-05', 'Тараса Шевченка', 'Tarasa Shevchenka', 'M2', 4, 50.473, 30.5053, 480, 176),
  s('kontraktova-ploshcha', 'M2-06', 'Контрактова площа', 'Kontraktova Ploshcha', 'M2', 5, 50.4661, 30.5149, 480, 204),
  s('poshtova-ploshcha', 'M2-07', 'Поштова площа', 'Poshtova Ploshcha', 'M2', 6, 50.4593, 30.5249, 480, 226),
  s('maidan-nezalezhnosti', 'M2-08', 'Майдан Незалежності', 'Maidan Nezalezhnosti', 'M2', 7, 50.4492, 30.524, 488, 254, ['khreshchatyk']),
  s('ploshcha-ukrainskykh-heroiv', 'M2-09', 'Площа Українських Героїв', 'Ploshcha Ukrainskykh Heroiv', 'M2', 8, 50.4396, 30.5168, 462, 332, ['palats-sportu']),
  s('olimpiiska', 'M2-10', 'Олімпійська', 'Olimpiiska', 'M2', 9, 50.4311, 30.5169, 462, 368),
  s('palats-ukraina', 'M2-11', 'Палац «Україна»', 'Palats Ukraina', 'M2', 10, 50.4207, 30.5204, 462, 404),
  s('lybidska', 'M2-12', 'Либідська', 'Lybidska', 'M2', 11, 50.413, 30.5248, 462, 440),
  s('demiivska', 'M2-13', 'Деміївська', 'Demiivska', 'M2', 12, 50.4048, 30.5169, 462, 476, undefined, true),
  s('holosiivska', 'M2-14', 'Голосіївська', 'Holosiivska', 'M2', 13, 50.3975, 30.5083, 462, 512, undefined, true),
  s('vasylkivska', 'M2-15', 'Васильківська', 'Vasylkivska', 'M2', 14, 50.3934, 30.4882, 462, 548, undefined, true),
  s('vystavkovyi-tsentr', 'M2-16', 'Виставковий центр', 'Vystavkovyi Tsentr', 'M2', 15, 50.3822, 30.4776, 462, 584, undefined, true),
  s('ipodrom', 'M2-17', 'Іподром', 'Ipodrom', 'M2', 16, 50.3766, 30.4688, 462, 620, undefined, true),
  s('teremky', 'M2-18', 'Теремки', 'Teremky', 'M2', 17, 50.3671, 30.4543, 462, 656, undefined, true),

  s('syrets', 'M3-01', 'Сирець', 'Syrets', 'M3', 0, 50.4763, 30.4309, 120, 76, undefined, true),
  s('dorohozhychi', 'M3-02', 'Дорогожичі', 'Dorohozhychi', 'M3', 1, 50.4737, 30.4494, 170, 108, undefined, true),
  s('lukianivska', 'M3-03', 'Лук’янівська', 'Lukianivska', 'M3', 2, 50.462, 30.4819, 220, 140),
  s('zoloti-vorota', 'M3-04', 'Золоті ворота', 'Zoloti Vorota', 'M3', 3, 50.448, 30.5133, 440, 294, ['teatralna']),
  s('palats-sportu', 'M3-05', 'Палац спорту', 'Palats Sportu', 'M3', 4, 50.4384, 30.5209, 474, 342, ['ploshcha-ukrainskykh-heroiv']),
  s('klovska', 'M3-06', 'Кловська', 'Klovska', 'M3', 5, 50.4369, 30.5317, 522, 354),
  s('pecherska', 'M3-07', 'Печерська', 'Pecherska', 'M3', 6, 50.4274, 30.5389, 568, 370),
  s('zvirynetska', 'M3-08', 'Звіринецька', 'Zvirynetska', 'M3', 7, 50.418, 30.5454, 612, 390),
  s('vydubychi', 'M3-09', 'Видубичі', 'Vydubychi', 'M3', 8, 50.402, 30.5605, 654, 416, undefined, true),
  s('slavutych', 'M3-10', 'Славутич', 'Slavutych', 'M3', 9, 50.3942, 30.6047, 690, 450, undefined, true),
  s('osokorky', 'M3-11', 'Осокорки', 'Osokorky', 'M3', 10, 50.3953, 30.6162, 724, 482, undefined, true),
  s('pozniaky', 'M3-12', 'Позняки', 'Pozniaky', 'M3', 11, 50.3981, 30.6334, 758, 514, undefined, true),
  s('kharkivska', 'M3-13', 'Харківська', 'Kharkivska', 'M3', 12, 50.4007, 30.6522, 792, 546, undefined, true),
  s('vyrlytsia', 'M3-14', 'Вирлиця', 'Vyrlytsia', 'M3', 13, 50.4034, 30.666, 826, 578, undefined, true),
  s('boryspilska', 'M3-15', 'Бориспільська', 'Boryspilska', 'M3', 14, 50.4033, 30.684, 860, 610, undefined, true),
  s('chervonyi-khutir', 'M3-16', 'Червоний хутір', 'Chervonyi Khutir', 'M3', 15, 50.4095, 30.6962, 894, 642, undefined, true),
]

const ids = (line: LineId) => stations.filter((station) => station.line === line).sort((a, b) => a.order - b.order).map((station) => station.id)

export const lines: Record<LineId, MetroLine> = {
  M1: {
    id: 'M1',
    name: 'Святошинсько-Броварська',
    nameEn: 'Sviatoshynsko-Brovarska',
    color: '#e63946',
    terminalStart: 'Академмістечко',
    terminalEnd: 'Лісова',
    stationIds: ids('M1'),
    segmentMinutes: [2.2, 2.5, 2.1, 2.4, 2.8, 2.3, 2.6, 2.2, 1.8, 1.9, 2.4, 2.2, 2.6, 2.4, 2.1, 2.5, 2.2],
  },
  M2: {
    id: 'M2',
    name: 'Оболонсько-Теремківська',
    nameEn: 'Obolonsko-Teremkivska',
    color: '#2563eb',
    terminalStart: 'Героїв Дніпра',
    terminalEnd: 'Теремки',
    stationIds: ids('M2'),
    segmentMinutes: [2.2, 2.1, 2.7, 2.2, 2.1, 1.8, 1.9, 2.4, 1.8, 2.1, 2.2, 2.0, 2.0, 2.5, 2.4, 2.0, 2.4],
  },
  M3: {
    id: 'M3',
    name: 'Сирецько-Печерська',
    nameEn: 'Syretsko-Pecherska',
    color: '#16a34a',
    terminalStart: 'Сирець',
    terminalEnd: 'Червоний хутір',
    stationIds: ids('M3'),
    segmentMinutes: [2.4, 2.8, 3.3, 2.0, 1.8, 2.1, 2.0, 2.7, 3.0, 1.8, 2.2, 2.4, 2.1, 2.4, 2.3],
  },
}

export const stationById = new Map(stations.map((station) => [station.id, station]))

export const transferPairs: Array<[string, string]> = [
  ['khreshchatyk', 'maidan-nezalezhnosti'],
  ['teatralna', 'zoloti-vorota'],
  ['ploshcha-ukrainskykh-heroiv', 'palats-sportu'],
]

export const officialStationsEndpoint =
  'https://gisserver.kyivcity.gov.ua/mayno/rest/services/KYIV_API/transport_public/MapServer/4/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson'
