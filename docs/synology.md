# Installation Synology / Docker Compose

Cette procedure vise le flux suivant : pousser le code sur GitHub, laisser GitHub Actions publier l'image Docker sur GHCR, puis tirer la derniere image depuis le Synology.

## Chemins conseilles

Exemple :

```text
/volume1/docker/minecraft/data/world-1-21
/volume1/docker/MCServer-panel/pb_data
/volume1/docker/MCServer-panel/docker-compose.yml
```

Le meme dossier monde doit etre monte :

- dans Minecraft sur `/data` ;
- dans MCServer Panel sur `/mc-data`.

## Image

Image de test continue :

```text
ghcr.io/doosys/mcserver-panel:latest
```

Image versionnee :

```text
ghcr.io/doosys/mcserver-panel:1.1.12
```

Si le package GHCR est prive :

```bash
docker login ghcr.io
```

Utiliser un token GitHub avec `read:packages`.

## Compose

Le compose de ce projet ne gere que `MCServer-panel`. Le serveur Minecraft existant reste dans son conteneur actuel et ne sera pas redemarre par les commandes du panel.

Preparer le dossier du panel :

```bash
mkdir -p /volume1/docker/MCServer-panel/pb_data
cd /volume1/docker/MCServer-panel
cp docker-compose.example.yml docker-compose.yml
cp .env.example .env
```

Modifier `.env` avec `SERVER`, `RCON_PASSWORD`, `MC_WORLD_PATH` et `PANEL_DATA_PATH`.

Le panel doit joindre le conteneur Minecraft via un reseau Docker commun. Une fois seulement, sans reboot du serveur Minecraft :

```bash
docker network create MCServer-panel-net
docker network connect MCServer-panel-net minecraft
```

Deploiement ou mise a jour du panel uniquement :

```bash
cd /volume1/docker/MCServer-panel
docker compose pull MCServer-panel
docker compose up -d MCServer-panel
```

Suivi des logs :

```bash
docker logs -f MCServer-panel
```

Healthcheck :

```bash
docker inspect --format='{{json .State.Health}}' MCServer-panel
```

## Premiere connexion

Le conteneur cree automatiquement :

- le superuser PocketBase avec `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD` ;
- l'utilisateur panel avec `PANEL_ADMIN_EMAIL` / `PANEL_ADMIN_PASSWORD`.

PocketBase admin :

```text
http://IP_DU_SERVEUR:8088/_/
```

Panel :

```text
http://IP_DU_SERVEUR:8088
```

## Diagnostic RCON

Si le dashboard affiche `RCON off`, verifier d'abord que le panel utilise la bonne image et le bon env :

```bash
docker logs MCServer-panel | grep mcserver-panel@
docker exec MCServer-panel printenv SERVER RCON_PORT MC_RCON_HOST MC_RCON_PORT MC_DOCKER_NETWORK
```

Verifier que le conteneur Minecraft est bien sur le reseau commun :

```bash
docker network inspect MCServer-panel-net
```

Verifier la resolution DNS depuis le panel :

```bash
docker exec MCServer-panel getent hosts minecraft
```

Depuis l'UI connectee, l'endpoint suivant renvoie le diagnostic TCP/RCON sans exposer le mot de passe :

```text
http://IP_DU_SERVEUR:8088/api/diagnostics/rcon
```

Interpretation rapide :

- `tcp.ok=false` avec `ENOTFOUND` : nom `SERVER` incorrect ou reseau Docker absent.
- `tcp.ok=false` avec `ECONNREFUSED` : mauvais port ou RCON non actif cote Minecraft.
- `tcp.ok=true` et `command.ok=false` : mot de passe RCON incorrect ou protocole RCON refuse.
- `command.ok=true` : RCON fonctionne, le dashboard doit remonter les joueurs.

## Ports

Expose uniquement :

```text
25565 -> Minecraft Java
8088  -> Panel web
```

Ne pas exposer RCON `25575`.

## Reverse proxy

Si le panel sort du LAN, placer un reverse proxy HTTPS devant `8088`, idealement avec restriction IP, VPN ou authentification supplementaire.

## Logs Depuis L Interface

La page Logs peut lire les logs du conteneur Minecraft et du conteneur MCServer-panel si le socket Docker est monte en lecture seule :

    DOCKER_SOCKET_PATH=/var/run/docker.sock
    MC_CONTAINER_NAME=minecraft
    PANEL_CONTAINER_NAME=MCServer-panel

Sans ce montage, la source Minecraft latest.log reste disponible via le volume /mc-data, mais les sources docker logs afficheront une erreur Docker API indisponible.

Note auth navigateur : depuis 1.1.12, le panel et PocketBase admin utilisent deux stockages separes. Si une ancienne session reste bloquee, ouvrir d abord le panel une fois nettoie automatiquement l ancienne session panel stockee dans PocketBase admin.
