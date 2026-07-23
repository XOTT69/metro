export class UpstreamTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Upstream request exceeded ${timeoutMs} ms`);
    this.name = "UpstreamTimeoutError";
  }
}

export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs = 8_000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new UpstreamTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function upstreamErrorResponse(
  error: unknown,
  message: string,
  payload: Record<string, unknown> = {},
) {
  const timedOut = error instanceof UpstreamTimeoutError;
  return Response.json(
    {
      ...payload,
      error: message,
      reason: timedOut ? "timeout" : "upstream_failure",
    },
    { status: timedOut ? 504 : 502 },
  );
}
