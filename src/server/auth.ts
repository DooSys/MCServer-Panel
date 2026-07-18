import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      authCollection?: "users" | "_superusers";
    }
  }
}

type PocketBaseAuthPayload = {
  token?: string;
  record?: { id?: string; collectionName?: string };
};

async function refreshPocketBaseAuth(token: string, collection: "users" | "_superusers") {
  const pbResponse = await fetch(config.pocketBaseUrl + "/api/collections/" + collection + "/auth-refresh", {
    method: "POST",
    headers: { authorization: "Bearer " + token }
  });

  if (!pbResponse.ok) return null;
  return pbResponse.json() as Promise<PocketBaseAuthPayload>;
}

function attachRefreshedAuth(response: Response, payload: PocketBaseAuthPayload) {
  if (!payload.token) return;
  response.setHeader("x-pocketbase-token", payload.token);
  if (payload.record) {
    response.setHeader("x-pocketbase-record", encodeURIComponent(JSON.stringify(payload.record)));
  }
}

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  if (process.env.REQUIRE_AUTH === "false") {
    request.userId = "local-dev";
    request.authCollection = "users";
    next();
    return;
  }

  const header = request.header("authorization");
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    response.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const userPayload = await refreshPocketBaseAuth(token, "users");
    if (userPayload) {
      attachRefreshedAuth(response, userPayload);
      request.userId = userPayload.record?.id;
      request.authCollection = "users";
      next();
      return;
    }

    const superuserPayload = await refreshPocketBaseAuth(token, "_superusers");
    if (superuserPayload) {
      attachRefreshedAuth(response, superuserPayload);
      request.userId = superuserPayload.record?.id;
      request.authCollection = "_superusers";
      next();
      return;
    }

    response.status(401).json({ error: "Invalid PocketBase session" });
  } catch {
    response.status(503).json({ error: "PocketBase auth unavailable" });
  }
}
