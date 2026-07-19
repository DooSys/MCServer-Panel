import PocketBase, { LocalAuthStore } from "pocketbase";

function clearLegacyPanelAuthStore() {
  try {
    const raw = window.localStorage.getItem("pocketbase_auth");
    if (raw === null || raw === "") return;
    const legacy = JSON.parse(raw) as { record?: { collectionName?: string }; model?: { collectionName?: string } };
    const collectionName = legacy.record?.collectionName ?? legacy.model?.collectionName;
    if (collectionName !== "_superusers") {
      window.localStorage.removeItem("pocketbase_auth");
    }
  } catch {
    window.localStorage.removeItem("pocketbase_auth");
  }
}

clearLegacyPanelAuthStore();

export const pb = new PocketBase("/pb", new LocalAuthStore("mcserver_panel_auth"));
pb.autoCancellation(false);

export function authHeader() {
  return pb.authStore.token ? { authorization: "Bearer " + pb.authStore.token } : {};
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (!(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const requestToken = pb.authStore.token;
  const auth = authHeader();
  if (auth.authorization) headers.set("authorization", auth.authorization);

  const response = await fetch("/panel-api" + path, { ...init, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  const refreshedToken = response.headers.get("x-pocketbase-token");
  if (refreshedToken) {
    const refreshedRecord = response.headers.get("x-pocketbase-record");
    let record = pb.authStore.record;
    if (refreshedRecord) {
      try {
        record = JSON.parse(decodeURIComponent(refreshedRecord));
      } catch {
        record = pb.authStore.record;
      }
    }
    if (!requestToken || pb.authStore.token === requestToken) {
      pb.authStore.save(refreshedToken, record as never);
    }
  }

  if (!response.ok) {
    const message = data?.error ?? "HTTP " + response.status;
    if (response.status === 401 && /auth|session|token/i.test(message) && pb.authStore.token === requestToken) {
      pb.authStore.clear();
    }
    throw new Error(message);
  }
  return data as T;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export async function loginWithPassword(identity: string, password: string) {
  const data = await postJson<{ token: string; record: Record<string, unknown> }>("/auth/login", { identity, password });
  pb.authStore.save(data.token, data.record as never);
  return data;
}
