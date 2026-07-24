import {
  fetchWithTimeout,
  upstreamErrorResponse,
} from "./upstream.ts";

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  name?: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
  };
};

const REGION_PLACE_NAMES = [
  "ірпін",
  "буч",
  "гостомел",
  "вишгород",
  "бровар",
  "бориспіл",
  "вишнев",
  "бояр",
  "васильків",
  "фастів",
  "біла церква",
  "обухів",
  "українк",
  "переяслав",
];

function compactName(result: NominatimResult) {
  const street = [result.address?.road, result.address?.house_number]
    .filter(Boolean)
    .join(", ");
  return street || result.name || result.display_name.split(",").slice(0, 2).join(",");
}

export async function onRequestGet({ request }: { request: Request }) {
  const input = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (input.length < 3 || input.length > 140) {
    return Response.json(
      { results: [], error: "Введіть щонайменше три символи" },
      { status: 400 },
    );
  }

  const cacheKey = new Request(
    `https://metrokyiv.pp.ua/api/geocode-v2?q=${encodeURIComponent(
      input.toLocaleLowerCase("uk-UA"),
    )}`,
  );
  const edgeCache = (caches as CacheStorage & { default: Cache }).default;
  const cached = await edgeCache.match(cacheKey);
  if (cached) return cached;

  const query = new URLSearchParams({
    q: `${input}, Україна`,
    format: "jsonv2",
    addressdetails: "1",
    limit: "6",
    countrycodes: "ua",
    bounded: "1",
    viewbox: "29.45,51.55,32.35,49.65",
    "accept-language": "uk",
  });
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?${query}`,
      {
        headers: {
          Accept: "application/json",
          Referer: "https://metrokyiv.pp.ua/",
          "User-Agent":
            "MetroKyiv/0.1 (https://metrokyiv.pp.ua/; contact: https://github.com/XOTT69/metro/issues)",
        },
      },
      7_000,
    );
  } catch (error) {
    return upstreamErrorResponse(
      error,
      "Пошук адрес тимчасово недоступний",
      { results: [] },
    );
  }

  if (!response.ok) {
    return Response.json(
      { results: [], error: "Пошук адрес тимчасово недоступний" },
      { status: 502 },
    );
  }

  let source: NominatimResult[];
  try {
    source = (await response.json()) as NominatimResult[];
  } catch (error) {
    return upstreamErrorResponse(
      error,
      "Сервіс адрес повернув некоректну відповідь",
      { results: [] },
    );
  }
  const normalizedInput = input.toLocaleLowerCase("uk-UA");
  const explicitRegion = REGION_PLACE_NAMES.some((name) =>
    normalizedInput.includes(name),
  );
  source.sort((first, second) => {
    const score = (item: NominatimResult) => {
      const place = `${item.address?.city || ""} ${
        item.address?.town || ""
      } ${item.address?.village || ""}`.toLocaleLowerCase("uk-UA");
      if (explicitRegion) {
        return REGION_PLACE_NAMES.some(
          (name) => normalizedInput.includes(name) && place.includes(name),
        )
          ? 20
          : 0;
      }
      return item.address?.city === "Київ" ? 10 : 0;
    };
    return score(second) - score(first);
  });
  const result = Response.json(
    {
      results: source.map((item) => ({
        id: `osm:${item.place_id}`,
        name: compactName(item),
        detail: item.display_name,
        lat: Number(item.lat),
        lon: Number(item.lon),
        type: item.type || "place",
      })),
      attribution: "© OpenStreetMap contributors",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Data-Source": "OpenStreetMap Nominatim",
      },
    },
  );
  await edgeCache.put(cacheKey, result.clone());
  return result;
}
