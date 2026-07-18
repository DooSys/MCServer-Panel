import { config } from "./config.js";

type AuditPayload = {
  user?: string | null;
  server?: string | null;
  action: string;
  payload?: unknown;
  result?: unknown;
};

let cachedToken: string | null = null;

async function superuserToken() {
  const email = process.env.PB_SUPERUSER_EMAIL;
  const password = process.env.PB_SUPERUSER_PASSWORD;
  if (!email || !password) return null;
  if (cachedToken) return cachedToken;

  const response = await fetch(`${config.pocketBaseUrl}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity: email, password })
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { token?: string };
  cachedToken = data.token ?? null;
  return cachedToken;
}

export async function auditLog(entry: AuditPayload) {
  try {
    const token = await superuserToken();
    if (!token) return;

    await fetch(`${config.pocketBaseUrl}/api/collections/action_logs/records`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        user: entry.user ?? "",
        server: entry.server ?? "",
        action: entry.action,
        payload: entry.payload ?? {},
        result: entry.result ?? {}
      })
    });
  } catch (error) {
    console.warn("[audit] action log skipped:", error instanceof Error ? error.message : error);
  }
}
