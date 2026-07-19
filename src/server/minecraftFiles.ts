import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { withinMcData } from "./paths.js";
import type { LogDetection } from "../shared/types.js";

export async function readTextFile(relativePath: string, maxBytes = 512_000) {
  const resolved = withinMcData(relativePath);
  const fileStat = await stat(resolved);
  if (!fileStat.isFile()) {
    throw Object.assign(new Error("Not a file"), { status: 400 });
  }
  if (fileStat.size > maxBytes) {
    const handle = await readFile(resolved);
    return handle.subarray(Math.max(0, handle.length - maxBytes)).toString("utf8");
  }
  return readFile(resolved, "utf8");
}

export async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readTextFile(relativePath)) as T;
  } catch {
    return fallback;
  }
}

export async function readServerProperties() {
  const raw = await readTextFile("server.properties").catch(() => "");
  const entries = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)] as const;
    });

  return Object.fromEntries(entries);
}

export async function listDatapacks() {
  const datapacksDir = withinMcData("world", "datapacks");
  try {
    const entries = await readdir(datapacksDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() || entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        relativePath: path.posix.join("world/datapacks", entry.name),
        disabled: entry.name.endsWith(".disabled")
      }));
  } catch {
    return [];
  }
}

export async function latestLog() {
  return readTextFile("logs/latest.log", 1_000_000);
}

export function detectLogEvents(content: string): LogDetection[] {
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap<LogDetection>((line) => {
      const lower = line.toLowerCase();
      if (lower.includes("error")) return [{ type: "error" as const, line }];
      if (lower.includes("warn")) return [{ type: "warn" as const, line }];
      if (lower.includes("rcon")) return [{ type: "rcon" as const, line }];
      if (lower.includes("info")) return [{ type: "info" as const, line }];
      if (lower.includes("crash")) return [{ type: "crash" as const, line }];
      if (lower.includes("joined the game")) return [{ type: "join" as const, line }];
      if (lower.includes("not white-listed")) return [{ type: "whitelist" as const, line }];
      if (lower.includes("datapack") && lower.includes("fail")) return [{ type: "datapack" as const, line }];
      if (lower.includes("saved the game") || lower.includes("saved the world")) return [{ type: "save" as const, line }];
      return [];
    });
}
