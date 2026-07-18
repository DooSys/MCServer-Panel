import type { NextFunction, Request, Response } from "express";
import { config } from "./config.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  if (process.env.REQUIRE_AUTH === "false") {
    request.userId = "local-dev";
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
    const pbResponse = await fetch(`${config.pocketBaseUrl}/api/collections/users/auth-refresh`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` }
    });

    if (!pbResponse.ok) {
      response.status(401).json({ error: "Invalid PocketBase session" });
      return;
    }

    const payload = (await pbResponse.json()) as { record?: { id?: string } };
    request.userId = payload.record?.id;
    next();
  } catch {
    response.status(503).json({ error: "PocketBase auth unavailable" });
  }
}
