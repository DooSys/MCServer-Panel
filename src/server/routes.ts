import { copyFile, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import express from "express";
import multer from "multer";
import { GAMERULES } from "../shared/gamerules.js";
import type { AddonPackage, LogPayload, LogSource, LogSourceId, PlayerSummary, ServerStatus } from "../shared/types.js";
import { auditLog } from "./audit.js";
import { getCatalogVersions, installCatalogPackage, searchCatalog } from "./catalog.js";
import { config } from "./config.js";
import { minecraftGameruleAliases, parseGameruleValue } from "./gameruleMapper.js";
import { inspectDockerContainer, readDockerContainerLogs } from "./dockerLogs.js";
import { detectLogEvents, latestLog, listDatapacks, readJsonFile, readServerProperties, readTextFile } from "./minecraftFiles.js";
import { inspectPackage } from "./packageInspector.js";
import { ensureMcDir, publicMcPath, withinMcData } from "./paths.js";
import { commandAllowed, parseListResponse, runRcon, testRconTcp } from "./rcon.js";

export const apiRouter = express.Router();

const upload = multer({
  dest: "/tmp/mcserver-panel-uploads",
  limits: {
    fileSize: config.uploadLimitMb * 1024 * 1024,
    files: 1
  }
});


function detectServerFlavor(logContent: string, props: Record<string, string>, dockerEnv: Record<string, string> = {}) {
  const lower = logContent.toLowerCase();
  if (lower.includes('purpur')) return 'Purpur';
  if (lower.includes('paper')) return 'Paper';
  if (lower.includes('spigot')) return 'Spigot';
  if (lower.includes('bukkit')) return 'Bukkit';
  if (lower.includes('fabric')) return 'Fabric';
  if (lower.includes('forge')) return 'Forge';

  const dockerType = String(dockerEnv.TYPE ?? '').trim();
  if (dockerType) return dockerType.charAt(0).toUpperCase() + dockerType.slice(1).toLowerCase();

  if (props['level-type'] || props.gamemode || logContent) return 'Vanilla';
  return 'Unknown';
}

function detectMinecraftVersion(logContent: string, props: Record<string, string>, dockerEnv: Record<string, string> = {}) {
  const versionMatch = logContent.match(new RegExp('Starting minecraft server version\\s+([^\\r\\n]+)', 'i'));
  if (versionMatch) return versionMatch[1].trim();
  const paperMatch = logContent.match(new RegExp('Minecraft\\s+version\\s+([^\\r\\n]+)', 'i'));
  if (paperMatch) return paperMatch[1].trim();
  const dockerVersion = String(dockerEnv.VERSION ?? '').trim();
  if (dockerVersion) return dockerVersion;
  return props.version || 'Unknown';
}


function normalizeUpdateStatus(value: string, fallbackMessage: string) {
  if (value === 'current') return { status: 'current' as const, message: 'Up to date' };
  if (value === 'update_available') return { status: 'update_available' as const, message: 'Update available' };
  if (value === 'unknown') return { status: 'unknown' as const, message: fallbackMessage };
  return { status: 'not_checked' as const, message: fallbackMessage };
}


async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 3500): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json", "user-agent": config.catalogUserAgent } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

async function minecraftUpdateStatus(serverFlavor: string, minecraftVersion: string) {
  const current = minecraftVersion && minecraftVersion !== "Unknown" ? minecraftVersion : "";
  if (!config.enableMinecraftUpdateCheck) {
    return { status: "not_checked" as const, message: "Vérification désactivée" };
  }
  if (!current) {
    return { status: "not_configured" as const, message: "Version Minecraft non détectée" };
  }

  const flavor = serverFlavor.toLowerCase();
  try {
    if (flavor.includes("paper")) {
      const data = await fetchJsonWithTimeout<{ versions: string[] }>("https://api.papermc.io/v2/projects/paper");
      const latest = data.versions.at(-1);
      return latest === current
        ? { status: "current" as const, message: "Paper à jour (" + latest + ")", checkedAt: new Date().toISOString() }
        : { status: "update_available" as const, message: "Paper " + latest + " disponible", checkedAt: new Date().toISOString() };
    }

    if (flavor.includes("vanilla") || flavor === "unknown") {
      const data = await fetchJsonWithTimeout<{ latest: { release: string } }>("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
      const latest = data.latest.release;
      return latest === current
        ? { status: "current" as const, message: "Minecraft à jour (" + latest + ")", checkedAt: new Date().toISOString() }
        : { status: "update_available" as const, message: "Minecraft " + latest + " disponible", checkedAt: new Date().toISOString() };
    }

    return { status: "unknown" as const, message: "Vérification non disponible pour " + serverFlavor };
  } catch (error) {
    return { status: "unknown" as const, message: "Vérification impossible: " + (error instanceof Error ? error.message : "erreur réseau"), checkedAt: new Date().toISOString() };
  }
}

function asyncRoute(handler: express.RequestHandler): express.RequestHandler {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function configuredLogSources(): LogSource[] {
  return [
    { id: "minecraft-container", label: "Minecraft container", kind: "docker", detail: config.mcContainerName },
    { id: "panel-container", label: "MCServer-panel container", kind: "docker", detail: config.panelContainerName },
    { id: "minecraft-latest", label: "Minecraft latest.log", kind: "file", detail: "mc-data/logs/latest.log" }
  ];
}

function logSourceById(id: string) {
  return configuredLogSources().find((source) => source.id === id);
}

async function readLogPayload(sourceId: LogSourceId, tail: number): Promise<LogPayload> {
  const source = logSourceById(sourceId);
  if (!source) throw Object.assign(new Error("Unknown log source"), { status: 404 });

  if (source.id === "minecraft-latest") {
    const content = await latestLog().catch((error) => "Unable to read latest.log: " + (error instanceof Error ? error.message : String(error)));
    return { source, content, detections: detectLogEvents(content), generatedAt: new Date().toISOString(), tail };
  }

  const container = source.id === "minecraft-container" ? config.mcContainerName : config.panelContainerName;
  const dockerLogs = await readDockerContainerLogs(container, tail);
  return {
    source: { ...source, detail: dockerLogs.container },
    content: dockerLogs.error ? "Unable to read Docker logs for " + dockerLogs.container + ": " + dockerLogs.error : dockerLogs.content,
    detections: detectLogEvents(dockerLogs.content),
    generatedAt: dockerLogs.generatedAt,
    tail: dockerLogs.tail,
    error: dockerLogs.error
  };
}

function assertValidGameruleResponse(result: string, minecraftKey: string) {
  const lower = result.toLowerCase();
  const invalid = [
    "unknown rule",
    "unknown gamerule",
    "no such gamerule",
    "incorrect argument",
    "unknown or incomplete command"
  ].some((fragment) => lower.includes(fragment));
  if (invalid) {
    throw new Error("Gamerule " + minecraftKey + " unavailable: " + result.trim());
  }
}

async function readGameruleValue(key: string) {
  let lastError: unknown;
  for (const minecraftKey of minecraftGameruleAliases(key)) {
    try {
      const result = await runRcon("gamerule " + minecraftKey);
      assertValidGameruleResponse(result, minecraftKey);
      const value = parseGameruleValue(result);
      if (value === null) throw new Error("Gamerule " + minecraftKey + " returned no value");
      return { minecraftKey, value, result };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gamerule unavailable");
}

async function writeGameruleValue(key: string, value: string) {
  let lastError: unknown;
  for (const minecraftKey of minecraftGameruleAliases(key)) {
    try {
      const result = await runRcon("gamerule " + minecraftKey + " " + value);
      assertValidGameruleResponse(result, minecraftKey);
      return { minecraftKey, result };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gamerule unavailable");
}

async function statusPayload(): Promise<ServerStatus> {
  const props = await readServerProperties();
  const logContent = await latestLog().catch(() => '');
  const minecraftContainer = await inspectDockerContainer(config.mcContainerName);
  const dockerImage = minecraftContainer.image ?? "unknown";
  const dockerImageParts = dockerImage.split(":");
  const dockerImageTag = dockerImageParts.length > 1 ? dockerImageParts.at(-1) ?? "unknown" : "unknown";
  const minecraftVersion = detectMinecraftVersion(logContent, props, minecraftContainer.env);
  const serverFlavor = detectServerFlavor(logContent, props, minecraftContainer.env);
  const minecraftUpdate = await minecraftUpdateStatus(serverFlavor, minecraftVersion);
  const base = {
    rconHost: config.rconHost,
    rconPort: config.rconPort,
    motd: props.motd,
    version: props.version,
    minecraftVersion,
    type: minecraftContainer.env.TYPE ? "itzg/" + minecraftContainer.env.TYPE.toLowerCase() : "itzg/java",
    serverFlavor,
    dockerImage: dockerImageParts[0] || dockerImage,
    dockerImageTag,
    imageUpdate: minecraftUpdate,
    minecraftUpdate,
    panelVersion: config.appVersion,
    panelImage: config.appDockerImage,
    panelImageTag: config.appDockerTag,
    panelUpdate: normalizeUpdateStatus(config.panelUpdateStatus, 'Panel update check not configured'),
    gameMode: props.gamemode,
    difficulty: props.difficulty,
    whitelist: props["white-list"] === "true",
    lastChecked: new Date().toISOString()
  };

  try {
    const listResponse = await runRcon("list");
    const parsed = parseListResponse(listResponse);
    return {
      ...base,
      online: true,
      rconOk: true,
      playersOnline: parsed.online,
      playersMax: parsed.max,
      players: parsed.players
    };
  } catch (error) {
    return {
      ...base,
      online: false,
      rconOk: false,
      playersOnline: 0,
      playersMax: null,
      players: [],
      rconError: error instanceof Error ? error.message : "RCON unavailable",
      error: error instanceof Error ? error.message : "RCON unavailable"
    };
  }
}

apiRouter.get("/health", (_request, response) => {
  response.json({ ok: true, service: "mcserver-panel" });
});

apiRouter.get("/app/config", (_request, response) => {
  response.json({ pocketBaseUrl: "/pb", publicUrl: config.publicUrl, authRequired: process.env.REQUIRE_AUTH !== "false" });
});

apiRouter.post("/auth/login", asyncRoute(async (request, response) => {
  const identity = String((request.body as { identity?: string }).identity ?? "").trim();
  const password = String((request.body as { password?: string }).password ?? "");

  if (!identity || !password) {
    response.status(400).json({ error: "Missing identity or password" });
    return;
  }

  async function tryLogin(collection: "users" | "_superusers") {
    const pbResponse = await fetch(`${config.pocketBaseUrl}/api/collections/${collection}/auth-with-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identity, password })
    });
    const text = await pbResponse.text();
    const data = text ? JSON.parse(text) : null;
    return { ok: pbResponse.ok, status: pbResponse.status, data, collection };
  }

  const userLogin = await tryLogin("users");
  if (userLogin.ok) {
    response.json({ ...userLogin.data, authCollection: "users" });
    return;
  }

  const superuserLogin = await tryLogin("_superusers");
  if (superuserLogin.ok) {
    response.json({ ...superuserLogin.data, authCollection: "_superusers" });
    return;
  }

  response.status(userLogin.status || superuserLogin.status || 401).json({
    error: userLogin.data?.message ?? superuserLogin.data?.message ?? "Login failed",
    details: { users: userLogin.data?.data, superusers: superuserLogin.data?.data }
  });
}));

apiRouter.get("/server/status", asyncRoute(async (_request, response) => {
  response.json(await statusPayload());
}));

apiRouter.get("/diagnostics/rcon", asyncRoute(async (_request, response) => {
  const tcp = await testRconTcp();
  let command: { ok: boolean; result?: string; error?: string } = { ok: false };

  if (tcp.ok) {
    try {
      command = { ok: true, result: await runRcon("list") };
    } catch (error) {
      command = { ok: false, error: error instanceof Error ? error.message : "RCON command failed" };
    }
  }

  response.json({
    host: config.rconHost,
    port: config.rconPort,
    passwordConfigured: Boolean(config.rconPassword),
    tcp,
    command
  });
}));

apiRouter.post("/server/quick-action", asyncRoute(async (request, response) => {
  const { action, message } = request.body as { action?: string; message?: string };
  const commandMap: Record<string, string> = {
    save_all: "save-all",
    time_day: "time set day",
    weather_clear: "weather clear",
    stop: "stop"
  };

  const command = action === "say" ? `say ${String(message ?? "").slice(0, 200)}` : commandMap[String(action)];
  if (!command) {
    response.status(400).json({ error: "Unknown quick action" });
    return;
  }
  if (!commandAllowed(command)) {
    response.status(403).json({ error: "Command not allowed" });
    return;
  }

  const result = await runRcon(command);
  await auditLog({ user: request.userId, action: `quick.${action}`, payload: { message }, result });
  response.json({ result });
}));

apiRouter.post("/rcon/command", asyncRoute(async (request, response) => {
  const command = String((request.body as { command?: string }).command ?? "");
  if (!commandAllowed(command)) {
    response.status(403).json({ error: "Command not allowed for this role/MVP" });
    return;
  }

  const result = await runRcon(command);
  await auditLog({ user: request.userId, action: "rcon.command", payload: { command }, result });
  response.json({ result });
}));

apiRouter.get("/gamerules", asyncRoute(async (_request, response) => {
  const rules = await Promise.all(GAMERULES.map(async (definition) => {
    try {
      const state = await readGameruleValue(definition.key);
      return { ...definition, minecraftKey: state.minecraftKey, currentValue: state.value, available: true };
    } catch (error) {
      return { ...definition, currentValue: null, available: false, error: error instanceof Error ? error.message : "Unavailable" };
    }
  }));

  response.json({ rules });
}));

apiRouter.post("/gamerules/:key", asyncRoute(async (request, response) => {
  const definition = GAMERULES.find((rule) => rule.key === request.params.key);
  if (!definition) {
    response.status(404).json({ error: "Unknown gamerule" });
    return;
  }

  const value = String((request.body as { value?: string }).value ?? "").trim();
  if (definition.valueType === "boolean" && !["true", "false"].includes(value)) {
    response.status(400).json({ error: "Expected boolean value" });
    return;
  }
  if (definition.valueType === "number" && !/^-?\d+$/.test(value)) {
    response.status(400).json({ error: "Expected integer value" });
    return;
  }

  const state = await writeGameruleValue(definition.key, value);
  await auditLog({ user: request.userId, action: "gamerule.update", payload: { key: definition.key, minecraftKey: state.minecraftKey, value }, result: state.result });
  response.json({ result: state.result, minecraftKey: state.minecraftKey });
}));

apiRouter.get("/players", asyncRoute(async (_request, response) => {
  const list = parseListResponse(await runRcon("list").catch(() => ""));
  const payload: PlayerSummary = {
    online: list.players,
    whitelist: await readJsonFile<Array<Record<string, unknown>>>("whitelist.json", []),
    ops: await readJsonFile<Array<Record<string, unknown>>>("ops.json", [])
  };
  response.json(payload);
}));

apiRouter.post("/players/whitelist", asyncRoute(async (request, response) => {
  const name = String((request.body as { name?: string }).name ?? "").trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
    response.status(400).json({ error: "Invalid Minecraft username" });
    return;
  }
  const result = await runRcon(`whitelist add ${name}`);
  await auditLog({ user: request.userId, action: "player.whitelist.add", payload: { name }, result });
  response.json({ result });
}));

apiRouter.delete("/players/whitelist/:name", asyncRoute(async (request, response) => {
  const name = request.params.name;
  const result = await runRcon(`whitelist remove ${name}`);
  await auditLog({ user: request.userId, action: "player.whitelist.remove", payload: { name }, result });
  response.json({ result });
}));

apiRouter.post("/players/op", asyncRoute(async (request, response) => {
  const name = String((request.body as { name?: string }).name ?? "").trim();
  const result = await runRcon(`op ${name}`);
  await auditLog({ user: request.userId, action: "player.op", payload: { name }, result });
  response.json({ result });
}));

apiRouter.delete("/players/op/:name", asyncRoute(async (request, response) => {
  const name = request.params.name;
  const result = await runRcon(`deop ${name}`);
  await auditLog({ user: request.userId, action: "player.deop", payload: { name }, result });
  response.json({ result });
}));

apiRouter.get("/files/summary", asyncRoute(async (_request, response) => {
  response.json({
    serverProperties: await readServerProperties(),
    whitelist: await readJsonFile("whitelist.json", []),
    ops: await readJsonFile("ops.json", []),
    datapacks: await listDatapacks()
  });
}));

apiRouter.get("/files/read", asyncRoute(async (request, response) => {
  const allowed = new Set(["server.properties", "logs/latest.log", "whitelist.json", "ops.json"]);
  const file = String(request.query.file ?? "");
  if (!allowed.has(file)) {
    response.status(400).json({ error: "File is not readable in MVP" });
    return;
  }
  response.type("text/plain").send(await readTextFile(file));
}));

apiRouter.get("/logs/sources", (_request, response) => {
  response.json({ sources: configuredLogSources(), dockerSocketPath: config.dockerSocketPath });
});

apiRouter.get("/logs/latest", asyncRoute(async (_request, response) => {
  response.json(await readLogPayload("minecraft-latest", config.logTailLines));
}));

apiRouter.get("/logs/:source", asyncRoute(async (request, response) => {
  const source = String(request.params.source) as LogSourceId;
  const tail = Number(request.query.tail ?? config.logTailLines);
  response.json(await readLogPayload(source, tail));
}));

apiRouter.get("/catalog/search", asyncRoute(async (request, response) => {
  const status = await statusPayload();
  const projectType = String(request.query.projectType ?? request.query.type ?? "");
  response.json(await searchCatalog({
    query: String(request.query.query ?? ""),
    projectType: projectType === "all" ? "" : projectType,
    serverFlavor: String(request.query.serverFlavor ?? status.serverFlavor ?? ""),
    minecraftVersion: String(request.query.minecraftVersion ?? status.minecraftVersion ?? ""),
    limit: Number(request.query.limit ?? 100),
    offset: Number(request.query.offset ?? 0)
  }));
}));

apiRouter.get("/catalog/project/:source/:id/versions", asyncRoute(async (request, response) => {
  if (String(request.params.source) !== "modrinth") {
    response.status(400).json({ error: "Unsupported catalog source" });
    return;
  }
  const status = await statusPayload();
  response.json({ versions: await getCatalogVersions(String(request.params.id), {
    projectType: String(request.query.projectType ?? ""),
    serverFlavor: String(request.query.serverFlavor ?? status.serverFlavor ?? ""),
    minecraftVersion: String(request.query.minecraftVersion ?? status.minecraftVersion ?? "")
  }) });
}));

apiRouter.post("/catalog/install", asyncRoute(async (request, response) => {
  const status = await statusPayload();
  const body = request.body as { source?: string; projectId?: string; projectType?: string; versionId?: string; confirmReplace?: boolean };
  response.json(await installCatalogPackage({
    ...body,
    serverFlavor: status.serverFlavor,
    minecraftVersion: status.minecraftVersion,
    userId: request.userId
  }));
}));

apiRouter.get("/addons", asyncRoute(async (_request, response) => {
  const datapacks = await listDatapacks();
  const packages: AddonPackage[] = [];

  for (const pack of datapacks) {
    const abs = withinMcData(pack.relativePath);
    const info = await stat(abs).catch(() => null);
    if (!info) continue;

    if (info.isFile() && pack.name.endsWith(".zip")) {
      const inspected = await inspectPackage(abs).catch(() => ({
        name: pack.name,
        filename: pack.name,
        type: "unknown" as const,
        metadata: {},
        detectedFiles: []
      }));
      packages.push({
        id: Buffer.from(pack.relativePath).toString("base64url"),
        path: publicMcPath(abs),
        status: inspected.type === "datapack" && !pack.disabled ? "present" : "unsupported",
        ...inspected
      });
    } else {
      packages.push({
        id: Buffer.from(pack.relativePath).toString("base64url"),
        name: pack.name,
        filename: pack.name,
        type: "datapack",
        path: publicMcPath(abs),
        status: pack.disabled ? "disabled" : "present",
        metadata: {},
        detectedFiles: []
      });
    }
  }

  const datapackList = await runRcon("datapack list").catch(() => "");
  response.json({ packages, datapackList });
}));

apiRouter.post("/addons/upload", upload.single("file"), asyncRoute(async (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: "Missing file" });
    return;
  }

  const original = path.basename(request.file.originalname);
  if (!original.endsWith(".zip")) {
    await rm(request.file.path, { force: true });
    response.status(400).json({ error: "Only zip datapacks are allowed in MVP" });
    return;
  }

  const inspected = await inspectPackage(request.file.path);
  if (inspected.type !== "datapack") {
    await rm(request.file.path, { force: true });
    response.status(400).json({ error: `Detected ${inspected.type}; only datapacks are supported on Vanilla MVP`, inspected });
    return;
  }

  const datapacksDir = await ensureMcDir("world", "datapacks");
  const target = withinMcData("world", "datapacks", original);
  const backupDir = await ensureMcDir(".mcserver-panel-backups", "datapacks");
  const exists = await stat(target).then(() => true).catch(() => false);

  if (exists && request.body.confirmReplace !== "true") {
    await rm(request.file.path, { force: true });
    response.status(409).json({ error: "Datapack already exists. Retry with confirmReplace=true." });
    return;
  }

  if (exists) {
    await mkdir(backupDir, { recursive: true });
    await copyFile(target, path.join(backupDir, `${Date.now()}-${original}`));
  }

  await rename(request.file.path, path.join(datapacksDir, original));
  await auditLog({ user: request.userId, action: "addon.upload", payload: { filename: original }, result: inspected });
  response.json({ package: inspected });
}));

apiRouter.delete("/addons/:id", asyncRoute(async (request, response) => {
  const relative = Buffer.from(String(request.params.id), "base64url").toString("utf8");
  if (!relative.startsWith("world/datapacks/")) {
    response.status(400).json({ error: "Only datapacks can be deleted in MVP" });
    return;
  }
  const target = withinMcData(relative);
  const backupDir = await ensureMcDir(".mcserver-panel-backups", "datapacks");
  await copyFile(target, path.join(backupDir, `${Date.now()}-${path.basename(target)}`));
  await rm(target, { recursive: true, force: true });
  await auditLog({ user: request.userId, action: "addon.delete", payload: { relative }, result: "deleted with backup" });
  response.json({ ok: true });
}));

apiRouter.post("/addons/reload", asyncRoute(async (request, response) => {
  const result = await runRcon("reload");
  await auditLog({ user: request.userId, action: "addon.reload", result });
  response.json({ result });
}));
