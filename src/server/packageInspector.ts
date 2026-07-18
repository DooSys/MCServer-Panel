import yauzl from "yauzl";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AddonPackage } from "../shared/types.js";

function openZip(filePath: string) {
  return new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) reject(error ?? new Error("Unable to open zip"));
      else resolve(zip);
    });
  });
}

async function readZipEntries(filePath: string, limit = 400) {
  const zip = await openZip(filePath);
  const entries: string[] = [];

  return new Promise<string[]>((resolve, reject) => {
    zip.readEntry();
    zip.on("entry", (entry) => {
      entries.push(entry.fileName);
      if (entries.length >= limit) {
        zip.close();
        resolve(entries);
        return;
      }
      zip.readEntry();
    });
    zip.on("end", () => resolve(entries));
    zip.on("error", reject);
  });
}

async function readZipText(filePath: string, filename: string) {
  const zip = await openZip(filePath);

  return new Promise<string | null>((resolve, reject) => {
    zip.readEntry();
    zip.on("entry", (entry) => {
      if (entry.fileName !== filename) {
        zip.readEntry();
        return;
      }

      zip.openReadStream(entry, (error, stream) => {
        if (error || !stream) {
          reject(error ?? new Error("Unable to read zip entry"));
          return;
        }
        const chunks: Buffer[] = [];
        stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on("end", () => {
          zip.close();
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
      });
    });
    zip.on("end", () => resolve(null));
    zip.on("error", reject);
  });
}

export async function inspectPackage(filePath: string): Promise<Omit<AddonPackage, "id" | "path" | "status">> {
  const filename = path.basename(filePath);
  const detectedFiles: string[] = await readZipEntries(filePath).catch(() => [] as string[]);
  const has = (name: string) => detectedFiles.includes(name) || detectedFiles.some((entry) => entry.endsWith(`/${name}`));
  const metadata: Record<string, unknown> = {};

  if (has("pack.mcmeta")) {
    const packPath = detectedFiles.find((entry) => entry === "pack.mcmeta" || entry.endsWith("/pack.mcmeta"));
    if (packPath) {
      const raw = await readZipText(filePath, packPath).catch(() => null);
      if (raw) {
        try {
          Object.assign(metadata, JSON.parse(raw));
        } catch {
          metadata.raw = raw.slice(0, 1000);
        }
      }
    }

    const hasDataNamespace = detectedFiles.some((entry) => entry.startsWith("data/") || entry.includes("/data/"));
    return {
      name: String((metadata.pack as { description?: string } | undefined)?.description ?? filename),
      filename,
      type: hasDataNamespace ? "datapack" : "resource_pack",
      metadata,
      detectedFiles
    };
  }

  if (has("plugin.yml")) {
    return { name: filename, filename, type: "plugin", metadata, detectedFiles };
  }

  if (has("fabric.mod.json")) {
    const raw = await readZipText(filePath, detectedFiles.find((entry) => entry.endsWith("fabric.mod.json")) ?? "fabric.mod.json").catch(() => null);
    if (raw) {
      try {
        Object.assign(metadata, JSON.parse(raw));
      } catch {
        metadata.raw = raw.slice(0, 1000);
      }
    }
    return { name: String(metadata.name ?? filename), filename, type: "fabric_mod", metadata, detectedFiles };
  }

  if (has("mods.toml") || has("mcmod.info")) {
    return { name: filename, filename, type: "forge_mod", metadata, detectedFiles };
  }

  if (filename.endsWith(".json")) {
    const raw = await readFile(filePath, "utf8").catch(() => "");
    metadata.raw = raw.slice(0, 1000);
  }

  return { name: filename, filename, type: "unknown", metadata, detectedFiles };
}
