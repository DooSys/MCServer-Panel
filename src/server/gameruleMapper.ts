const explicitMap: Record<string, string> = {
  keep_inventory: "keepInventory",
  do_fire_tick: "doFireTick",
  mob_griefing: "mobGriefing",
  players_sleeping_percentage: "playersSleepingPercentage",
  show_death_messages: "showDeathMessages",
  announce_advancements: "announceAdvancements",
  do_immediate_respawn: "doImmediateRespawn",
  fall_damage: "fallDamage",
  fire_damage: "fireDamage",
  drowning_damage: "drowningDamage",
  do_daylight_cycle: "doDaylightCycle",
  do_weather_cycle: "doWeatherCycle",
  do_mob_spawning: "doMobSpawning",
  do_trader_spawning: "doTraderSpawning",
  do_patrol_spawning: "doPatrolSpawning",
  do_insomnia: "doInsomnia",
  random_tick_speed: "randomTickSpeed",
  spawn_radius: "spawnRadius",
  max_entity_cramming: "maxEntityCramming",
  command_block_output: "commandBlockOutput",
  send_command_feedback: "sendCommandFeedback",
  log_admin_commands: "logAdminCommands"
};

export function toMinecraftGamerule(key: string) {
  return explicitMap[key] ?? key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function parseGameruleValue(response: string) {
  const clean = response.trim();
  const colon = clean.match(/:\s*([^\s]+)\s*$/);
  if (colon) return colon[1];

  const equals = clean.match(/=\s*([^\s]+)\s*$/);
  if (equals) return equals[1];

  const parts = clean.split(/\s+/);
  return parts.at(-1) ?? null;
}
