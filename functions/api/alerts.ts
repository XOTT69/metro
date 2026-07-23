const OFFICIAL_CHANNEL = "https://t.me/s/KyivCityOfficial";
const TRANSPORT_PATTERN =
  /метро|метрополітен|транспорт|тролейбус|автобус|трамва|електричк|фунікулер|маршрут/iu;

function decodeEntities(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
    "#33": "!",
    "#39": "'",
  };
  return value.replace(/&([^;]+);/g, (match, key) => {
    if (entities[key]) return entities[key];
    if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    return match;
  });
}

function cleanText(html: string) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

export async function onRequestGet() {
  const response = await fetch(OFFICIAL_CHANNEL, {
    headers: { "User-Agent": "MetroKyivPWA/1.0 (+https://metro-kyiv.pages.dev)" },
  });
  if (!response.ok) {
    return Response.json({ alerts: [], error: "Official feed unavailable" }, { status: 502 });
  }
  const html = await response.text();
  const alerts = [];
  const pattern =
    /data-post="KyivCityOfficial\/(\d+)"[\s\S]*?<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<time datetime="([^"]+)"/g;

  for (const match of html.matchAll(pattern)) {
    const text = cleanText(match[2]);
    if (!TRANSPORT_PATTERN.test(text)) continue;
    const firstLine = text.split("\n").find(Boolean) || "Зміни в роботі транспорту";
    alerts.push({
      id: match[1],
      title: firstLine.slice(0, 180),
      text: text.slice(0, 700),
      publishedAt: match[3],
      url: `https://t.me/KyivCityOfficial/${match[1]}`,
      source: "КМДА",
    });
  }

  return Response.json(
    { alerts: alerts.reverse().slice(0, 10), checkedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=180",
        "X-Data-Source": "Official KMDA Telegram channel",
      },
    },
  );
}
