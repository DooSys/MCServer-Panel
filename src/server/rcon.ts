import { Rcon } from "rcon-client";
import { config } from "./config.js";

const DEFAULT_TIMEOUT_MS = 5000;

export const SAFE_COMMAND_PREFIXES = [
  "list",
  "gamerule",
  "whitelist",
  "op",
  "deop",
  "save-all",
  "say",
  "difficulty",
  "time",
  "weather",
  "datapack",
  "kick"
];

export const DANGEROUS_COMMANDS = ["stop", "ban", "ban-ip", "pardon", "pardon-ip", "reload", "save-off"];

export function commandAllowed(command: string) {
  const normalized = command.trim().replace(/^\//, "");
  const head = normalized.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (DANGEROUS_COMMANDS.includes(head)) {
    return config.allowStopServer && head === "stop";
  }
  return SAFE_COMMAND_PREFIXES.includes(head);
}

export async function runRcon(command: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const normalized = command.trim().replace(/^\//, "");
  if (!normalized) {
    throw Object.assign(new Error("Empty RCON command"), { status: 400 });
  }

  const rcon = await Rcon.connect({
    host: config.rconHost,
    port: config.rconPort,
    password: config.rconPassword,
    timeout: timeoutMs
  });

  try {
    return await rcon.send(normalized);
  } finally {
    await rcon.end();
  }
}

export function parseListResponse(response: string) {
  const match = response.match(/There are\s+(\d+)\s+of\s+a max of\s+(\d+)\s+players online:?\s*(.*)$/i);
  if (!match) {
    return { online: 0, max: null, players: [] as string[] };
  }

  const players = match[3]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return {
    online: Number(match[1]),
    max: Number(match[2]),
    players
  };
}
