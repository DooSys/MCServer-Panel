import path from "node:path";
import { mkdir } from "node:fs/promises";
import { config } from "./config.js";

const dataRoot = path.resolve(config.mcDataPath);

export function withinMcData(...parts: string[]) {
  const resolved = path.resolve(dataRoot, ...parts);
  const relative = path.relative(dataRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw Object.assign(new Error("Path traversal blocked"), { status: 400 });
  }

  return resolved;
}

export async function ensureMcDir(...parts: string[]) {
  const resolved = withinMcData(...parts);
  await mkdir(resolved, { recursive: true });
  return resolved;
}

export function publicMcPath(absPath: string) {
  return `/${path.relative(dataRoot, absPath).replaceAll(path.sep, "/")}`;
}

export const mcDataRoot = dataRoot;
