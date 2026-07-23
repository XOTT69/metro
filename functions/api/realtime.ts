import {
  fetchWithTimeout,
  upstreamErrorResponse,
} from "./upstream.ts";

// Cloudflare Workers cannot fetch a literal IP address. sslip.io resolves this
// hostname to the official Kyiv City API host without changing the upstream.
const DEFAULT_REALTIME_URL =
  "http://193-23-225-214.sslip.io:732/api/realtime";

type RealtimeEnv = {
  REALTIME_UPSTREAM_URL?: string;
};

export async function onRequestGet({
  env,
}: {
  env?: RealtimeEnv;
} = {}) {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      env?.REALTIME_UPSTREAM_URL || DEFAULT_REALTIME_URL,
      {
        headers: { Accept: "application/x-protobuf" },
      },
      7_000,
    );
  } catch (error) {
    return upstreamErrorResponse(
      error,
      "Realtime transport data is temporarily unavailable",
    );
  }

  if (!response.ok) {
    return Response.json(
      {
        error: "Realtime transport data is temporarily unavailable",
        upstreamStatus: response.status,
      },
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
