// Cloudflare Workers cannot fetch a literal IP address. sslip.io resolves this
// hostname to the official Kyiv City API host without changing the upstream.
const REALTIME_URL = "http://193-23-225-214.sslip.io:732/api/realtime";

export async function onRequestGet() {
  const response = await fetch(REALTIME_URL, {
    headers: { Accept: "application/x-protobuf" },
  });
  if (!response.ok) {
    return Response.json(
      { error: "Realtime transport data is temporarily unavailable" },
      { status: 502 },
    );
  }
  return new Response(response.body, {
    headers: {
      "Content-Type": "application/x-protobuf",
      "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
      "X-Data-Source": "Kyiv City Open Data",
    },
  });
}
