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
  };
};

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
    `https://metro-kyiv.pages.dev/api/geocode?q=${encodeURIComponent(
      input.toLocaleLowerCase("uk-UA"),
    )}`,
  );
  const edgeCache = caches.default;
  const cached = await edgeCache.match(cacheKey);
  if (cached) return cached;

  const query = new URLSearchParams({
    q: `${input}, Київ, Україна`,
    format: "jsonv2",
    addressdetails: "1",
    limit: "6",
    countrycodes: "ua",
    bounded: "1",
    viewbox: "30.239,50.590,30.825,50.213",
    "accept-language": "uk",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MetroKyivPWA/1.0 (+https://metro-kyiv.pages.dev)",
    },
  });
  if (!response.ok) {
    return Response.json(
      { results: [], error: "Пошук адрес тимчасово недоступний" },
      { status: 502 },
    );
  }

  const source = (await response.json()) as NominatimResult[];
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
