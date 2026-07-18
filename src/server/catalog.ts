import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { AddonPackage, CatalogInstallResult, CatalogProject, CatalogProjectType, CatalogVersion } from "../shared/types.js";
import { auditLog } from "./audit.js";
import { config } from "./config.js";
import { inspectPackage } from "./packageInspector.js";
import { ensureMcDir, publicMcPath, withinMcData } from "./paths.js";

const MODRINTH_API = "https://api.modrinth.com/v2";
const KNOWN_TYPES = new Set<CatalogProjectType>(["datapack", "plugin", "mod", "resourcepack"]);

type CatalogSearchOptions = {
  query?: string;
  projectType?: string;
  serverFlavor?: string;
  minecraftVersion?: string;
  limit?: number;
  offset?: number;
};

type InstallOptions = {
  source?: string;
  projectId?: string;
  projectType?: string;
  versionId?: string;
  serverFlavor?: string;
  minecraftVersion?: string;
  confirmReplace?: boolean;
  userId?: string;
};

type ModrinthSearchHit = {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  project_type: string;
  downloads: number;
  icon_url?: string;
  versions?: string[];
  categories?: string[];
  client_side?: string;
  server_side?: string;
};

type ModrinthVersion = {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  date_published: string;
  downloads: number;
  files: Array<{
    hashes?: Record<string, string>;
    url: string;
    filename: string;
    primary?: boolean;
    size?: number;
  }>;
};

type ModrinthProject = {
  id: string;
  slug: string;
  title: string;
  project_type: string;
};

function clamp(value: number | undefined, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Number(value)));
}

function cleanVersion(value?: string) {
  const text = String(value ?? "").trim();
  return text && text !== "Unknown" && text.toLowerCase() !== "unknown" ? text : "";
}

function normalizeType(value?: string): CatalogProjectType | null {
  const text = String(value ?? "").trim().toLowerCase();
  return KNOWN_TYPES.has(text as CatalogProjectType) ? text as CatalogProjectType : null;
}

function flavorKey(serverFlavor?: string) {
  return String(serverFlavor ?? "").toLowerCase();
}

function compatibleTypes(serverFlavor?: string): CatalogProjectType[] {
  const flavor = flavorKey(serverFlavor);
  if (flavor.includes("fabric") || flavor.includes("forge") || flavor.includes("neoforge")) return ["mod", "datapack"];
  if (flavor.includes("paper") || flavor.includes("purpur") || flavor.includes("spigot") || flavor.includes("bukkit")) return ["plugin", "datapack"];
  return ["datapack", "resourcepack"];
}

function loaderCategories(projectType: CatalogProjectType, serverFlavor?: string) {
  const flavor = flavorKey(serverFlavor);
  if (projectType === "plugin") {
    if (flavor.includes("paper") || flavor.includes("purpur")) return ["paper", "spigot", "bukkit"];
    if (flavor.includes("spigot")) return ["spigot", "bukkit"];
    if (flavor.includes("bukkit")) return ["bukkit", "spigot"];
    return [];
  }
  if (projectType === "mod") {
    if (flavor.includes("fabric")) return ["fabric"];
    if (flavor.includes("neoforge")) return ["neoforge", "forge"];
    if (flavor.includes("forge")) return ["forge", "neoforge"];
  }
  return [];
}

function installTarget(projectType: CatalogProjectType, serverFlavor?: string): CatalogProject["installTarget"] | undefined {
  if (projectType === "datapack") return "world/datapacks";
  if (projectType === "plugin" && compatibleTypes(serverFlavor).includes("plugin")) return "plugins";
  if (projectType === "mod" && compatibleTypes(serverFlavor).includes("mod")) return "mods";
  return undefined;
}

function isInstallable(projectType: CatalogProjectType, serverFlavor?: string) {
  return Boolean(installTarget(projectType, serverFlavor));
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, { headers: { "user-agent": config.catalogUserAgent, accept: "application/json" } });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Modrinth ${response.status}: ${text.slice(0, 220) || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function mapProject(hit: ModrinthSearchHit, serverFlavor?: string): CatalogProject {
  const projectType = normalizeType(hit.project_type) ?? "datapack";
  const target = installTarget(projectType, serverFlavor);
  return {
    source: "modrinth",
    id: hit.project_id,
    slug: hit.slug,
    title: hit.title,
    description: hit.description,
    projectType,
    downloads: hit.downloads ?? 0,
    iconUrl: hit.icon_url,
    versions: hit.versions ?? [],
    categories: hit.categories ?? [],
    clientSide: hit.client_side,
    serverSide: hit.server_side,
    installable: Boolean(target),
    installTarget: target,
    installWarning: target ? undefined : "This project type is not installable for the selected server runtime."
  };
}

async function searchModrinthType(options: CatalogSearchOptions, projectType: CatalogProjectType) {
  const url = new URL(`${MODRINTH_API}/search`);
  const limit = clamp(options.limit, 1, 40);
  const version = cleanVersion(options.minecraftVersion);
  const facets: string[][] = [[`project_type:${projectType}`]];
  const categories = loaderCategories(projectType, options.serverFlavor);

  if (version) facets.push([`versions:${version}`]);
  if (categories.length) facets.push(categories.map((category) => `categories:${category}`));

  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(clamp(options.offset, 0, 5000)));
  url.searchParams.set("index", "downloads");
  url.searchParams.set("facets", JSON.stringify(facets));
  if (options.query?.trim()) url.searchParams.set("query", options.query.trim());

  const data = await fetchJson<{ hits: ModrinthSearchHit[]; total_hits: number }>(url);
  return data.hits.map((hit) => mapProject(hit, options.serverFlavor));
}

export async function searchCatalog(options: CatalogSearchOptions) {
  if (!config.enableCatalog) throw Object.assign(new Error("Catalog is disabled"), { status: 403 });

  const requested = normalizeType(options.projectType);
  const allowed = compatibleTypes(options.serverFlavor);
  const types = requested ? [requested] : allowed;
  const projects = requested
    ? await searchModrinthType(options, requested)
    : (await Promise.all(types.map((type) => searchModrinthType({ ...options, offset: 0 }, type)))).flat();

  const offset = requested ? 0 : clamp(options.offset, 0, 5000);
  const limit = clamp(options.limit, 1, 40);
  const sorted = projects.sort((a, b) => b.downloads - a.downloads).slice(offset, offset + limit);

  return {
    source: "modrinth" as const,
    provider: "Modrinth",
    serverFlavor: options.serverFlavor ?? "Unknown",
    minecraftVersion: cleanVersion(options.minecraftVersion) || "Unknown",
    compatibleTypes: allowed,
    projects: sorted
  };
}

function mapVersion(version: ModrinthVersion): CatalogVersion | null {
  const file = version.files.find((item) => item.primary) ?? version.files[0];
  if (!file) return null;
  return {
    source: "modrinth",
    projectId: version.project_id,
    id: version.id,
    name: version.name,
    versionNumber: version.version_number,
    minecraftVersions: version.game_versions ?? [],
    loaders: version.loaders ?? [],
    datePublished: version.date_published,
    downloads: version.downloads ?? 0,
    file: {
      url: file.url,
      filename: file.filename,
      size: file.size ?? 0,
      hashes: file.hashes ?? {},
      primary: Boolean(file.primary)
    }
  };
}

export async function getCatalogVersions(projectId: string, options: CatalogSearchOptions = {}) {
  if (!config.enableCatalog) throw Object.assign(new Error("Catalog is disabled"), { status: 403 });

  const type = normalizeType(options.projectType);
  const version = cleanVersion(options.minecraftVersion);
  const loaders = type ? loaderCategories(type, options.serverFlavor) : [];
  const url = new URL(`${MODRINTH_API}/project/${encodeURIComponent(projectId)}/version`);
  if (version) url.searchParams.set("game_versions", JSON.stringify([version]));
  if (loaders.length) url.searchParams.set("loaders", JSON.stringify(loaders));

  const versions = await fetchJson<ModrinthVersion[]>(url);
  return versions.map(mapVersion).filter(Boolean) as CatalogVersion[];
}

async function getModrinthProject(projectId: string) {
  const url = new URL(`${MODRINTH_API}/project/${encodeURIComponent(projectId)}`);
  return fetchJson<ModrinthProject>(url);
}

function safeFilename(filename: string) {
  const clean = path.basename(filename).replace(/[^A-Za-z0-9._ -]/g, "_").trim();
  if (!clean || clean === "." || clean === "..") throw new Error("Invalid downloaded filename");
  return clean;
}

function expectedPackageType(projectType: CatalogProjectType, inspected: Omit<AddonPackage, "id" | "path" | "status">) {
  if (projectType === "datapack") return inspected.type === "datapack";
  if (projectType === "plugin") return inspected.type === "plugin";
  if (projectType === "mod") return inspected.type === "fabric_mod" || inspected.type === "forge_mod";
  return false;
}

async function downloadVersionFile(version: CatalogVersion) {
  const maxBytes = config.uploadLimitMb * 1024 * 1024;
  const response = await fetch(version.file.url, { headers: { "user-agent": config.catalogUserAgent } });
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) throw new Error(`Package is larger than UPLOAD_LIMIT_MB (${config.uploadLimitMb} MB)`);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxBytes) throw new Error(`Package is larger than UPLOAD_LIMIT_MB (${config.uploadLimitMb} MB)`);

  const expectedSha1 = version.file.hashes.sha1;
  if (expectedSha1) {
    const actualSha1 = createHash("sha1").update(buffer).digest("hex");
    if (actualSha1 !== expectedSha1) throw new Error("Downloaded package hash does not match Modrinth metadata");
  }

  const filename = safeFilename(version.file.filename);
  const tmpDir = "/tmp/mcserver-panel-catalog";
  await mkdir(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `${Date.now()}-${filename}`);
  await writeFile(tmpPath, buffer);
  return { tmpPath, filename };
}

export async function installCatalogPackage(options: InstallOptions): Promise<CatalogInstallResult> {
  if (!config.enableCatalogInstall) throw Object.assign(new Error("Catalog install is disabled"), { status: 403 });
  if (options.source && options.source !== "modrinth") throw Object.assign(new Error("Unsupported catalog source"), { status: 400 });
  if (!options.projectId) throw Object.assign(new Error("Missing projectId"), { status: 400 });

  const project = await getModrinthProject(options.projectId);
  const projectType = normalizeType(options.projectType) ?? normalizeType(project.project_type);
  if (!projectType) throw Object.assign(new Error("Unsupported project type"), { status: 400 });

  const targetDir = installTarget(projectType, options.serverFlavor);
  if (!targetDir || projectType === "resourcepack") {
    throw Object.assign(new Error("This project type cannot be installed for the selected server runtime"), { status: 400 });
  }

  const versions = await getCatalogVersions(options.projectId, {
    projectType,
    serverFlavor: options.serverFlavor,
    minecraftVersion: options.minecraftVersion
  });
  const selected = options.versionId ? versions.find((item) => item.id === options.versionId) : versions[0];
  if (!selected) throw Object.assign(new Error("No compatible version found for this server"), { status: 404 });

  const { tmpPath, filename } = await downloadVersionFile(selected);
  try {
    const inspected = await inspectPackage(tmpPath);
    if (!expectedPackageType(projectType, inspected)) {
      throw Object.assign(new Error(`Downloaded file was detected as ${inspected.type}, expected ${projectType}`), { status: 400 });
    }

    const dir = await ensureMcDir(...targetDir.split("/"));
    const target = withinMcData(targetDir, filename);
    const backupDir = await ensureMcDir(".mcserver-panel-backups", "catalog");
    const exists = await stat(target).then(() => true).catch(() => false);
    let backupPath: string | undefined;

    if (exists && !options.confirmReplace) {
      throw Object.assign(new Error("Package already exists. Retry with confirmReplace=true."), { status: 409 });
    }

    if (exists) {
      backupPath = path.join(backupDir, `${Date.now()}-${filename}`);
      await copyFile(target, backupPath);
    }

    await copyFile(tmpPath, path.join(dir, filename));
    await auditLog({
      user: options.userId,
      action: "catalog.install",
      payload: { source: "modrinth", projectId: options.projectId, versionId: selected.id, projectType, filename },
      result: { target: publicMcPath(target), replaced: exists }
    });

    return { ok: true, package: inspected, target: publicMcPath(target), replaced: exists, backupPath: backupPath ? publicMcPath(backupPath) : undefined };
  } finally {
    await rm(tmpPath, { force: true }).catch(() => undefined);
  }
}
