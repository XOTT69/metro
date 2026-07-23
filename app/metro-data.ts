export type LineId = "red" | "blue" | "green";

export type Station = {
  id: string;
  name: string;
  short?: string;
  line: LineId;
  x: number;
  y: number;
  lat: number;
  lon: number;
};

export const LINE_META: Record<
  LineId,
  { name: string; code: string; color: string; terminus: [string, string] }
> = {
  red: {
    name: "Святошинсько-Броварська",
    code: "M1",
    color: "#d82334",
    terminus: ["Академмістечко", "Лісова"],
  },
  blue: {
    name: "Оболонсько-Теремківська",
    code: "M2",
    color: "#1976d2",
    terminus: ["Героїв Дніпра", "Теремки"],
  },
  green: {
    name: "Сирецько-Печерська",
    code: "M3",
    color: "#14865f",
    terminus: ["Сирець", "Червоний хутір"],
  },
};

const red: Station[] = [
  ["akademmistechko", "Академмістечко", 54, 335, 50.4648, 30.355],
  ["zhytomyrska", "Житомирська", 98, 335, 50.4562, 30.365],
  ["sviatoshyn", "Святошин", 142, 335, 50.4578, 30.3911],
  ["nyvky", "Нивки", 186, 335, 50.4586, 30.4041],
  ["beresteiska", "Берестейська", 230, 335, 50.4592, 30.4193],
  ["shuliavska", "Шулявська", 274, 335, 50.4547, 30.445],
  ["politekhnichnyi-instytut", "Політехнічний інститут", 318, 335, 50.4509, 30.466],
  ["vokzalna", "Вокзальна", 362, 335, 50.4418, 30.4882],
  ["universytet", "Університет", 406, 335, 50.4441, 30.5058],
  ["teatralna", "Театральна", 450, 335, 50.4452, 30.518],
  ["khreshchatyk", "Хрещатик", 506, 335, 50.4473, 30.5229],
  ["arsenalna", "Арсенальна", 562, 335, 50.4434, 30.5455],
  ["dnipro", "Дніпро", 618, 335, 50.4412, 30.559],
  ["hidropark", "Гідропарк", 674, 335, 50.4458, 30.5766],
  ["livoberezhna", "Лівобережна", 730, 335, 50.4519, 30.5982],
  ["darnytsia", "Дарниця", 786, 335, 50.4558, 30.6129],
  ["chernihivska", "Чернігівська", 842, 335, 50.4598, 30.6304],
  ["lisova", "Лісова", 898, 335, 50.464, 30.6459],
].map(([id, name, , , lat, lon], index) => ({
  id,
  name,
  line: "red" as const,
  x: 80 + index * 68,
  y: 410,
  lat,
  lon,
})) as Station[];

const BLUE_MAP_Y = [
  50, 95, 140, 185, 230, 275, 320, 380, 450, 500, 550, 600, 650, 700,
  750, 800, 850, 900,
];

const blue: Station[] = [
  ["heroiv-dnipra", "Героїв Дніпра", 506, 45, 50.5227, 30.498],
  ["minska", "Мінська", 506, 78, 50.5123, 30.4985],
  ["obolon", "Оболонь", 506, 111, 50.5016, 30.4982],
  ["pochaina", "Почайна", 506, 144, 50.486, 30.4979],
  ["tarasa-shevchenka", "Тараса Шевченка", 506, 177, 50.4738, 30.5058],
  ["kontraktova-ploshcha", "Контрактова площа", 506, 210, 50.4661, 30.5149],
  ["poshtova-ploshcha", "Поштова площа", 506, 243, 50.4591, 30.5248],
  ["maidan-nezalezhnosti", "Майдан Незалежності", 506, 302, 50.45, 30.5242],
  ["ploshcha-ukrainskykh-heroiv", "Площа Українських Героїв", 506, 390, 50.438, 30.5168],
  ["olimpiiska", "Олімпійська", 506, 423, 50.4322, 30.5164],
  ["palats-ukraina", "Палац «Україна»", 506, 456, 50.4209, 30.5208],
  ["lybidska", "Либідська", 506, 489, 50.4131, 30.5248],
  ["demiivska", "Деміївська", 506, 522, 50.4049, 30.5166],
  ["holosiivska", "Голосіївська", 506, 555, 50.3975, 30.5083],
  ["vasylkivska", "Васильківська", 506, 588, 50.3933, 30.4882],
  ["vystavkovyi-tsentr", "Виставковий центр", 506, 621, 50.3825, 30.4775],
  ["ipodrom", "Іподром", 506, 654, 50.3765, 30.4692],
  ["teremky", "Теремки", 506, 687, 50.3671, 30.454],
].map(([id, name, , , lat, lon], index) => ({
  id,
  name,
  line: "blue" as const,
  x: 780,
  y: BLUE_MAP_Y[index],
  lat,
  lon,
})) as Station[];

const GREEN_MAP_POINTS: [number, number][] = [
  [250, 100],
  [310, 150],
  [370, 200],
  [720, 380],
  [740, 450],
  [820, 490],
  [870, 530],
  [920, 570],
  [970, 610],
  [1020, 650],
  [1070, 690],
  [1120, 730],
  [1170, 770],
  [1220, 810],
  [1270, 850],
  [1320, 890],
];

const green: Station[] = [
  ["syrets", "Сирець", 188, 68, 50.4762, 30.4308],
  ["dorohozhychi", "Дорогожичі", 235, 108, 50.4735, 30.449],
  ["lukianivska", "Лук’янівська", 282, 148, 50.4623, 30.4817],
  ["zoloti-vorota", "Золоті ворота", 450, 302, 50.4483, 30.5133],
  ["palats-sportu", "Палац спорту", 462, 390, 50.4381, 30.5209],
  ["klovska", "Кловська", 548, 416, 50.4369, 30.5317],
  ["pecherska", "Печерська", 590, 447, 50.4274, 30.5389],
  ["zvirynetska", "Звіринецька", 632, 478, 50.4181, 30.5453],
  ["vydubychi", "Видубичі", 674, 509, 50.4018, 30.5608],
  ["slavutych", "Славутич", 716, 540, 50.3942, 30.6047],
  ["osokorky", "Осокорки", 758, 571, 50.3952, 30.6161],
  ["pozniaky", "Позняки", 800, 602, 50.398, 30.6348],
  ["kharkivska", "Харківська", 842, 633, 50.4009, 30.6526],
  ["vyrlytsia", "Вирлиця", 884, 664, 50.4032, 30.666],
  ["boryspilska", "Бориспільська", 884, 697, 50.4034, 30.6844],
  ["chervonyi-khutir", "Червоний хутір", 884, 730, 50.4095, 30.6962],
].map(([id, name, , , lat, lon], index) => ({
  id,
  name,
  line: "green" as const,
  x: GREEN_MAP_POINTS[index][0],
  y: GREEN_MAP_POINTS[index][1],
  lat,
  lon,
})) as Station[];

export const STATIONS = [...red, ...blue, ...green];
export const STATION_BY_ID = Object.fromEntries(
  STATIONS.map((station) => [station.id, station]),
) as Record<string, Station>;

export const LINE_STATIONS: Record<LineId, Station[]> = { red, blue, green };

export const TRANSFERS: [string, string][] = [
  ["khreshchatyk", "maidan-nezalezhnosti"],
  ["teatralna", "zoloti-vorota"],
  ["ploshcha-ukrainskykh-heroiv", "palats-sportu"],
];

export const ADJACENCY: Record<string, string[]> = Object.fromEntries(
  STATIONS.map(({ id }) => [id, []]),
);

Object.values(LINE_STATIONS).forEach((stations) => {
  stations.forEach((station, index) => {
    if (index > 0) ADJACENCY[station.id].push(stations[index - 1].id);
    if (index < stations.length - 1)
      ADJACENCY[station.id].push(stations[index + 1].id);
  });
});

TRANSFERS.forEach(([a, b]) => {
  ADJACENCY[a].push(b);
  ADJACENCY[b].push(a);
});

export function getRoute(from: string, to: string): string[] {
  if (!STATION_BY_ID[from] || !STATION_BY_ID[to]) return [];
  const queue = [from];
  const parent: Record<string, string | null> = { [from]: null };

  while (queue.length) {
    const current = queue.shift()!;
    if (current === to) break;
    ADJACENCY[current].forEach((next) => {
      if (!(next in parent)) {
        parent[next] = current;
        queue.push(next);
      }
    });
  }

  if (!(to in parent)) return [];
  const route: string[] = [];
  let cursor: string | null = to;
  while (cursor) {
    route.unshift(cursor);
    cursor = parent[cursor];
  }
  return route;
}

export function routeTransfers(route: string[]) {
  return route.slice(1).filter((id, index) => {
    const previous = STATION_BY_ID[route[index]];
    return previous.line !== STATION_BY_ID[id].line;
  }).length;
}

export type TrainPrediction = {
  direction: string;
  seconds: number;
  followingSeconds: number;
  intervalSeconds: number;
  clockTime: string;
};

export type ServiceInterval = {
  minSeconds: number;
  maxSeconds: number;
  label: string;
  isPeak: boolean;
  isTypicalServiceHours: boolean;
};

const TYPICAL_SERVICE_START = 5 * 60 + 30;
const TYPICAL_SERVICE_END = 24 * 60 + 30;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function getServiceInterval(date = new Date()): ServiceInterval {
  const day = date.getDay();
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  const isWeekend = day === 0 || day === 6;
  const isPeak =
    !isWeekend &&
    ((minuteOfDay >= 7 * 60 && minuteOfDay < 10 * 60) ||
      (minuteOfDay >= 17 * 60 && minuteOfDay < 20 * 60));
  const adjustedMinute = minuteOfDay < 5 * 60 ? minuteOfDay + 24 * 60 : minuteOfDay;
  const isTypicalServiceHours =
    adjustedMinute >= TYPICAL_SERVICE_START &&
    adjustedMinute <= TYPICAL_SERVICE_END;

  if (isWeekend) {
    return {
      minSeconds: 360,
      maxSeconds: 420,
      label: "вихідний · інтервал 6–7 хв",
      isPeak: false,
      isTypicalServiceHours,
    };
  }
  if (isPeak) {
    return {
      minSeconds: 150,
      maxSeconds: 210,
      label: "будній пік · інтервал 2:30–3:30",
      isPeak: true,
      isTypicalServiceHours,
    };
  }
  return {
    minSeconds: 300,
    maxSeconds: 360,
    label: "будній міжпік · інтервал 5–6 хв",
    isPeak: false,
    isTypicalServiceHours,
  };
}

export function getStationPredictions(
  station: Station,
  date = new Date(),
): [TrainPrediction, TrainPrediction] {
  const lineStations = LINE_STATIONS[station.line];
  const stationIndex = lineStations.findIndex(({ id }) => id === station.id);
  const interval = getServiceInterval(date);
  const secondsOfDay =
    date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  return LINE_META[station.line].terminus.map((direction, directionIndex) => {
    const directionStationIndex =
      directionIndex === 0 ? stationIndex : lineStations.length - 1 - stationIndex;
    const range = interval.maxSeconds - interval.minSeconds;
    const intervalSeconds =
      interval.minSeconds +
      (stableHash(`${dateKey}:${station.line}:${directionIndex}`) % (range + 1));
    const travelOffset = directionStationIndex * 142;
    const phase =
      stableHash(`${station.line}:${directionIndex}:metro-kyiv`) % intervalSeconds;
    const cyclePosition =
      ((secondsOfDay - phase - travelOffset) % intervalSeconds + intervalSeconds) %
      intervalSeconds;
    const seconds = cyclePosition === 0 ? 0 : intervalSeconds - cyclePosition;
    const nextDate = new Date(date.getTime() + seconds * 1000);

    return {
      direction,
      seconds,
      followingSeconds: seconds + intervalSeconds,
      intervalSeconds,
      clockTime: nextDate.toLocaleTimeString("uk-UA", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }) as [TrainPrediction, TrainPrediction];
}

export function estimateTripMinutes(route: string[]) {
  if (route.length < 2) return 0;
  return Math.round((route.length - 1) * 2.35 + routeTransfers(route) * 4.5);
}

export const OFFICIAL_GEOJSON_URL =
  "https://gisserver.kyivcity.gov.ua/mayno/rest/services/Transport/KyivMetro/FeatureServer/1/query?where=1%3D1&outFields=*&outSR=4326&f=geojson";
