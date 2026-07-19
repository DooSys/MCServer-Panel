import http from "node:http";
import { Buffer } from "node:buffer";
import { config } from "./config.js";

export type DockerContainerInspect = {
  id?: string;
  name: string;
  image?: string;
  env: Record<string, string>;
  error?: string;
};

export type DockerLogsResult = {
  container: string;
  content: string;
  error?: string;
  generatedAt: string;
  tail: number;
};

const MAX_LOG_BYTES = 2500000;
const REQUEST_TIMEOUT_MS = 5000;

function cleanContainerName(container: string) {
  return container.trim().replace(/^\/+/, "");
}

function stripDockerFrames(buffer: Buffer) {
  if (!buffer.length) return "";

  const chunks: Buffer[] = [];
  let offset = 0;
  let framed = false;

  while (offset + 8 <= buffer.length) {
    const streamType = buffer[offset];
    const size = buffer.readUInt32BE(offset + 4);
    const nextOffset = offset + 8 + size;

    if (streamType < 0 || streamType > 2 || nextOffset > buffer.length) {
      framed = false;
      break;
    }

    framed = true;
    chunks.push(buffer.subarray(offset + 8, nextOffset));
    offset = nextOffset;
  }

  if (framed && offset === buffer.length) {
    return Buffer.concat(chunks).toString("utf8");
  }

  return buffer.toString("utf8").replace(/\u0000/g, "");
}

export function dockerGet(path: string) {
  return new Promise<{ statusCode: number; body: Buffer }>((resolve, reject) => {
    const request = http.request({
      socketPath: config.dockerSocketPath,
      path,
      method: "GET",
      timeout: REQUEST_TIMEOUT_MS
    }, (response) => {
      const chunks: Buffer[] = [];
      let total = 0;

      response.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total <= MAX_LOG_BYTES) chunks.push(chunk);
      });
      response.on("end", () => resolve({ statusCode: response.statusCode ?? 500, body: Buffer.concat(chunks) }));
    });

    request.on("timeout", () => request.destroy(new Error("Docker API timeout after " + REQUEST_TIMEOUT_MS + "ms")));
    request.on("error", reject);
    request.end();
  });
}

export async function readDockerContainerLogs(containerName: string, tail = config.logTailLines): Promise<DockerLogsResult> {
  const container = cleanContainerName(containerName);
  const safeTail = Math.min(Math.max(Number.isFinite(tail) ? Math.trunc(tail) : config.logTailLines, 50), 5000);
  const path = "/containers/" + encodeURIComponent(container) + "/logs?stdout=1&stderr=1&timestamps=1&tail=" + safeTail;

  try {
    const response = await dockerGet(path);
    const text = stripDockerFrames(response.body);

    if (response.statusCode >= 400) {
      let message = text.trim() || "Docker API HTTP " + response.statusCode;
      try {
        const parsed = JSON.parse(text) as { message?: string };
        message = parsed.message ?? message;
      } catch {
        // Keep Docker plain text error.
      }
      return { container, content: "", error: message, generatedAt: new Date().toISOString(), tail: safeTail };
    }

    return { container, content: text, generatedAt: new Date().toISOString(), tail: safeTail };
  } catch (error) {
    return {
      container,
      content: "",
      error: error instanceof Error ? error.message : "Docker API unavailable",
      generatedAt: new Date().toISOString(),
      tail: safeTail
    };
  }
}

export async function inspectDockerContainer(containerName: string): Promise<DockerContainerInspect> {
  const container = cleanContainerName(containerName);
  try {
    const response = await dockerGet("/containers/" + encodeURIComponent(container) + "/json");
    const text = response.body.toString("utf8");
    if (response.statusCode >= 400) {
      let message = text.trim() || "Docker API HTTP " + response.statusCode;
      try {
        const parsed = JSON.parse(text) as { message?: string };
        message = parsed.message ?? message;
      } catch {
        // Keep Docker plain text error.
      }
      return { name: container, env: {}, error: message };
    }

    const parsed = JSON.parse(text) as { Id?: string; Name?: string; Config?: { Image?: string; Env?: string[] } };
    const env = Object.fromEntries((parsed.Config?.Env ?? []).map((item) => {
      const index = item.indexOf("=");
      return index === -1 ? [item, ""] : [item.slice(0, index), item.slice(index + 1)];
    }));
    return { id: parsed.Id, name: (parsed.Name ?? container).replace(/^\/+/, ""), image: parsed.Config?.Image, env };
  } catch (error) {
    return { name: container, env: {}, error: error instanceof Error ? error.message : "Docker API unavailable" };
  }
}
