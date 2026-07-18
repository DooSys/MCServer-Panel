import type { GameruleDefinition } from "./types.js";

export const GAMERULES: GameruleDefinition[] = [
  {
    key: "keep_inventory",
    label: "Garder l'inventaire",
    description: "Les joueurs conservent leur inventaire apres une mort.",
    valueType: "boolean",
    defaultValue: "false",
    recommendedValue: "true",
    category: "Confort"
  },
  {
    key: "do_fire_tick",
    label: "Propagation du feu",
    description: "Controle la propagation et l'extinction naturelle du feu.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "false",
    category: "Protection"
  },
  {
    key: "mob_griefing",
    label: "Degats des mobs",
    description: "Autorise les mobs a modifier le monde, par exemple les creepers.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "false",
    category: "Protection"
  },
  {
    key: "players_sleeping_percentage",
    label: "Sommeil requis",
    description: "Pourcentage de joueurs qui doivent dormir pour passer la nuit.",
    valueType: "number",
    defaultValue: "100",
    recommendedValue: "50",
    category: "Confort"
  },
  {
    key: "show_death_messages",
    label: "Messages de mort",
    description: "Affiche les messages de mort dans le chat.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "true",
    category: "Chat"
  },
  {
    key: "announce_advancements",
    label: "Annonces de progres",
    description: "Annonce les progres obtenus par les joueurs.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "true",
    category: "Chat"
  },
  {
    key: "do_immediate_respawn",
    label: "Respawn immediat",
    description: "Permet le respawn sans ecran de mort.",
    valueType: "boolean",
    defaultValue: "false",
    recommendedValue: "false",
    category: "Confort"
  },
  {
    key: "fall_damage",
    label: "Degats de chute",
    description: "Active les degats de chute.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "true",
    category: "Survie"
  },
  {
    key: "fire_damage",
    label: "Degats du feu",
    description: "Active les degats de feu.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "true",
    category: "Survie"
  },
  {
    key: "drowning_damage",
    label: "Degats de noyade",
    description: "Active les degats de noyade.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "true",
    category: "Survie"
  },
  {
    key: "do_daylight_cycle",
    label: "Cycle jour/nuit",
    description: "Fait avancer le cycle du jour et de la nuit.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "true",
    category: "Monde"
  },
  {
    key: "do_weather_cycle",
    label: "Cycle meteo",
    description: "Active les changements naturels de meteo.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "true",
    category: "Monde"
  },
  {
    key: "do_mob_spawning",
    label: "Spawn des mobs",
    description: "Autorise l'apparition naturelle des mobs.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "true",
    category: "Monde"
  },
  {
    key: "do_trader_spawning",
    label: "Marchand ambulant",
    description: "Autorise le spawn du marchand ambulant.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "true",
    category: "Monde"
  },
  {
    key: "do_patrol_spawning",
    label: "Patrouilles",
    description: "Autorise le spawn des patrouilles de pillards.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "false",
    category: "Famille"
  },
  {
    key: "do_insomnia",
    label: "Insomnie",
    description: "Autorise les phantoms quand les joueurs ne dorment pas.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "false",
    category: "Famille"
  },
  {
    key: "random_tick_speed",
    label: "Vitesse ticks aleatoires",
    description: "Controle la vitesse de croissance et d'evolution de certains blocs.",
    valueType: "number",
    defaultValue: "3",
    recommendedValue: "3",
    category: "Performance"
  },
  {
    key: "spawn_radius",
    label: "Rayon du spawn",
    description: "Rayon autour du spawn ou les nouveaux joueurs peuvent apparaitre.",
    valueType: "number",
    defaultValue: "10",
    recommendedValue: "10",
    category: "Monde"
  },
  {
    key: "max_entity_cramming",
    label: "Cramming entites",
    description: "Nombre maximal d'entites empilees avant degats.",
    valueType: "number",
    defaultValue: "24",
    recommendedValue: "24",
    category: "Performance"
  },
  {
    key: "command_block_output",
    label: "Sortie command blocks",
    description: "Affiche la sortie des blocs de commande.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "false",
    category: "Administration"
  },
  {
    key: "send_command_feedback",
    label: "Retour commandes",
    description: "Affiche le retour des commandes executees.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "true",
    category: "Administration"
  },
  {
    key: "log_admin_commands",
    label: "Log commandes admin",
    description: "Journalise les commandes administrateur.",
    valueType: "boolean",
    defaultValue: "true",
    recommendedValue: "true",
    category: "Audit"
  }
];

export const RECOMMENDED_PROFILES = [
  {
    key: "vanilla_normal",
    label: "Vanilla normal",
    values: {}
  },
  {
    key: "family_comfort",
    label: "Famille / confort",
    values: {
      keep_inventory: "true",
      do_fire_tick: "false",
      mob_griefing: "false",
      players_sleeping_percentage: "50",
      do_insomnia: "false",
      do_patrol_spawning: "false"
    }
  },
  {
    key: "easy_survival",
    label: "Survie facile",
    values: {
      keep_inventory: "true",
      players_sleeping_percentage: "50",
      do_immediate_respawn: "true"
    }
  },
  {
    key: "normal_survival",
    label: "Survie normale",
    values: {
      keep_inventory: "false",
      mob_griefing: "true",
      do_fire_tick: "true"
    }
  },
  {
    key: "safe_child_server",
    label: "Serveur enfant securise",
    values: {
      keep_inventory: "true",
      do_fire_tick: "false",
      mob_griefing: "false",
      players_sleeping_percentage: "50",
      do_insomnia: "false",
      do_patrol_spawning: "false",
      show_death_messages: "false"
    }
  }
];
