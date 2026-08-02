/**
 * Global network helper: timeout, retries, offline detection.
 * Uses credentials for session cookie auth; also sends Bearer when token provided.
 */

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  token?: string | null;
  signal?: AbortSignal;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(status: number, error: unknown) {
  if (error instanceof TypeError) return true; // network fail
  if (error instanceof DOMException && error.name === "AbortError") return false;
  return status === 408 || status === 429 || status >= 500;
}

export async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    timeoutMs = 25000,
    retries = 2,
    retryDelayMs = 800,
    token,
    signal,
  } = options;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError("No network connection", 0);
  }

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onOuterAbort = () => controller.abort();
    signal?.addEventListener("abort", onOuterAbort);

    try {
      const response = await fetch(path, {
        method,
        credentials: "include",
        headers: {
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);
      signal?.removeEventListener("abort", onOuterAbort);

      const text = await response.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }

      if (!response.ok) {
        const message =
          typeof json === "object" && json && "error" in json
            ? String((json as { error: string }).error)
            : `Request failed (${response.status})`;
        if (attempt < retries && isRetryable(response.status, null)) {
          attempt += 1;
          await sleep(retryDelayMs * attempt);
          continue;
        }
        throw new ApiError(message, response.status, json);
      }

      return json as T;
    } catch (error) {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onOuterAbort);
      lastError = error;
      const status = error instanceof ApiError ? error.status : 0;
      if (attempt < retries && isRetryable(status, error)) {
        attempt += 1;
        await sleep(retryDelayMs * attempt);
        continue;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError("Request timed out", 408);
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError(error instanceof Error ? error.message : "Network request failed", 0);
    }
  }

  throw lastError instanceof Error ? lastError : new ApiError("Network request failed", 0);
}
