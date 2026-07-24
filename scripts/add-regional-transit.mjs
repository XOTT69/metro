import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const networkPath = resolve(process.argv[2] || "public/transit-network.json");
const network = JSON.parse(readFileSync(networkPath, "utf8"));

const hubs = [
  ["irpin", "Ірпінь", 50.5218, 30.2506, "379", "Київ", 38, 10, 15, 50.4649, 30.355],
  ["bucha", "Буча", 50.5434, 30.212, "421", "АС «Полісся»", 45, 30, 60, 50.4649, 30.355],
  ["hostomel", "Гостомель", 50.5684, 30.2651, "389", "АС «Дачна»", 48, 10, 30, 50.4649, 30.355],
  ["vyshhorod", "Вишгород", 50.5848, 30.4898, "398", "АС «Полісся»", 36, 15, 40, 50.5225, 30.498],
  ["brovary", "Бровари", 50.5114, 30.79, "810", "Київ", 35, 20, 40, 50.464, 30.645],
  ["boryspil", "Бориспіль", 50.345, 30.8947, "317", "Київ", 42, 20, 40, 50.403, 30.684],
  ["vyshneve", "Вишневе", 50.389, 30.3715, "723", "Київ", 30, 15, 30, 50.367, 30.454],
  ["boiarka", "Боярка", 50.3292, 30.2887, "368", "АС «Поділ»", 45, 15, 40, 50.367, 30.454],
  ["vasylkiv", "Васильків", 50.1787, 30.3215, "303", "Київ", 58, 30, 60, 50.367, 30.454],
  ["fastiv", "Фастів", 50.0767, 29.9177, "2711", "АС «Київ»", 78, 60, 300, 50.441, 30.489],
  ["bila-tserkva", "Біла Церква", 49.7957, 30.1311, "726", "Київ", 100, 60, 180, 50.441, 30.489],
  ["obukhiv", "Обухів", 50.1099, 30.6227, "311", "АС «Видубичі»", 58, 30, 60, 50.402, 30.56],
  ["ukrainka", "Українка", 50.1432, 30.7468, "313", "АС «Видубичі»", 68, 30, 60, 50.402, 30.56],
  ["pereiaslav", "Переяслав", 50.065, 31.4458, "316", "Київ", 108, 60, 180, 50.403, 30.684],
];

function distanceSquared(stop, lat, lon) {
  return (stop[2] - lat) ** 2 + (stop[3] - lon) ** 2;
}

network.patterns ||= [];
for (const [id, name, lat, lon, number, destination, minutes, minHeadway, maxHeadway, anchorLat, anchorLon] of hubs) {
  if (network.routes.some((route) => route[0] === `region:${id}`)) continue;
  const hubStopIndex = network.stops.length;
  network.stops.push([`region:${id}`, `${name}, автостанція`, lat, lon]);
  const anchorStopIndex = network.stops.reduce(
    (best, stop, index) =>
      distanceSquared(stop, anchorLat, anchorLon) < best.distance
        ? { index, distance: distanceSquared(stop, anchorLat, anchorLon) }
        : best,
    { index: 0, distance: Infinity },
  ).index;
  const anchor = network.stops[anchorStopIndex];
  const routeIndex = network.routes.length;
  network.routes.push([
    `region:${id}`,
    number,
    `${name} — ${destination}`,
    "minibus",
    "7043c5",
    "registry",
    minHeadway,
    maxHeadway,
  ]);
  network.edges.push(
    [hubStopIndex, anchorStopIndex, routeIndex, minutes * 60],
    [anchorStopIndex, hubStopIndex, routeIndex, minutes * 60],
  );
  network.patterns.push(
    [routeIndex, "До Києва", [hubStopIndex, anchorStopIndex], [[lon, lat], [anchor[3], anchor[2]]]],
    [routeIndex, `До ${name}`, [anchorStopIndex, hubStopIndex], [[anchor[3], anchor[2]], [lon, lat]]],
  );
}

network.sources ||= [];
if (!network.sources.some((source) => source.name === "Kyiv region bus registry")) {
  network.sources.push({
    name: "Kyiv region bus registry",
    status: "registry",
    url: "https://koda.gov.ua/gromadskosti/vidkryti-dani/pasazhyrski-perevezennya/reyestr-mizhmiskyh-ta-prymiskyh-vnutrishnooblasnyh-avtobusnyh-marshrutiv-zagalnogo-korystuvannya-organizatorom-yakyh-ye-kyyivska-oblasna-derzhavna-administracziya/",
  });
}

writeFileSync(networkPath, JSON.stringify(network));
console.log(`Added regional registry routes; ${network.routes.length} routes total`);
