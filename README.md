# MCServer Panel

MCServer Panel est une interface web moderne pour administrer un serveur Minecraft Java existant base sur `itzg/minecraft-server`. Le panel tourne dans son propre conteneur, communique avec Minecraft via RCON, lit/ecrit de facon controlee dans le volume `/mc-data`, et embarque PocketBase pour les comptes, les preferences et l'audit applicatif.

Version actuelle : `1.1.9`.

## Objectif du projet

- Fournir un dashboard clair pour surveiller un serveur Minecraft familial ou prive.
- Eviter l'exposition du port RCON sur Internet.
- Garder un deploiement simple sur Synology Docker/Container Manager.
- Pouvoir publier une image Docker depuis GitHub puis la tirer sur le NAS.
- Conserver une base maintenable avec versioning semver : `MAJOR.MINOR.PATCH`, en incrementant le patch pour chaque correction.

## Fonctionnalites

- Dashboard : etat serveur, RCON, joueurs, MOTD, mode de jeu, difficulte, whitelist.
- Detection runtime : Vanilla, Paper, Purpur, Spigot, Bukkit, Fabric ou Forge via logs/env.
- Affichage image Docker Minecraft et image Docker du panel.
- Badge de mise a jour panel configurable dans le header.
- Actions rapides controlees : `save-all`, `say`, `time set day`, `weather clear`.
- Console RCON avec allowlist de commandes.
- Gamerules lues via RCON et modifiables depuis l'interface.
- Gestion joueurs : connectes, whitelist, ops, ajout/retrait whitelist, op/deop.
- Fichiers : lecture controlee de `server.properties`, `latest.log`, `whitelist.json`, `ops.json`, `world/datapacks`.
- Logs : recherche, filtres simples et detections d'evenements.
- Addons : listing datapacks, upload zip, inspection `pack.mcmeta`, backup avant suppression/remplacement.
- Catalogue Modrinth optionnel : code present, desactive dans l'exemple Synology pour valider d'abord l'environnement local.
- PocketBase integre : proxy `/pb`, auth users, collections applicatives, seed gamerules, audit.
- Interface multilingue FR/EN, FR par defaut.

## Architecture

```text
src/client        UI React/Vite
src/server        API Express, RCON, fichiers, addons, catalogue optionnel
src/shared        Types partages et definitions gamerules
scripts           Initialisation PocketBase
pb_migrations     Migrations PocketBase futures
docker            supervisord, entrypoint et init PocketBase
docs              Notes securite et Synology
.github/workflows Publication Docker GHCR
```

Le conteneur lance trois processus supervises :

- PocketBase sur `127.0.0.1:8090`.
- L'API/UI Node sur `APP_PORT`, par defaut `8080`.
- Le script `pocketbase-init`, qui cree les collections et l'utilisateur panel si les variables admin sont presentes.

## Image Docker

Le Dockerfile est multi-stage :

- build Node 22 avec `npm ci` et `npm run build` ;
- runtime Node 22 Alpine avec dependances production uniquement ;
- PocketBase embarque via `PB_VERSION` ;
- support `linux/amd64` et `linux/arm64` ;
- healthcheck sur `/api/health` ;
- volumes `/app/pb_data` et `/mc-data`.

Build local manuel :

```bash
docker build --build-arg APP_VERSION=1.1.9 -t ghcr.io/doosys/mcserver-panel:1.1.9 .
```

Test local rapide apres build :

```bash
docker run --rm -p 8088:8080 \
  -e REQUIRE_AUTH=false \
  -e RCON_PASSWORD=dev \
  -v "$PWD/.tmp/mc-data:/mc-data" \
  -v "$PWD/.tmp/pb_data:/app/pb_data" \
  ghcr.io/doosys/mcserver-panel:1.1.9
```

## Publication GitHub

Le workflow `.github/workflows/docker-image.yml` publie l'image sur GitHub Container Registry quand la branche `main` est push, ou lors d'un tag `v*`.

Tags produits :

- `ghcr.io/doosys/mcserver-panel:latest` sur `main` ;
- `ghcr.io/doosys/mcserver-panel:1.1.9` avec un tag Git `v1.1.9` ;
- `ghcr.io/doosys/mcserver-panel:1.1` ;
- tag court base sur le SHA.

Commandes de release typiques depuis WSL :

```bash
git status
git add .
git commit -m "Release 1.1.9"
git push origin main
git tag v1.1.9
git push origin v1.1.9
```

GitHub Actions doit avoir le droit `packages: write`, deja defini dans le workflow. Si l'image GHCR est privee, le Synology devra faire un `docker login ghcr.io` avec un token GitHub ayant le droit `read:packages`.

## Deploiement Synology

Le compose fourni lance uniquement `MCServer-panel`. Il ne contient pas le service `itzg/minecraft-server`, afin de pouvoir mettre a jour le panel sans redemarrer le serveur de jeu.

Preparation sur le NAS :

```bash
mkdir -p /volume1/docker/MCServer-panel/pb_data
cd /volume1/docker/MCServer-panel
cp docker-compose.example.yml docker-compose.yml
cp .env.example .env
```

Modifier `.env` :

- `SERVER` avec le nom DNS Docker ou IP du serveur Minecraft ;
- `RCON_PASSWORD` avec le vrai mot de passe RCON du serveur existant ;
- `MC_WORLD_PATH` avec le dossier monde existant ;
- `PANEL_DATA_PATH` avec le dossier persistant du panel ;
- `PB_SUPERUSER_*` et `PANEL_ADMIN_*` avec des secrets forts.

Si le conteneur Minecraft existant s'appelle `minecraft`, raccorder le panel et Minecraft a un reseau commun une seule fois :

```bash
docker network create MCServer-panel-net
docker network connect MCServer-panel-net minecraft
```

Puis deployer ou mettre a jour seulement le panel :

```bash
cd /volume1/docker/MCServer-panel
docker compose pull MCServer-panel
docker compose up -d MCServer-panel
```

URL panel :

```text
http://IP_DU_SERVEUR:8088
```

PocketBase admin :

```text
http://IP_DU_SERVEUR:8088/_/
```

## Variables d'environnement

| Variable | Defaut | Usage |
| --- | --- | --- |
| `SERVER` | `minecraft` | Nom DNS Docker ou IP du serveur Minecraft existant |
| `RCON_PORT` | `25575` | Port RCON interne du serveur existant |
| `RCON_PASSWORD` | vide | Mot de passe RCON, jamais affiche dans l'UI |
| `MC_WORLD_PATH` | `/volume1/...` | Dossier monde Minecraft existant monte dans le panel |
| `PANEL_DATA_PATH` | `/volume1/docker/MCServer-panel/data` | Donnees persistantes du panel et de PocketBase |
| `MC_DOCKER_NETWORK` | `MCServer-panel-net` | Reseau Docker externe commun avec Minecraft |
| `MC_DATA_PATH` | `/mc-data` | Chemin interne du volume Minecraft dans le panel |
| `MC_SERVER_FLAVOR` | vide | Force le runtime affiche si les logs ne suffisent pas |
| `MC_VERSION` | vide | Version Minecraft affichee et fallback tag image |
| `MC_DOCKER_IMAGE` | `itzg/minecraft-server` | Image Docker affichee dans le dashboard |
| `MC_DOCKER_TAG` | vide | Tag image affiche dans le dashboard |
| `ENABLE_IMAGE_UPDATE_CHECK` | `false` | Reserve a une future integration registry/Docker socket |
| `APP_VERSION` | `1.1.9` | Version affichee pour MCServer-Panel |
| `APP_DOCKER_IMAGE` | `ghcr.io/doosys/mcserver-panel` | Image du panel affichee dans le header |
| `APP_DOCKER_TAG` | `latest` | Tag de l'image du panel |
| `PANEL_UPDATE_STATUS` | `not_checked` | Badge header: `not_checked`, `current`, `update_available` ou `unknown` |
| `ENABLE_CATALOG` | `false` dans compose | Active la recherche externe Modrinth |
| `ENABLE_CATALOG_INSTALL` | `false` dans compose | Autorise l'installation depuis le catalogue vers `/mc-data` |
| `CATALOG_USER_AGENT` | `MCServer-Panel/1.1.9` | User-Agent envoye aux APIs externes |
| `APP_PORT` | `8080` | Port interne du panel |
| `POCKETBASE_DATA` | `/app/pb_data` | Donnees PocketBase persistantes |
| `POCKETBASE_URL` | `http://127.0.0.1:8090` | URL interne PocketBase |
| `REQUIRE_AUTH` | `true` | Active la verification du token PocketBase |
| `ALLOW_STOP_SERVER` | `false` | Autorise explicitement la commande `stop` |
| `UPLOAD_LIMIT_MB` | `64` | Taille max des uploads/catalogue |
| `TZ` | `Europe/Paris` | Fuseau horaire du conteneur |

## Developpement local

Le projet est prevu pour Node 22.

```bash
npm install
npm run dev
```

Pour developper sans auth PocketBase :

```bash
REQUIRE_AUTH=false npm run dev
```

Validation avant push :

```bash
npm run typecheck
npm run build
npm test
```

## Securite

- Ne jamais publier le port RCON `25575` sur Internet.
- Monter uniquement le volume Minecraft voulu dans `/mc-data`.
- Garder PocketBase derriere le proxy `/pb` du panel.
- Utiliser des secrets forts pour RCON, PocketBase et le compte panel.
- L'API bloque le path traversal et limite la lecture aux fichiers MVP.
- Les commandes RCON libres sont limitees par allowlist.
- Les operations destructives passent par des endpoints specialises.
- Les uploads zip sont inspectes avant installation.
- Les suppressions/remplacements creent un backup dans `/mc-data/.mcserver-panel-backups`.

Voir aussi [docs/security.md](docs/security.md) et [docs/synology.md](docs/synology.md).

## Logs Panel Et Minecraft

La page Logs affiche trois sources distinctes :

- Minecraft container : equivalent a docker logs minecraft, via MC_CONTAINER_NAME.
- MCServer-panel container : logs du panel, PocketBase et supervisord, via PANEL_CONTAINER_NAME.
- Minecraft latest.log : lecture fichier de /mc-data/logs/latest.log, utile meme sans acces Docker.

Pour les deux sources Docker, le socket Docker doit etre monte en lecture seule dans le conteneur du panel :

    - ${DOCKER_SOCKET_PATH}:/var/run/docker.sock:ro

Variables associees : MC_CONTAINER_NAME, PANEL_CONTAINER_NAME, DOCKER_SOCKET_PATH et LOG_TAIL_LINES.
