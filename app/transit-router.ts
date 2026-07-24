import {
  LINE_META,
  LINE_STATIONS,
  STATIONS,
  TRANSFERS,
  type LineId,
} from "./metro-data.ts";

export type TransitMode =
  | "metro"
  | "bus"
  | "trolleybus"
  | "tram"
  | "minibus"
  | "train"
  | "funicular"
  | "regional"
  | "walk";

export type TransitDataStatus = "live" | "schedule" | "registry" | "estimated";
export type SurfaceTransitMode = Exclude<
  TransitMode,
  "metro" | "regional" | "walk"
>;

export type TransitPattern = [
  routeIndex: number,
  direction: string,
  stopIndexes: number[],
  coordinates: [number, number][],
];

export type TransitNetworkData = {
  version: number;
  generatedAt: string;
  source: string;
  sourceUrl: string;
  feedVersion: string;
  stops: [string, string, number, number][];
  routes: [
    string,
    string,
    string,
    SurfaceTransitMode,
    string,
    TransitDataStatus?,
    number?,
    number?,
  ][];
  edges: [number, number, number, number][];
  patterns?: TransitPattern[];
  departures?: [routeIndex: number, stopIndex: number, minutes: number[]][];
};

export type TransitPlace = {
  id: string;
  node: number;
  name: string;
  detail: string;
  mode: TransitMode;
  lat: number;
  lon: number;
};

export type TransitRouteMeta = {
  id: string;
  short: string;
  long: string;
  mode: Exclude<TransitMode, "walk">;
  color: string;
  status: TransitDataStatus;
  headwayMin?: number;
  headwayMax?: number;
};

type GraphNode = TransitPlace;
type GraphEdge = { to: number; route: number; duration: number };
type Graph = {
  nodes: GraphNode[];
  routes: TransitRouteMeta[];
  adjacency: GraphEdge[][];
  places: TransitPlace[];
  departures: Map<string, number[]>;
};

export type TransitLeg = {
  mode: TransitMode;
  route: TransitRouteMeta | null;
  from: TransitPlace;
  to: TransitPlace;
  path: TransitPlace[];
  stops: number;
  seconds: number;
  waitSeconds: number;
};

export type TransitPlan = {
  from: TransitPlace;
  to: TransitPlace;
  totalMinutes: number;
  walkMinutes: number;
  transfers: number;
  legs: TransitLeg[];
};

export type TransitRouteProfile =
  | "fastest"
  | "fewest-transfers"
  | "less-walking"
  | "favorites";

const MODE_LABELS: Record<TransitMode, string> = {
  metro: "Метро",
  bus: "Автобус",
  trolleybus: "Тролейбус",
  tram: "Трамвай",
  minibus: "Маршрутка",
  train: "Міська електричка",
  funicular: "Фунікулер",
  regional: "Приміський транспорт",
  walk: "Пішки",
};

const collator = new Intl.Collator("uk");

export const REGIONAL_HUBS = [
  {
    id: "irpin",
    name: "Ірпінь",
    lat: 50.5218,
    lon: 30.2506,
    anchorStationId: "akademmistechko",
    minutes: 38,
    short: "379",
    headway: "10–15 хв",
    destination: "Київ",
  },
  {
    id: "bucha",
    name: "Буча",
    lat: 50.5434,
    lon: 30.212,
    anchorStationId: "akademmistechko",
    minutes: 45,
    short: "421",
    headway: "30–60 хв",
    destination: "АС «Полісся»",
  },
  {
    id: "hostomel",
    name: "Гостомель",
    lat: 50.5684,
    lon: 30.2651,
    anchorStationId: "akademmistechko",
    minutes: 48,
    short: "389",
    headway: "10–30 хв",
    destination: "АС «Дачна»",
  },
  {
    id: "vyshhorod",
    name: "Вишгород",
    lat: 50.5848,
    lon: 30.4898,
    anchorStationId: "heroiv-dnipra",
    minutes: 36,
    short: "398",
    headway: "15–40 хв",
    destination: "АС «Полісся»",
  },
  {
    id: "brovary",
    name: "Бровари",
    lat: 50.5114,
    lon: 30.79,
    anchorStationId: "lisova",
    minutes: 35,
    short: "810",
    headway: "за розкладом",
    destination: "Київ",
  },
  {
    id: "boryspil",
    name: "Бориспіль",
    lat: 50.345,
    lon: 30.8947,
    anchorStationId: "boryspilska",
    minutes: 42,
    short: "317",
    headway: "за розкладом",
    destination: "Київ",
  },
  {
    id: "vyshneve",
    name: "Вишневе",
    lat: 50.389,
    lon: 30.3715,
    anchorStationId: "teremky",
    minutes: 30,
    short: "723",
    headway: "за розкладом",
    destination: "Київ",
  },
  {
    id: "boiarka",
    name: "Боярка",
    lat: 50.3292,
    lon: 30.2887,
    anchorStationId: "teremky",
    minutes: 45,
    short: "368",
    headway: "15–40 хв",
    destination: "АС «Поділ»",
  },
  {
    id: "vasylkiv",
    name: "Васильків",
    lat: 50.1787,
    lon: 30.3215,
    anchorStationId: "teremky",
    minutes: 58,
    short: "303",
    headway: "за розкладом",
    destination: "Київ",
  },
  {
    id: "fastiv",
    name: "Фастів",
    lat: 50.0767,
    lon: 29.9177,
    anchorStationId: "vokzalna",
    minutes: 78,
    short: "2711",
    headway: "1–5 год",
    destination: "АС «Київ»",
  },
  {
    id: "bila-tserkva",
    name: "Біла Церква",
    lat: 49.7957,
    lon: 30.1311,
    anchorStationId: "vokzalna",
    minutes: 100,
    short: "726",
    headway: "за розкладом",
    destination: "Київ",
  },
  {
    id: "obukhiv",
    name: "Обухів",
    lat: 50.1099,
    lon: 30.6227,
    anchorStationId: "vydubychi",
    minutes: 58,
    short: "311",
    headway: "за розкладом",
    destination: "АС «Видубичі»",
  },
  {
    id: "ukrainka",
    name: "Українка",
    lat: 50.1432,
    lon: 30.7468,
    anchorStationId: "vydubychi",
    minutes: 68,
    short: "313",
    headway: "за розкладом",
    destination: "АС «Видубичі»",
  },
  {
    id: "pereiaslav",
    name: "Переяслав",
    lat: 50.065,
    lon: 31.4458,
    anchorStationId: "boryspilska",
    minutes: 108,
    short: "316",
    headway: "за розкладом",
    destination: "Київ",
  },
] as const;

export type RegionalHub = (typeof REGIONAL_HUBS)[number];

function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const latScale = 111_320;
  const lonScale = Math.cos(((a.lat + b.lat) * Math.PI) / 360) * 111_320;
  return Math.hypot((a.lat - b.lat) * latScale, (a.lon - b.lon) * lonScale);
}

function addEdge(adjacency: GraphEdge[][], from: number, edge: GraphEdge) {
  adjacency[from].push(edge);
}

function createGraph(data: TransitNetworkData): Graph {
  const surfaceNodes: GraphNode[] = data.stops.map(([id, name, lat, lon], node) => ({
    id: `stop:${id}`,
    node,
    name,
    detail: "Зупинка наземного транспорту",
    mode: "bus",
    lat,
    lon,
  }));
  const routes: TransitRouteMeta[] = data.routes.map(
    ([id, short, long, mode, color, status, headwayMin, headwayMax]) => ({
      id,
      short,
      long,
      mode,
      color: `#${color}`,
      status: status || "schedule",
      headwayMin,
      headwayMax,
    }),
  );
  const nodes = [...surfaceNodes];

  const metroNode = new Map<string, number>();
  for (const station of STATIONS) {
    const node = nodes.length;
    metroNode.set(station.id, node);
    nodes.push({
      id: `metro:${station.id}`,
      node,
      name: station.name,
      detail: `${LINE_META[station.line].code} · метро`,
      mode: "metro",
      lat: station.lat,
      lon: station.lon,
    });
  }

  const metroRoute = new Map<LineId, number>();
  (Object.keys(LINE_META) as LineId[]).forEach((line) => {
    metroRoute.set(line, routes.length);
    routes.push({
      id: `metro:${line}`,
      short: LINE_META[line].code,
      long: `${LINE_META[line].name} лінія`,
      mode: "metro",
      color: LINE_META[line].color,
      status: "schedule",
    });
  });

  const adjacency: GraphEdge[][] = Array.from({ length: nodes.length }, () => []);
  for (const [from, to, route, duration] of data.edges) {
    addEdge(adjacency, from, { to, route, duration });
  }

  (Object.keys(LINE_STATIONS) as LineId[]).forEach((line) => {
    const route = metroRoute.get(line)!;
    const stations = LINE_STATIONS[line];
    for (let index = 1; index < stations.length; index += 1) {
      const from = metroNode.get(stations[index - 1].id)!;
      const to = metroNode.get(stations[index].id)!;
      addEdge(adjacency, from, { to, route, duration: 150 });
      addEdge(adjacency, to, { to: from, route, duration: 150 });
    }
  });

  for (const [first, second] of TRANSFERS) {
    const from = metroNode.get(first)!;
    const to = metroNode.get(second)!;
    addEdge(adjacency, from, { to, route: -1, duration: 210 });
    addEdge(adjacency, to, { to: from, route: -1, duration: 210 });
  }

  for (const station of STATIONS) {
    const metroIndex = metroNode.get(station.id)!;
    const nearby = surfaceNodes
      .map((stop) => ({ stop, distance: distanceMeters(station, stop) }))
      .filter(({ distance }) => distance <= 480)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8);
    for (const { stop, distance } of nearby) {
      const duration = Math.max(90, Math.round(distance / 1.15) + 45);
      addEdge(adjacency, metroIndex, { to: stop.node, route: -1, duration });
      addEdge(adjacency, stop.node, { to: metroIndex, route: -1, duration });
    }
  }

  const uniqueSurface = new Map<string, TransitPlace>();
  for (const stop of surfaceNodes) {
    const key = stop.name.toLocaleLowerCase("uk-UA").replace(/\s+/g, " ").trim();
    if (!uniqueSurface.has(key)) uniqueSurface.set(key, stop);
  }
  const places = [
    ...nodes.filter((node) => node.mode === "metro"),
    ...uniqueSurface.values(),
  ].sort((a, b) => {
    if (a.mode === "metro" && b.mode !== "metro") return -1;
    if (b.mode === "metro" && a.mode !== "metro") return 1;
    return collator.compare(a.name, b.name);
  });

  const departures = new Map(
    (data.departures || []).map(([route, stop, minutes]) => [
      `${route}|${stop}`,
      minutes,
    ]),
  );
  return { nodes, routes, adjacency, places, departures };
}

class MinHeap<T extends { cost: number }> {
  private values: T[] = [];

  push(value: T) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].cost <= value.cost) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }

  pop() {
    if (!this.values.length) return undefined;
    const first = this.values[0];
    const last = this.values.pop()!;
    if (this.values.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.values.length) break;
        const child =
          right < this.values.length && this.values[right].cost < this.values[left].cost
            ? right
            : left;
        if (this.values[child].cost >= last.cost) break;
        this.values[index] = this.values[child];
        index = child;
      }
      this.values[index] = last;
    }
    return first;
  }
}

function boardingWait(
  graph: Graph,
  routeIndex: number,
  stopIndex: number,
  minuteOfDay: number,
) {
  const route = graph.routes[routeIndex];
  const minute = ((minuteOfDay % 1440) + 1440) % 1440;
  const scheduled = graph.departures.get(`${routeIndex}|${stopIndex}`);
  if (scheduled?.length) {
    const next = scheduled.find((value) => value >= minute) ?? scheduled[0] + 1440;
    return Math.max(30, Math.round((next - minute) * 60));
  }
  const hour = minute / 60;
  const peak = (hour >= 7 && hour < 10) || (hour >= 16.5 && hour < 19.5);
  const late = hour < 6 || hour >= 22;
  if (route.mode === "metro") return late ? 420 : peak ? 150 : 300;
  if (route.mode === "regional") return 600;
  if (route.headwayMin || route.headwayMax) {
    const averageWait = Math.round(
      (((route.headwayMin || route.headwayMax || 10) +
        (route.headwayMax || route.headwayMin || 10)) /
        4) *
        60,
    );
    return Math.round(averageWait * (late ? 1.5 : peak ? 0.85 : 1));
  }
  if (route.mode === "train") return 600;
  if (route.mode === "minibus") return 420;
  const base = route.mode === "tram" ? 240 : route.mode === "trolleybus" ? 270 : 300;
  return Math.round(base * (late ? 1.7 : peak ? 0.8 : 1));
}

export function getTransitPlaces(data: TransitNetworkData) {
  return createTransitRouter(data).places;
}

export function findNearestTransitPlace(
  data: TransitNetworkData,
  latitude: number,
  longitude: number,
) {
  return createTransitRouter(data).findNearestPlace(latitude, longitude);
}

function findNearestTransitPlaceInGraph(
  graph: Graph,
  latitude: number,
  longitude: number,
) {
  const point = { lat: latitude, lon: longitude };
  return graph.places.reduce(
    (best, place) => {
      const distance = distanceMeters(point, place);
      return distance < best.distance ? { place, distance } : best;
    },
    { place: graph.places[0], distance: Infinity },
  ).place;
}

export type TransitPlanOptions = {
  excludedRouteIds?: ReadonlySet<string>;
  profile?: TransitRouteProfile;
  favoriteRouteIds?: ReadonlySet<string>;
  departureMinute?: number;
  arrivalMinute?: number;
};

function edgeProfileCost({
  duration,
  wait,
  route,
  isTransfer,
  options,
}: {
  duration: number;
  wait: number;
  route: TransitRouteMeta | null;
  isTransfer: boolean;
  options: TransitPlanOptions;
}) {
  const profile = options.profile || "fastest";
  let cost = duration + wait;
  if (profile === "less-walking" && !route) cost += duration * 5;
  if (profile === "fewest-transfers" && isTransfer) cost += 15 * 60;
  if (profile === "less-walking" && isTransfer) cost += 90;
  if (profile === "favorites" && route) {
    cost += options.favoriteRouteIds?.has(route.id) ? 0 : 20 * 60;
    if (isTransfer) cost += 3 * 60;
  }
  return cost;
}

export function transitPlanScore(
  plan: TransitPlan,
  options: TransitPlanOptions = {},
) {
  const profile = options.profile || "fastest";
  const serviceIds = plan.legs
    .filter((leg) => leg.route)
    .map((leg) => leg.route!.id);
  const nonFavoriteServices = serviceIds.filter(
    (routeId) => !options.favoriteRouteIds?.has(routeId),
  ).length;
  if (profile === "fewest-transfers") {
    return plan.totalMinutes + plan.transfers * 15 + plan.walkMinutes * 0.2;
  }
  if (profile === "less-walking") {
    return plan.totalMinutes + plan.walkMinutes * 5 + plan.transfers * 1.5;
  }
  if (profile === "favorites") {
    return plan.totalMinutes + nonFavoriteServices * 20 + plan.transfers * 3;
  }
  return plan.totalMinutes + plan.transfers * 0.25 + plan.walkMinutes * 0.05;
}

function findTransitPlanInGraph(
  graph: Graph,
  fromNode: number,
  toNode: number,
  options: TransitPlanOptions = {},
): TransitPlan | null {
  const startKey = `${fromNode}|-1`;
  const heap = new MinHeap<{
    node: number;
    service: number;
    boarded: boolean;
    cost: number;
    elapsedSeconds: number;
    key: string;
  }>();
  const best = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<
    string,
    { key: string; edge: GraphEdge; from: number; wait: number }
  >();
  heap.push({
    node: fromNode,
    service: -1,
    boarded: false,
    cost: 0,
    elapsedSeconds: 0,
    key: startKey,
  });
  let finalKey: string | null = null;

  while (true) {
    const current = heap.pop();
    if (!current) break;
    if (current.cost !== best.get(current.key)) continue;
    if (current.node === toNode) {
      finalKey = current.key;
      break;
    }

    for (const edge of graph.adjacency[current.node]) {
      if (
        edge.route >= 0 &&
        options.excludedRouteIds?.has(graph.routes[edge.route].id)
      ) {
        continue;
      }
      // A walking edge ends the previous boarding, so re-entering the same
      // route still carries a realistic wait instead of becoming a free hop.
      const nextService = edge.route >= 0 ? edge.route : -1;
      const isBoarding = edge.route >= 0 && edge.route !== current.service;
      const isTransfer = isBoarding && current.boarded;
      let wait = 0;
      if (isBoarding) {
        const clockMinute =
          (options.departureMinute ?? new Date().getHours() * 60 + new Date().getMinutes()) +
          current.elapsedSeconds / 60;
        wait = boardingWait(graph, edge.route, current.node, clockMinute);
        if (isTransfer) wait += 150;
      }
      const boarded = current.boarded || edge.route >= 0;
      const cost =
        current.cost +
        edgeProfileCost({
          duration: edge.duration,
          wait,
          route: edge.route >= 0 ? graph.routes[edge.route] : null,
          isTransfer,
          options,
        });
      const elapsedSeconds = current.elapsedSeconds + edge.duration + wait;
      const key = `${edge.to}|${nextService}|${boarded ? 1 : 0}`;
      if (cost >= (best.get(key) ?? Infinity)) continue;
      best.set(key, cost);
      previous.set(key, { key: current.key, edge, from: current.node, wait });
      heap.push({
        node: edge.to,
        service: nextService,
        boarded,
        cost,
        elapsedSeconds,
        key,
      });
    }
  }

  if (!finalKey) return null;
  const steps: { edge: GraphEdge; from: number; wait: number }[] = [];
  for (let key = finalKey; key !== startKey; ) {
    const item = previous.get(key);
    if (!item) return null;
    steps.push({ edge: item.edge, from: item.from, wait: item.wait });
    key = item.key;
  }
  steps.reverse();

  const legs: TransitLeg[] = [];
  for (const step of steps) {
    const mode = step.edge.route < 0 ? "walk" : graph.routes[step.edge.route].mode;
    const route = step.edge.route < 0 ? null : graph.routes[step.edge.route];
    const last = legs.at(-1);
    if (
      last &&
      ((step.edge.route < 0 && last.mode === "walk") ||
        (route && last.route?.id === route.id))
    ) {
      last.to = graph.nodes[step.edge.to];
      last.path.push(graph.nodes[step.edge.to]);
      last.stops += 1;
      last.seconds += step.edge.duration;
      last.waitSeconds += step.wait;
    } else {
      legs.push({
        mode,
        route,
        from: graph.nodes[step.from],
        to: graph.nodes[step.edge.to],
        path: [graph.nodes[step.from], graph.nodes[step.edge.to]],
        stops: 1,
        seconds: step.edge.duration,
        waitSeconds: step.wait,
      });
    }
  }

  const services = legs.filter((leg) => leg.route).map((leg) => leg.route!.id);
  const uniqueChanges = services.slice(1).filter((service, index) => service !== services[index]);
  const totalSeconds = steps.reduce(
    (sum, step) => sum + step.edge.duration + step.wait,
    0,
  );
  const walkSeconds = legs
    .filter((leg) => leg.mode === "walk")
    .reduce((sum, leg) => sum + leg.seconds, 0);

  return {
    from: graph.nodes[fromNode],
    to: graph.nodes[toNode],
    totalMinutes: Math.max(1, Math.round(totalSeconds / 60)),
    walkMinutes: Math.round(walkSeconds / 60),
    transfers: uniqueChanges.length,
    legs,
  };
}

export function findTransitPlan(
  data: TransitNetworkData,
  fromNode: number,
  toNode: number,
  options: TransitPlanOptions = {},
) {
  return createTransitRouter(data).findPlan(fromNode, toNode, options);
}

export function transitModeLabel(mode: TransitMode) {
  return MODE_LABELS[mode];
}

export type TransitCoordinate = {
  id: string;
  name: string;
  detail?: string;
  lat: number;
  lon: number;
};

function coordinatePlace(point: TransitCoordinate, node: number): TransitPlace {
  return {
    id: point.id,
    node,
    name: point.name,
    detail: point.detail || "Адреса",
    mode: "walk",
    lat: point.lat,
    lon: point.lon,
  };
}

function nearbyNodes(graph: Graph, point: TransitCoordinate) {
  return graph.nodes
    .map((place) => ({ place, distance: distanceMeters(point, place) }))
    .sort((a, b) => a.distance - b.distance)
    .filter(({ distance }, index) => distance <= 1_600 || index < 4)
    .slice(0, 7);
}

function findCityTransitPlansBetweenPoints(
  graph: Graph,
  fromPoint: TransitCoordinate,
  toPoint: TransitCoordinate,
  limit = 3,
  options: TransitPlanOptions = {},
) {
  const starts = nearbyNodes(graph, fromPoint);
  const finishes = nearbyNodes(graph, toPoint);
  const from = coordinatePlace(fromPoint, -1);
  const to = coordinatePlace(toPoint, -2);
  const candidates: TransitPlan[] = [];

  const collectCandidates = (excludedRouteIds?: ReadonlySet<string>) => {
    for (const start of starts) {
      for (const finish of finishes) {
        const base = findTransitPlanInGraph(
          graph,
          start.place.node,
          finish.place.node,
          { ...options, excludedRouteIds },
        );
        if (!base) continue;

        const startSeconds =
          start.distance > 35 ? Math.max(30, Math.round(start.distance / 1.2)) : 0;
        const finishSeconds =
          finish.distance > 35
            ? Math.max(30, Math.round(finish.distance / 1.2))
            : 0;
        const startWalk: TransitLeg = {
          mode: "walk",
          route: null,
          from,
          to: start.place,
          path: [from, start.place],
          stops: 1,
          seconds: startSeconds,
          waitSeconds: 0,
        };
        const finishWalk: TransitLeg = {
          mode: "walk",
          route: null,
          from: finish.place,
          to,
          path: [finish.place, to],
          stops: 1,
          seconds: finishSeconds,
          waitSeconds: 0,
        };
        const baseSeconds = base.legs.reduce(
          (sum, leg) => sum + leg.seconds + leg.waitSeconds,
          0,
        );
        const legs = [
          ...(startSeconds ? [startWalk] : []),
          ...base.legs,
          ...(finishSeconds ? [finishWalk] : []),
        ];
        candidates.push({
          from,
          to,
          totalMinutes: Math.max(
            1,
            Math.round((baseSeconds + startSeconds + finishSeconds) / 60),
          ),
          walkMinutes:
            base.walkMinutes + Math.round((startSeconds + finishSeconds) / 60),
          transfers: base.transfers,
          legs,
        });
      }
    }
  };

  collectCandidates();
  const fastestServices = candidates
    .sort((a, b) => transitPlanScore(a, options) - transitPlanScore(b, options))[0]
    ?.legs.filter((leg) => leg.route)
    .map((leg) => leg.route!.id);
  for (const routeId of [...new Set(fastestServices || [])].slice(0, 5)) {
    collectCandidates(new Set([routeId]));
  }
  const secondWaveRoutes = candidates
    .sort((a, b) => transitPlanScore(a, options) - transitPlanScore(b, options))
    .slice(0, 40)
    .flatMap((candidate) =>
      candidate.legs.filter((leg) => leg.route).map((leg) => leg.route!.id),
    )
    .filter((routeId) => !fastestServices?.includes(routeId));
  for (const routeId of [...new Set(secondWaveRoutes)].slice(0, 4)) {
    collectCandidates(new Set([routeId]));
  }

  const unique = new Map<string, TransitPlan>();
  for (const candidate of candidates.sort(
    (a, b) =>
      transitPlanScore(a, options) - transitPlanScore(b, options) ||
      a.totalMinutes - b.totalMinutes ||
      a.transfers - b.transfers ||
      a.walkMinutes - b.walkMinutes,
  )) {
    const services = candidate.legs
      .filter((leg) => leg.route)
      .map((leg) => leg.route!.id)
      .join("|");
    if (!unique.has(services)) unique.set(services, candidate);
  }
  return [...unique.values()].slice(0, limit);
}

function nearestNetworkDistance(graph: Graph, point: TransitCoordinate) {
  return graph.nodes.reduce(
    (best, place) => Math.min(best, distanceMeters(point, place)),
    Infinity,
  );
}

function nearestRegionalHub(point: TransitCoordinate) {
  return REGIONAL_HUBS.reduce<{ hub: RegionalHub; distance: number }>(
    (best, hub) => {
      const distance = distanceMeters(point, hub);
      return distance < best.distance ? { hub, distance } : best;
    },
    { hub: REGIONAL_HUBS[0], distance: Infinity },
  );
}

function regionalEndpoint(
  graph: Graph,
  point: TransitCoordinate,
  atStart: boolean,
) {
  if (nearestNetworkDistance(graph, point) <= 6_000) return null;
  const { hub, distance } = nearestRegionalHub(point);
  const anchor = graph.nodes.find(
    (place) => place.id === `metro:${hub.anchorStationId}`,
  );
  if (!anchor) return null;
  const source = coordinatePlace(point, atStart ? -11 : -12);
  const hubPlace: TransitPlace = {
    id: `regional:${hub.id}`,
    node: atStart ? -13 : -14,
    name: hub.name,
    detail: "Транспортний вузол Київської області",
    mode: "regional",
    lat: hub.lat,
    lon: hub.lon,
  };
  const extraMinutes = Math.round(distance / 650);
  const duration = (hub.minutes + extraMinutes) * 60;
  const route: TransitRouteMeta = {
    id: `regional:${hub.id}`,
    short: hub.short,
    long: `${hub.name} — Київ`,
    mode: "regional",
    color: "#7a45d6",
    status: "registry",
    headwayMin: Number.parseInt(hub.headway, 10) || undefined,
  };
  const leg: TransitLeg = atStart
    ? {
        mode: "regional",
        route,
        from: source,
        to: anchor,
        path: [source, hubPlace, anchor],
        stops: 1,
        seconds: duration,
        waitSeconds: 600,
      }
    : {
        mode: "regional",
        route,
        from: anchor,
        to: source,
        path: [anchor, hubPlace, source],
        stops: 1,
        seconds: duration,
        waitSeconds: 600,
      };
  return {
    anchor: {
      id: `point:${anchor.id}`,
      name: anchor.name,
      detail: anchor.detail,
      lat: anchor.lat,
      lon: anchor.lon,
    } satisfies TransitCoordinate,
    hub,
    leg,
  };
}

function mergeRegionalPlan(
  fromPoint: TransitCoordinate,
  toPoint: TransitCoordinate,
  base: TransitPlan | null,
  start: ReturnType<typeof regionalEndpoint>,
  finish: ReturnType<typeof regionalEndpoint>,
) {
  const legs = [
    ...(start ? [start.leg] : []),
    ...(base?.legs || []),
    ...(finish ? [finish.leg] : []),
  ];
  if (!legs.length) return null;
  const totalSeconds = legs.reduce(
    (sum, leg) => sum + leg.seconds + leg.waitSeconds,
    0,
  );
  const walkSeconds = legs
    .filter((leg) => leg.mode === "walk")
    .reduce((sum, leg) => sum + leg.seconds, 0);
  const services = legs.filter((leg) => leg.route);
  return {
    from: coordinatePlace(fromPoint, -1),
    to: coordinatePlace(toPoint, -2),
    totalMinutes: Math.max(1, Math.round(totalSeconds / 60)),
    walkMinutes: Math.round(walkSeconds / 60),
    transfers: Math.max(0, services.length - 1),
    legs,
  } satisfies TransitPlan;
}

function findTransitPlansBetweenPointsInGraph(
  graph: Graph,
  fromPoint: TransitCoordinate,
  toPoint: TransitCoordinate,
  limit = 3,
  options: TransitPlanOptions = {},
) {
  const start = regionalEndpoint(graph, fromPoint, true);
  const finish = regionalEndpoint(graph, toPoint, false);
  if (!start && !finish) {
    return findCityTransitPlansBetweenPoints(
      graph,
      fromPoint,
      toPoint,
      limit,
      options,
    );
  }

  if (start && finish && start.hub.anchorStationId === finish.hub.anchorStationId) {
    const directDistance = distanceMeters(fromPoint, toPoint);
    const directMinutes = Math.max(18, Math.round(directDistance / 620) + 12);
    const from = coordinatePlace(fromPoint, -1);
    const to = coordinatePlace(toPoint, -2);
    const directRoute: TransitRouteMeta = {
      id: `regional:${start.hub.id}:${finish.hub.id}`,
      short: "Пр",
      long: `${start.hub.name} — ${finish.hub.name}`,
      mode: "regional",
      color: "#7a45d6",
      status: "estimated",
    };
    const directPlan: TransitPlan = {
      from,
      to,
      totalMinutes: directMinutes + 10,
      walkMinutes: 0,
      transfers: 0,
      legs: [
        {
          mode: "regional",
          route: directRoute,
          from,
          to,
          path: [from, to],
          stops: 1,
          seconds: directMinutes * 60,
          waitSeconds: 600,
        },
      ],
    };
    return [directPlan];
  }

  const cityFrom = start?.anchor || fromPoint;
  const cityTo = finish?.anchor || toPoint;
  const bases = findCityTransitPlansBetweenPoints(
    graph,
    cityFrom,
    cityTo,
    limit,
    options,
  );
  if (!bases.length) {
    const fallback = mergeRegionalPlan(
      fromPoint,
      toPoint,
      null,
      start,
      finish,
    );
    return fallback ? [fallback] : [];
  }
  return bases
    .map((base) =>
      mergeRegionalPlan(fromPoint, toPoint, base, start, finish),
    )
    .filter((plan): plan is TransitPlan => Boolean(plan))
    .slice(0, limit);
}

function findTimeAwareTransitPlansBetweenPoints(
  graph: Graph,
  fromPoint: TransitCoordinate,
  toPoint: TransitCoordinate,
  limit = 3,
  options: TransitPlanOptions = {},
) {
  if (options.arrivalMinute === undefined) {
    return findTransitPlansBetweenPointsInGraph(
      graph,
      fromPoint,
      toPoint,
      limit,
      options,
    );
  }

  let estimatedMinutes = 60;
  let plans: TransitPlan[] = [];
  for (let iteration = 0; iteration < 3; iteration += 1) {
    plans = findTransitPlansBetweenPointsInGraph(
      graph,
      fromPoint,
      toPoint,
      limit,
      {
        ...options,
        arrivalMinute: undefined,
        departureMinute: options.arrivalMinute - estimatedMinutes,
      },
    );
    const nextEstimate = plans[0]?.totalMinutes;
    if (!nextEstimate || Math.abs(nextEstimate - estimatedMinutes) <= 1) break;
    estimatedMinutes = nextEstimate;
  }
  return plans;
}

export type TransitRouter = {
  readonly places: TransitPlace[];
  findNearestPlace: (latitude: number, longitude: number) => TransitPlace;
  findPlan: (
    fromNode: number,
    toNode: number,
    options?: TransitPlanOptions,
  ) => TransitPlan | null;
  findPlansBetweenPoints: (
    fromPoint: TransitCoordinate,
    toPoint: TransitCoordinate,
    limit?: number,
    options?: TransitPlanOptions,
  ) => TransitPlan[];
};

export function createTransitRouter(data: TransitNetworkData): TransitRouter {
  const graph = createGraph(data);
  return {
    places: graph.places,
    findNearestPlace: (latitude, longitude) =>
      findNearestTransitPlaceInGraph(graph, latitude, longitude),
    findPlan: (fromNode, toNode, options) =>
      findTransitPlanInGraph(graph, fromNode, toNode, options),
    findPlansBetweenPoints: (fromPoint, toPoint, limit, options) =>
      findTimeAwareTransitPlansBetweenPoints(
        graph,
        fromPoint,
        toPoint,
        limit,
        options,
      ),
  };
}

export function findTransitPlansBetweenPoints(
  data: TransitNetworkData,
  fromPoint: TransitCoordinate,
  toPoint: TransitCoordinate,
  limit = 3,
  options: TransitPlanOptions = {},
) {
  return createTransitRouter(data).findPlansBetweenPoints(
    fromPoint,
    toPoint,
    limit,
    options,
  );
}
