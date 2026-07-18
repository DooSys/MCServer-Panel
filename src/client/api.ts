import PocketBase from "pocketbase";

export const pb = new PocketBase("/pb");
pb.autoCancellation(false);

export function authHeader() {
  return pb.authStore.token ? { authorization: `Bearer ${pb.authStore.token}` } : {};
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (!(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const auth = authHeader();
  if (auth.authorization) headers.set("authorization", auth.authorization);

  const response = await fetch(`/api${path}`, { ...init, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error ?? `HTTP ${response.status}`);
  }
  return data as T;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
}
