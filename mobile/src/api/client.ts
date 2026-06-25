// Thin fetch wrapper for the Next web app's mobile API
// (src/app/api/mobile/*). Base URL is EXPO_PUBLIC_API_URL — EXPO_PUBLIC_
// prefix is required for Expo to inline it into the client bundle.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let authToken: string | null = null;

/** Set (or clear, with null) the bearer token attached to every request. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  if (init.headers) Object.assign(headers, init.headers as Record<string, string>);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
