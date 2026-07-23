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
  | "regional"
  | "walk";

export type TransitNetworkData = {
  version: number;
  generatedAt: string;
  source: string;
  sourceUrl: string;
  feedVersion: string;
  stops: [string, string, number, number][];
  routes: [string, string, string, "bus" | "trolleybus" | "tram", string][];
  edges: [number, number, number, number][];
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
};

type GraphNode = TransitPlace;
type GraphEdge = { to: number; route: number; duration: number };
type Graph = {
  nodes: GraphNode[];
  routes: TransitRouteMeta[];
  adjacency: GraphEdge[][];
  places: TransitPlace[];
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

const MODE_LABELS: Record<TransitMode, string> = {
  metro: "Метро",
  bus: "Автобус",
  trolleybus: "Тролейбус",
  tram: "Трамвай",
  regional: "Приміський транспорт",
  walk: "Пішки",
};

const collator = new Intl.Collator("uk");
let cachedSource: TransitNetworkData | null = null;
let cachedGraph: Graph | null = null;

export const REGIONAL_HUBS = [
  {
    id: "irpin",
    name: "Ірпінь",
    lat: 50.5218,
    lon: 30.2506,
    anchorStationId: "akademmistechko",
    minutes: 38,
    short: "Ір",
  },
  {
    id: "bucha",
    name: "Буча",
    lat: 50.5434,
    lon: 30.212,
    anchorStationId: "akademmistechko",
    minutes: 45,
    short: "Бч",
  },
  {
    id: "hostomel",
    name: "Гостомель",
    lat: 50.5684,
    lon: 30.2651,
    anchorStationId: "akademmistechko",
    minutes: 48,
    short: "Гс",
  },
  {
    id: "vyshhorod",
    name: "Вишгород",
    lat: 50.5848,
    lon: 30.4898,
    anchorStationId: "heroiv-dnipra",
    minutes: 36,
    short: "Вг",
  },
  {
    id: "brovary",
    name: "Бровари",
    lat: 50.5114,
    lon: 30.79,
    anchorStationId: "lisova",
    minutes: 35,
    short: "Бр",
  },
  {
    id: "boryspil",
    name: "Бориспіль",
    lat: 50.345,
    lon: 30.8947,
    anchorStationId: "boryspilska",
    minutes: 42,
    short: "Бп",
  },
  {
    id: "vyshneve",
    name: "Вишневе",
    lat: 50.389,
    lon: 30.3715,
    anchorStationId: "teremky",
    minutes: 30,
    short: "Вш",
  },
  {
    id: "boiarka",
    name: "Боярка",
    lat: 50.3292,
    lon: 30.2887,
    anchorStationId: "teremky",
    minutes: 45,
    short: "Бя",
  },
  {
    id: "vasylkiv",
    name: "Васильків",
    lat: 50.1787,
    lon: 30.3215,
    anchorStationId: "teremky",
    minutes: 58,
    short: "Ва",
  },
  {
    id: "fastiv",
    name: "Фастів",
    lat: 50.0767,
    lon: 29.9177,
    anchorStationId: "vokzalna",
    minutes: 78,
    short: "Фс",
  },
  {
    id: "bila-tserkva",
    name: "Біла Церква",
    lat: 49.7957,
    lon: 30.1311,
    anchorStationId: "vokzalna",
    minutes: 100,
    short: "БЦ",
  },
  {
    id: "obukhiv",
    name: "Обухів",
    lat: 50.1099,
    lon: 30.6227,
    anchorStationId: "vydubychi",
    minutes: 58,
    short: "Об",
  },
  {
    id: "ukrainka",
    name: "Українка",
    lat: 50.1432,
    lon: 30.7468,
    anchorStationId: "vydubychi",
    minutes: 68,
    short: "Ук",
  },
  {
    id: "pereiaslav",
    name: "Переяслав",
    lat: 50.065,
    lon: 31.4458,
    anchorStationId: "boryspilska",
    minutes: 108,
    short: "Пр",
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
  if (cachedSource === data && cachedGraph) return cachedGraph;

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
    ([id, short, long, mode, color]) => ({
      id,
      short,
      long,
      mode,
      color: `#${color}`,
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

  cachedSource = data;
  cachedGraph = { nodes, routes, adjacency, places };
  return cachedGraph;
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

function boardingWait(route: TransitRouteMeta) {
  if (route.mode === "metro") return 150;
  if (route.mode === "regional") return 600;
  if (route.mode === "tram") return 240;
  if (route.mode === "trolleybus") return 270;
  return 300;
}

export function getTransitPlaces(data: TransitNetworkData) {
  return createGraph(data).places;
}

export function findNearestTransitPlace(
  data: TransitNetworkData,
  latitude: number,
  longitude: number,
) {
  const point = { lat: latitude, lon: longitude };
  return createGraph(data).places.reduce(
    (best, place) => {
      const distance = distanceMeters(point, place);
      return distance < best.distance ? { place, distance } : best;
    },
    { place: createGraph(data).places[0], distance: Infinity },
  ).place;
}

export function findTransitPlan(
  data: TransitNetworkData,
  fromNode: number,
  toNode: number,
  options: { excludedRouteIds?: ReadonlySet<string> } = {},
): TransitPlan | null {
  const graph = createGraph(data);
  const startKey = `${fromNode}|-1`;
  const heap = new MinHeap<{ node: number; service: number; cost: number; key: string }>();
  const best = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<
    string,
    { key: string; edge: GraphEdge; from: number; wait: number }
  >();
  heap.push({ node: fromNode, service: -1, cost: 0, key: startKey });
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
      let wait = 0;
      if (edge.route >= 0 && edge.route !== current.service) {
        wait = boardingWait(graph.routes[edge.route]);
        if (current.service >= 0) wait += 150;
      }
      const cost = current.cost + edge.duration + wait;
      const key = `${edge.to}|${nextService}`;
      if (cost >= (best.get(key) ?? Infinity)) continue;
      best.set(key, cost);
      previous.set(key, { key: current.key, edge, from: current.node, wait });
      heap.push({ node: edge.to, service: nextService, cost, key });
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
  const totalSeconds = best.get(finalKey) || 0;
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
  data: TransitNetworkData,
  fromPoint: TransitCoordinate,
  toPoint: TransitCoordinate,
  limit = 3,
) {
  const graph = createGraph(data);
  const starts = nearbyNodes(graph, fromPoint);
  const finishes = nearbyNodes(graph, toPoint);
  const from = coordinatePlace(fromPoint, -1);
  const to = coordinatePlace(toPoint, -2);
  const candidates: TransitPlan[] = [];

  const collectCandidates = (excludedRouteIds?: ReadonlySet<string>) => {
    for (const start of starts) {
      for (const finish of finishes) {
        const base = findTransitPlan(data, start.place.node, finish.place.node, {
          excludedRouteIds,
        });
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
    .sort((a, b) => a.totalMinutes - b.totalMinutes)[0]
    ?.legs.filter((leg) => leg.route)
    .map((leg) => leg.route!.id);
  for (const routeId of [...new Set(fastestServices || [])].slice(0, 5)) {
    collectCandidates(new Set([routeId]));
  }
  const secondWaveRoutes = candidates
    .sort((a, b) => a.totalMinutes - b.totalMinutes)
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

export function findTransitPlansBetweenPoints(
  data: TransitNetworkData,
  fromPoint: TransitCoordinate,
  toPoint: TransitCoordinate,
  limit = 3,
) {
  const graph = createGraph(data);
  const start = regionalEndpoint(graph, fromPoint, true);
  const finish = regionalEndpoint(graph, toPoint, false);
  if (!start && !finish) {
    return findCityTransitPlansBetweenPoints(data, fromPoint, toPoint, limit);
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
  const bases = findCityTransitPlansBetweenPoints(data, cityFrom, cityTo, limit);
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
