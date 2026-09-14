// One way to turn an API call into data or a message a person can read.
export class ApiError extends Error {
  status: number | null;
  // Seconds to wait, from the Retry-After header of a 429.
  retryAfter: number | null;

  constructor(message: string, status: number | null = null, retryAfter: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

type Result<T> = { data?: T; error?: unknown; response: Response };

export async function call<T>(send: () => Promise<Result<T>>): Promise<T> {
  let result: Result<T>;
  try {
    result = await send();
  } catch {
    // fetch throws only when no answer came back at all (offline, or blocked by the browser, as with CORS).
    throw new ApiError("Can't reach the API. Check your connection, or try again in a minute.");
  }
  const { data, error, response } = result;
  if (data === undefined) {
    const retryAfter = Number(response.headers.get("Retry-After")) || null;
    throw new ApiError(refusedMessage(response.status, error), response.status, retryAfter);
  }
  return data;
}

// Shows the API's own words. A proxy error page (not Problem Details) gets just the status.
function refusedMessage(status: number, body: unknown): string {
  const detail = typeof body === "object" && body !== null && "detail" in body ? String(body.detail) : "";
  return `The API answered ${status}${detail ? `: ${detail}` : "."}`;
}

export function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : `Something went wrong on this page: ${String(error)}`;
}

export const isTokenRefused = (error: unknown) => error instanceof ApiError && error.status === 401;
