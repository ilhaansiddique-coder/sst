import "server-only";

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export type ApiJsonInit = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
  token?: string | null;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiJson<T>(path: string, init: ApiJsonInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.token) {
    headers.set("authorization", `Bearer ${init.token}`);
  }

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? `Couldn't reach the API at ${apiBaseUrl}. Make sure the frontend, API, database, and Redis services are running.`
        : "Couldn't reach the API. Make sure the required services are running.";

    throw new ApiRequestError(message, 0, {
      cause: error instanceof Error ? error.message : String(error),
      path,
    });
  }

  if (!response.ok) {
    let payload: unknown;
    let message = `API request failed for ${path}`;
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }

    if (payload && typeof payload === "object" && "message" in payload) {
      const candidate = (payload as { message?: string | string[] }).message;
      message = Array.isArray(candidate) ? candidate.join(", ") : candidate ?? message;
    } else if (typeof payload === "string" && payload.trim().length > 0) {
      message = payload.trim();
    }

    throw new ApiRequestError(message, response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
