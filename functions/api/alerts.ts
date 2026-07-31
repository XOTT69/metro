import {
  fetchWithTimeout,
  upstreamErrorResponse,
} from "./upstream.ts";

const OFFICIAL_FEED = "https://r.jina.ai/http://metro.kyiv.ua/rss.xml";
const OPERATIONAL_PATTERN =
  /тривог|змін\S* рух|рух\S* змін|зупинен\S* рух|обмеж|призупин|не курсу|закрит|віднов|укрит/iu;

function decodeEntities(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    rsquo: "’",
    laquo: "«",
    raquo: "»",
  };
  return value.replace(/&([^;]+);/g, (match, key) => {
    if (entities[key]) return entities[key];
    if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    return match;
  });
}

function cleanText(value: string) {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getTag(item: string, tag: string) {
  return item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? "";
}

function parseOfficialAlerts(source: string) {
  if (source.includes("<item>")) {
    return [...source.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => {
      const item = match[1];
      const title = cleanText(getTag(item, "title"));
      const text = cleanText(getTag(item, "description"));
      const link = cleanText(getTag(item, "link"));
      const publishedAt = cleanText(getTag(item, "pubDate"));
      const guid = cleanText(getTag(item, "guid"));
      return {
        id: guid.match(/\d+/)?.[0] ?? link,
        title,
        text,
        publishedAt: Number.isNaN(Date.parse(publishedAt)) ? new Date(0).toISOString() : new Date(publishedAt).toISOString(),
        url: link,
        source: "Київський метрополітен",
      };
    });
  }

  const sourcePublishedAt = source.match(/^Published Time:\s*(.+)$/m)?.[1] ?? "";
  const publishedAt = Number.isNaN(Date.parse(sourcePublishedAt))
    ? new Date(0).toISOString()
    : new Date(sourcePublishedAt).toISOString();
  return [...source.matchAll(/^### \[([^\]]+)\]\(([^)]+)\)\n\n([\s\S]*?)(?=^### |(?![\s\S]))/gm)].map((match) => ({
    id: match[2].match(/\d+/)?.[0] ?? match[2],
    title: cleanText(match[1]),
    text: cleanText(match[3]).slice(0, 2_000),
    publishedAt,
    url: match[2],
    source: "Київський метрополітен",
  }));
}

export async function onRequestGet() {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      OFFICIAL_FEED,
      { headers: { "User-Agent": "MetroKyivPWA/1.0 (+https://metrokyiv.pp.ua)" } },
      10_000,
    );
  } catch (error) {
    return upstreamErrorResponse(error, "Official metro feed unavailable", { alerts: [] });
  }

  if (!response.ok) {
    return Response.json({ alerts: [], error: "Official metro feed unavailable" }, { status: 502 });
  }

  let xml: string;
  try {
    xml = await response.text();
  } catch (error) {
    return upstreamErrorResponse(error, "Official metro feed could not be read", { alerts: [] });
  }

  const alerts = parseOfficialAlerts(xml)
    .filter((alert) => alert.id && OPERATIONAL_PATTERN.test(`${alert.title} ${alert.text.slice(0, 700)}`))
    .slice(0, 10);

  return Response.json(
    { alerts, checkedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=180",
        "X-Data-Source": "metro.kyiv.ua RSS via read-only proxy",
      },
    },
  );
}
