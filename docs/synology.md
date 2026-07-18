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
ghcr.io/doosys/mcserver-panel:1.1.1
```

Si le package GHCR est prive :

```bash
docker login ghcr.io
```

Utiliser un token GitHub avec `read:packages`.

## Compose

Partir de `docker-compose.example.yml`, remplacer les secrets, puis copier le fichier sur le NAS dans le dossier choisi.

Deploiement du panel uniquement :

```bash
cd /volume1/docker/MCServer-panel
docker compose pull MCServer-panel
docker compose up -d MCServer-panel
```

Deploiement complet Minecraft + panel :

```bash
cd /volume1/docker/MCServer-panel
docker compose pull
docker compose up -d
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
http://IP_DU_SERVEUR:8088/pb/_/
```

Panel :

```text
http://IP_DU_SERVEUR:8088
```

## Ports

Expose uniquement :

```text
25565 -> Minecraft Java
8088  -> Panel web
```

Ne pas exposer RCON `25575`.

## Reverse proxy

Si le panel sort du LAN, placer un reverse proxy HTTPS devant `8088`, idealement avec restriction IP, VPN ou authentification supplementaire.
