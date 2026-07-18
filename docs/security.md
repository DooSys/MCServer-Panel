# Securite

## RCON

RCON doit rester interne au reseau Docker. Ne pas exposer `25575:25575` dans le compose public. Le panel utilise `MC_RCON_HOST=minecraft` et rejoint le serveur par le reseau Docker interne.

## Authentification

PocketBase est proxyfie sous `/_/` et `/api`; le client panel conserve `/pb` pour son auth store. Le backend valide les tokens utilisateurs avec `auth-refresh` quand `REQUIRE_AUTH=true`.

Pour un LAN familial, garder tout de meme un reverse proxy avec TLS si l'acces sort de la machine locale. Pour un acces distant, privilegier VPN ou reverse proxy avec authentification forte.

## Fichiers Minecraft

Tous les chemins passent par une resolution stricte sous `MC_DATA_PATH`. Les routes MVP ne donnent pas d'editeur libre global : seules les lectures et actions specialisees sont exposees.

## Addons

Le MVP autorise uniquement les datapacks zip. Les plugins Bukkit/Paper, mods Fabric et mods Forge peuvent etre detectes mais ne sont pas installes sur un serveur Vanilla.

Avant remplacement ou suppression, le backend copie le fichier dans `/mc-data/.mcserver-panel-backups/datapacks`.

## Commandes dangereuses

La commande `stop` est bloquee sauf si `ALLOW_STOP_SERVER=true`. Les actions Docker comme restart container ne sont pas incluses dans le MVP car elles necessitent le socket Docker, qui augmenterait fortement la surface de risque.
