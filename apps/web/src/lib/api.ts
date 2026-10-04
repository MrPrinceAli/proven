import { publicEnv } from "./env";

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
}

export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail ?? problem.title);
  }
  get status() {
    return this.problem.status;
  }
}

/** Calls the same-origin API (D-003) with the session cookie and turns RFC 9457 problems into ApiError. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData))
    headers.set("content-type", "application/json");

  const res = await fetch(`${publicEnv.apiUrl}${path}`, { ...init, headers, credentials: "include" });
  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      body && typeof body === "object" && "status" in body
        ? (body as Problem)
        : { type: "about:blank", title: res.statusText || "Request failed", status: res.status },
    );
  }
  return body as T;
}
