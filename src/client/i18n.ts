import type { GameruleState } from '../shared/types';

export type Language = 'fr' | 'en';

const translations = {
  fr: {
    loading: 'Chargement du panel...', logout: 'Deconnexion', serverRuntime: 'MCServer-panel', refresh: 'Actualiser', players: 'joueurs',
    emailOrUser: 'Email ou utilisateur', password: 'Mot de passe', login: 'Connexion', signingIn: 'Connexion...', loginFailed: 'Connexion impossible : verifie email et mot de passe',
    navDashboard: 'Vue d ensemble', navConsole: 'Console', navPlayers: 'Joueurs', navRules: 'Regles', navAddons: 'Add-ons', navCatalog: 'Catalogue', navFiles: 'Fichiers', navLogs: 'Logs', navSettings: 'Config', navUsers: 'Acces',
    state: 'Etat', online: 'Online', offline: 'Offline', rconChecked: 'Connexion RCON testee', noPlayers: 'Aucun joueur connecte', world: 'Monde', unknown: 'inconnu', difficulty: 'Difficulte', whitelist: 'Whitelist', active: 'Active', inactive: 'Inactive', readFromServerProperties: 'Lu depuis server.properties', serverFlavor: 'Serveur', minecraftVersion: 'Version MC', dockerImage: 'Image Docker', updateStatus: 'Mise a jour', panelUpdate: 'Panel', updateAvailable: 'MAJ dispo', upToDate: 'A jour', notChecked: 'Non verifie',
    quickActions: 'Actions rapides', controlledRcon: 'Actions securisees via RCON', saveWorld: 'Sauvegarder', day: 'Mettre le jour', clearWeather: 'Ciel clair', serverMessage: 'Message serveur', send: 'Diffuser', actionDone: 'Action executee', error: 'Erreur',
    rconConsole: 'Console RCON', rconConsoleHint: 'Commandes autorisees uniquement', runCommand: 'Executer', commandRejected: 'Commande refusee',
    worldRules: 'Regles du monde', rconRead: 'Lecture RCON...', apply: 'Appliquer', backRecommended: 'Revenir recommande', ruleApplied: 'regle appliquee', gameruleError: 'Erreur gamerule',
    connected: 'Connectes', nickname: 'Pseudo', add: 'Autoriser', noItem: 'Aucun element',
    addonsTitle: 'Addons et datapacks', uploadZip: 'Importer ZIP', datapackUnavailable: 'datapack list indisponible', datapackUploaded: 'Datapack envoye', uploadRejected: 'Upload refuse', catalogTitle: 'Catalogue Modrinth', catalogHint: 'Filtre selon le serveur detecte et la version Minecraft.', catalogSearch: 'Rechercher un datapack, plugin ou mod', allTypes: 'Tous types compatibles', typeDatapack: 'Datapack', typePlugin: 'Plugin', typeMod: 'Mod', typeResourcepack: 'Resource pack', install: 'Installer', installed: 'Installe', incompatible: 'Non installable', downloads: 'telechargements', openSource: 'Ouvrir la source', noResults: 'Aucun resultat', catalogLoadError: 'Catalogue indisponible', replaceAndInstall: 'Remplacer le fichier existant ?', catalogCompatibleResults: 'resultats compatibles',
    controlledFiles: 'Fichiers controles', mcDataReadOnly: 'Lecture limitee a /mc-data', filter: 'Filtrer', logSource: 'Source logs', live: 'Live', paused: 'Pause', pauseLive: 'Mettre le live en pause', resumeLive: 'Relancer le live', followScroll: 'Defilement auto', tailLines: 'Lignes', lastUpdate: 'MAJ', logUnavailable: 'Logs indisponibles', allLogs: 'Tous',
    serverSettings: 'Parametres serveur', settingsText: "Runtime cible: Minecraft Java via itzg/minecraft-server. Les actions Docker directes restent hors MVP tant que le socket Docker n'est pas monte.",
    usersRoles: 'Utilisateurs et roles', usersText: "Les comptes, emails, SMTP et permissions sont geres par PocketBase. Les collections applicatives sont creees par le script d'initialisation.", openPocketBase: 'Admin PocketBase', pbAdmin: 'PocketBase Admin',
    profileVanilla: 'Vanilla normal', profileFamily: 'Famille / confort', profileEasy: 'Survie facile', profileNormal: 'Survie normale', profileChild: 'Serveur enfant securise'
  },
  en: {
    loading: 'Loading panel...', logout: 'Sign out', serverRuntime: 'MCServer-panel', refresh: 'Refresh', players: 'players',
    emailOrUser: 'Email or username', password: 'Password', login: 'Sign in', signingIn: 'Signing in...', loginFailed: 'Unable to sign in: check email and password',
    navDashboard: 'Overview', navConsole: 'Console', navPlayers: 'Players', navRules: 'Rules', navAddons: 'Add-ons', navCatalog: 'Catalog', navFiles: 'Files', navLogs: 'Logs', navSettings: 'Config', navUsers: 'Access',
    state: 'State', online: 'Online', offline: 'Offline', rconChecked: 'RCON connection checked', noPlayers: 'No players connected', world: 'World', unknown: 'unknown', difficulty: 'Difficulty', whitelist: 'Whitelist', active: 'Active', inactive: 'Inactive', readFromServerProperties: 'Read from server.properties', serverFlavor: 'Server', minecraftVersion: 'MC version', dockerImage: 'Docker image', updateStatus: 'Update', panelUpdate: 'Panel', updateAvailable: 'Update available', upToDate: 'Up to date', notChecked: 'Not checked',
    quickActions: 'Quick actions', controlledRcon: 'Safe RCON actions', saveWorld: 'Save world', day: 'Set day', clearWeather: 'Clear sky', serverMessage: 'Server message', send: 'Broadcast', actionDone: 'Action executed', error: 'Error',
    rconConsole: 'RCON console', rconConsoleHint: 'Allowed commands only', runCommand: 'Run', commandRejected: 'Command rejected',
    worldRules: 'World rules', rconRead: 'Reading RCON...', apply: 'Apply', backRecommended: 'Back to recommended', ruleApplied: 'rule applied', gameruleError: 'Gamerule error',
    connected: 'Connected', nickname: 'Nickname', add: 'Allow', noItem: 'No item',
    addonsTitle: 'Addons and datapacks', uploadZip: 'Import ZIP', datapackUnavailable: 'datapack list unavailable', datapackUploaded: 'Datapack uploaded', uploadRejected: 'Upload rejected', catalogTitle: 'Modrinth catalog', catalogHint: 'Filtered by detected server runtime and Minecraft version.', catalogSearch: 'Search a datapack, plugin or mod', allTypes: 'All compatible types', typeDatapack: 'Datapack', typePlugin: 'Plugin', typeMod: 'Mod', typeResourcepack: 'Resource pack', install: 'Install', installed: 'Installed', incompatible: 'Not installable', downloads: 'downloads', openSource: 'Open source', noResults: 'No result', catalogLoadError: 'Catalog unavailable', replaceAndInstall: 'Replace existing file?', catalogCompatibleResults: 'compatible results',
    controlledFiles: 'Controlled files', mcDataReadOnly: 'Read access limited to /mc-data', filter: 'Filter', logSource: 'Log source', live: 'Live', paused: 'Paused', pauseLive: 'Pause live refresh', resumeLive: 'Resume live refresh', followScroll: 'Auto-scroll', tailLines: 'Lines', lastUpdate: 'Updated', logUnavailable: 'Logs unavailable', allLogs: 'All',
    serverSettings: 'Server settings', settingsText: 'Target runtime: Minecraft Java via itzg/minecraft-server. Direct Docker actions stay out of MVP until the Docker socket is mounted.',
    usersRoles: 'Users and roles', usersText: 'Accounts, email, SMTP and permissions are managed by PocketBase. Application collections are created by the initialization script.', openPocketBase: 'PocketBase Admin', pbAdmin: 'PocketBase Admin',
    profileVanilla: 'Vanilla normal', profileFamily: 'Family / comfort', profileEasy: 'Easy survival', profileNormal: 'Normal survival', profileChild: 'Safe child server'
  }
} as const;

const gamerules = {
  fr: {
    keep_inventory: ['Garder l\'inventaire', 'Les joueurs conservent leur inventaire apres une mort.'], do_fire_tick: ['Propagation du feu', 'Controle la propagation et l\'extinction naturelle du feu.'], mob_griefing: ['Degats des mobs', 'Autorise les mobs a modifier le monde, par exemple les creepers.'], players_sleeping_percentage: ['Sommeil requis', 'Pourcentage de joueurs qui doivent dormir pour passer la nuit.'], show_death_messages: ['Messages de mort', 'Affiche les messages de mort dans le chat.'], announce_advancements: ['Annonces de progres', 'Annonce les progres obtenus par les joueurs.'], do_immediate_respawn: ['Respawn immediat', 'Permet le respawn sans ecran de mort.'], fall_damage: ['Degats de chute', 'Active les degats de chute.'], fire_damage: ['Degats du feu', 'Active les degats de feu.'], drowning_damage: ['Degats de noyade', 'Active les degats de noyade.'], do_daylight_cycle: ['Cycle jour/nuit', 'Fait avancer le cycle du jour et de la nuit.'], do_weather_cycle: ['Cycle meteo', 'Active les changements naturels de meteo.'], do_mob_spawning: ['Spawn des mobs', 'Autorise l\'apparition naturelle des mobs.'], do_trader_spawning: ['Marchand ambulant', 'Autorise le spawn du marchand ambulant.'], do_patrol_spawning: ['Patrouilles', 'Autorise le spawn des patrouilles de pillards.'], do_insomnia: ['Insomnie', 'Autorise les phantoms quand les joueurs ne dorment pas.'], random_tick_speed: ['Vitesse ticks aleatoires', 'Controle la vitesse de croissance et d\'evolution de certains blocs.'], spawn_radius: ['Rayon du spawn', 'Rayon autour du spawn ou les nouveaux joueurs peuvent apparaitre.'], max_entity_cramming: ['Cramming entites', 'Nombre maximal d\'entites empilees avant degats.'], command_block_output: ['Sortie command blocks', 'Affiche la sortie des blocs de commande.'], send_command_feedback: ['Retour commandes', 'Affiche le retour des commandes executees.'], log_admin_commands: ['Log commandes admin', 'Journalise les commandes administrateur.']
  },
  en: {
    keep_inventory: ['Keep inventory', 'Players keep their inventory after death.'], do_fire_tick: ['Fire spread', 'Controls fire spreading and natural extinguishing.'], mob_griefing: ['Mob griefing', 'Allows mobs to alter the world, such as creepers.'], players_sleeping_percentage: ['Sleep percentage', 'Percentage of players required to sleep through the night.'], show_death_messages: ['Death messages', 'Shows death messages in chat.'], announce_advancements: ['Advancement announcements', 'Announces player advancements.'], do_immediate_respawn: ['Immediate respawn', 'Allows respawn without the death screen.'], fall_damage: ['Fall damage', 'Enables fall damage.'], fire_damage: ['Fire damage', 'Enables fire damage.'], drowning_damage: ['Drowning damage', 'Enables drowning damage.'], do_daylight_cycle: ['Daylight cycle', 'Keeps the day and night cycle moving.'], do_weather_cycle: ['Weather cycle', 'Enables natural weather changes.'], do_mob_spawning: ['Mob spawning', 'Allows natural mob spawning.'], do_trader_spawning: ['Wandering trader', 'Allows wandering trader spawning.'], do_patrol_spawning: ['Patrols', 'Allows pillager patrol spawning.'], do_insomnia: ['Insomnia', 'Allows phantoms when players do not sleep.'], random_tick_speed: ['Random tick speed', 'Controls growth and update speed for some blocks.'], spawn_radius: ['Spawn radius', 'Radius around spawn where new players may appear.'], max_entity_cramming: ['Entity cramming', 'Maximum stacked entities before damage.'], command_block_output: ['Command block output', 'Shows command block output.'], send_command_feedback: ['Command feedback', 'Shows feedback for executed commands.'], log_admin_commands: ['Log admin commands', 'Logs administrator commands.']
  }
} as const;

const profileLabels = { vanilla_normal: 'profileVanilla', family_comfort: 'profileFamily', easy_survival: 'profileEasy', normal_survival: 'profileNormal', safe_child_server: 'profileChild' } as const;

export type TranslationKey = keyof typeof translations.fr;

export function t(language: Language, key: TranslationKey) {
  return translations[language][key] ?? translations.fr[key];
}

export function normalizeLanguage(value: string | null): Language {
  return value === 'en' ? 'en' : 'fr';
}

export function localizeRule(language: Language, rule: GameruleState) {
  const localized = gamerules[language][rule.key as keyof typeof gamerules.fr];
  if (!localized) return rule;
  return { ...rule, label: localized[0], description: localized[1] };
}

export function profileLabel(language: Language, key: string) {
  const labelKey = profileLabels[key as keyof typeof profileLabels];
  return labelKey ? t(language, labelKey) : key;
}
