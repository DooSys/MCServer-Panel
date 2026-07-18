const pbUrl = process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090";
const email = process.env.PB_SUPERUSER_EMAIL;
const password = process.env.PB_SUPERUSER_PASSWORD;

if (!email || !password) {
  console.error("PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD are required.");
  process.exit(1);
}

const gamerules = [
  ["keep_inventory", "Garder l'inventaire", "Les joueurs conservent leur inventaire apres une mort.", "boolean", "false", "true", "Confort"],
  ["do_fire_tick", "Propagation du feu", "Controle la propagation et l'extinction naturelle du feu.", "boolean", "true", "false", "Protection"],
  ["mob_griefing", "Degats des mobs", "Autorise les mobs a modifier le monde.", "boolean", "true", "false", "Protection"],
  ["players_sleeping_percentage", "Sommeil requis", "Pourcentage de joueurs qui doivent dormir.", "number", "100", "50", "Confort"],
  ["show_death_messages", "Messages de mort", "Affiche les messages de mort.", "boolean", "true", "true", "Chat"],
  ["announce_advancements", "Annonces de progres", "Annonce les progres obtenus.", "boolean", "true", "true", "Chat"],
  ["do_immediate_respawn", "Respawn immediat", "Respawn sans ecran de mort.", "boolean", "false", "false", "Confort"],
  ["fall_damage", "Degats de chute", "Active les degats de chute.", "boolean", "true", "true", "Survie"],
  ["fire_damage", "Degats du feu", "Active les degats de feu.", "boolean", "true", "true", "Survie"],
  ["drowning_damage", "Degats de noyade", "Active les degats de noyade.", "boolean", "true", "true", "Survie"],
  ["do_daylight_cycle", "Cycle jour/nuit", "Fait avancer le cycle jour/nuit.", "boolean", "true", "true", "Monde"],
  ["do_weather_cycle", "Cycle meteo", "Active les changements de meteo.", "boolean", "true", "true", "Monde"],
  ["do_mob_spawning", "Spawn des mobs", "Autorise le spawn naturel des mobs.", "boolean", "true", "true", "Monde"],
  ["do_trader_spawning", "Marchand ambulant", "Autorise le marchand ambulant.", "boolean", "true", "true", "Monde"],
  ["do_patrol_spawning", "Patrouilles", "Autorise les patrouilles.", "boolean", "true", "false", "Famille"],
  ["do_insomnia", "Insomnie", "Autorise les phantoms.", "boolean", "true", "false", "Famille"],
  ["random_tick_speed", "Vitesse ticks aleatoires", "Controle croissance et evolution de blocs.", "number", "3", "3", "Performance"],
  ["spawn_radius", "Rayon du spawn", "Rayon autour du spawn initial.", "number", "10", "10", "Monde"],
  ["max_entity_cramming", "Cramming entites", "Nombre maximal d'entites empilees.", "number", "24", "24", "Performance"],
  ["command_block_output", "Sortie command blocks", "Affiche la sortie des blocs de commande.", "boolean", "true", "false", "Administration"],
  ["send_command_feedback", "Retour commandes", "Affiche le retour des commandes.", "boolean", "true", "true", "Administration"],
  ["log_admin_commands", "Log commandes admin", "Journalise les commandes admin.", "boolean", "true", "true", "Audit"]
];

async function request(path, options = {}) {
  const response = await fetch(`${pbUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path}: ${response.status} ${text}`);
  return data;
}

const auth = await request("/api/collections/_superusers/auth-with-password", {
  method: "POST",
  body: JSON.stringify({ identity: email, password })
});
const token = auth.token;
const authHeaders = { authorization: `Bearer ${token}` };

async function collection(name) {
  try { return await request(`/api/collections/${name}`, { headers: authHeaders }); }
  catch { return null; }
}

async function ensureCollection(name, fields) {
  const existing = await collection(name);
  if (existing) {
    console.log(`ok collection ${name}`);
    return existing;
  }
  const created = await request("/api/collections", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ name, type: "base", fields, listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''", createRule: "@request.auth.id != ''", updateRule: "@request.auth.id != ''", deleteRule: null })
  });
  console.log(`created collection ${name}`);
  return created;
}

const text = (name, required = false) => ({ name, type: "text", required });
const bool = (name) => ({ name, type: "bool" });
const number = (name) => ({ name, type: "number" });
const json = (name) => ({ name, type: "json" });
const date = (name) => ({ name, type: "date" });

await ensureCollection("servers", [text("name", true), text("type", true), text("runtime", true), text("rcon_host", true), number("rcon_port"), text("data_path", true), bool("enabled")]);
await ensureCollection("gamerule_definitions", [text("key", true), text("label", true), text("description"), text("value_type", true), text("default_value"), text("recommended_value"), text("category")]);
await ensureCollection("gamerule_snapshots", [text("server"), text("key", true), text("value"), date("checked_at")]);
await ensureCollection("action_logs", [text("user"), text("server"), text("action", true), json("payload"), json("result")]);
await ensureCollection("addon_packages", [text("server"), text("name", true), text("type"), text("filename"), text("path"), json("metadata_json"), text("status"), text("uploaded_by")]);
await ensureCollection("ui_preferences", [text("user", true), json("layout_json"), text("theme")]);

const panelEmail = process.env.PANEL_ADMIN_EMAIL ?? email;
const panelPassword = process.env.PANEL_ADMIN_PASSWORD ?? password;
try {
  const filter = encodeURIComponent(`email='${panelEmail}'`);
  const existingUser = await request(`/api/collections/users/records?filter=${filter}`, { headers: authHeaders });
  if (!existingUser.items?.length) {
    await request("/api/collections/users/records", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ email: panelEmail, password: panelPassword, passwordConfirm: panelPassword, verified: true })
    });
    console.log(`created panel user ${panelEmail}`);
  }
} catch (error) {
  console.warn(`panel user creation skipped: ${error.message}`);
}

for (const [key, label, description, value_type, default_value, recommended_value, category] of gamerules) {
  const filter = encodeURIComponent(`key='${key}'`);
  const existing = await request(`/api/collections/gamerule_definitions/records?filter=${filter}`, { headers: authHeaders });
  if (existing.items?.length) continue;
  await request("/api/collections/gamerule_definitions/records", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ key, label, description, value_type, default_value, recommended_value, category })
  });
}

console.log("PocketBase initialized.");
