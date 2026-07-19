export type ServerStatus = {
  online: boolean;
  rconOk: boolean;
  rconHost?: string;
  rconPort?: number;
  rconError?: string;
  playersOnline: number;
  playersMax: number | null;
  players: string[];
  motd?: string;
  version?: string;
  minecraftVersion?: string;
  type?: string;
  serverFlavor?: string;
  dockerImage?: string;
  dockerImageTag?: string;
  imageUpdate?: {
    status: "not_configured" | "not_checked" | "unknown" | "current" | "update_available";
    message: string;
    checkedAt?: string;
  };
  minecraftUpdate?: {
    status: "not_configured" | "not_checked" | "unknown" | "current" | "update_available";
    message: string;
    checkedAt?: string;
  };
  panelVersion?: string;
  panelImage?: string;
  panelImageTag?: string;
  panelUpdate?: {
    status: "not_configured" | "not_checked" | "unknown" | "current" | "update_available";
    message: string;
    checkedAt?: string;
  };
  gameMode?: string;
  difficulty?: string;
  whitelist?: boolean;
  lastChecked: string;
  error?: string;
};

export type ValueType = "boolean" | "number" | "select" | "text";

export type GameruleDefinition = {
  key: string;
  label: string;
  description: string;
  valueType: ValueType;
  defaultValue: string;
  recommendedValue: string;
  category: string;
  options?: string[];
};

export type GameruleState = GameruleDefinition & {
  currentValue: string | null;
  minecraftKey?: string;
  available: boolean;
  error?: string;
};

export type PlayerSummary = {
  online: string[];
  whitelist: Array<Record<string, unknown>>;
  ops: Array<Record<string, unknown>>;
};

export type AddonPackage = {
  id: string;
  name: string;
  type: "datapack" | "resource_pack" | "plugin" | "fabric_mod" | "forge_mod" | "unknown";
  filename: string;
  path: string;
  status: "active" | "present" | "unsupported" | "disabled";
  metadata: Record<string, unknown>;
  detectedFiles: string[];
};

export type CatalogSource = "modrinth";

export type CatalogProjectType = "datapack" | "plugin" | "mod" | "resourcepack";

export type CatalogProject = {
  source: CatalogSource;
  id: string;
  slug: string;
  title: string;
  description: string;
  projectType: CatalogProjectType;
  downloads: number;
  iconUrl?: string;
  versions: string[];
  categories: string[];
  clientSide?: string;
  serverSide?: string;
  installable: boolean;
  installTarget?: "world/datapacks" | "plugins" | "mods";
  installWarning?: string;
};

export type CatalogTypeSummary = {
  projectType: CatalogProjectType;
  totalHits: number;
  returned: number;
  limit: number;
  offset: number;
};

export type CatalogSearchResult = {
  source: CatalogSource;
  provider: string;
  serverFlavor: string;
  minecraftVersion: string;
  compatibleTypes: CatalogProjectType[];
  queriedTypes: CatalogProjectType[];
  totalHits: number;
  returned: number;
  limitPerType: number;
  typeSummaries: CatalogTypeSummary[];
  projects: CatalogProject[];
};

export type CatalogVersion = {
  source: CatalogSource;
  projectId: string;
  id: string;
  name: string;
  versionNumber: string;
  minecraftVersions: string[];
  loaders: string[];
  datePublished: string;
  downloads: number;
  file: {
    url: string;
    filename: string;
    size: number;
    hashes: Record<string, string>;
    primary: boolean;
  };
};

export type CatalogInstallResult = {
  ok: true;
  package: Omit<AddonPackage, "id" | "path" | "status">;
  target: string;
  replaced: boolean;
  backupPath?: string;
};

export type LogDetection = {
  type: "info" | "error" | "warn" | "rcon" | "crash" | "join" | "whitelist" | "datapack" | "save";
  line: string;
};

export type LogSourceId = "minecraft-container" | "panel-container" | "minecraft-latest";

export type LogSource = {
  id: LogSourceId;
  label: string;
  kind: "docker" | "file";
  detail: string;
};

export type LogPayload = {
  source: LogSource;
  content: string;
  detections: LogDetection[];
  generatedAt: string;
  tail: number;
  error?: string;
};
