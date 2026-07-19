export const config = {
  appPort: Number(process.env.APP_PORT ?? 8080),
  rconHost: process.env.MC_RCON_HOST ?? process.env.SERVER ?? "minecraft",
  rconPort: Number(process.env.MC_RCON_PORT ?? process.env.RCON_PORT ?? 25575),
  rconPassword: process.env.MC_RCON_PASSWORD ?? process.env.RCON_PASSWORD ?? "",
  mcDataPath: process.env.MC_DATA_PATH ?? "/mc-data",
  pocketBaseUrl: process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090",
  uploadLimitMb: Number(process.env.UPLOAD_LIMIT_MB ?? 64),
  allowStopServer: process.env.ALLOW_STOP_SERVER === "true",
  publicUrl: process.env.PUBLIC_URL ?? "",
  mcContainerName: process.env.MC_CONTAINER_NAME ?? process.env.SERVER ?? "minecraft",
  panelContainerName: process.env.PANEL_CONTAINER_NAME ?? "MCServer-panel",
  dockerSocketPath: process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock",
  logTailLines: Number(process.env.LOG_TAIL_LINES ?? 400),
  enableMinecraftUpdateCheck: process.env.MINECRAFT_UPDATE_CHECK !== "false",
  appVersion: process.env.APP_VERSION ?? "1.1.17",
  appDockerImage: "ghcr.io/doosys/mcserver-panel",
  appDockerTag: process.env.APP_VERSION ?? "1.1.17",
  panelUpdateStatus: process.env.PANEL_UPDATE_STATUS ?? "not_checked",
  enableCatalog: process.env.CATALOG_DISABLED !== "true",
  enableCatalogInstall: process.env.ENABLE_CATALOG_INSTALL === "true",
  catalogUserAgent: "MCServer-Panel/" + (process.env.APP_VERSION ?? "1.1.17") + " (https://github.com/DooSys/MCServer-Panel)"
};

export function assertRuntimeConfig() {
  if (!config.rconPassword) {
    console.warn("[config] RCON_PASSWORD is empty. RCON endpoints will fail until it is set.");
  }
}
