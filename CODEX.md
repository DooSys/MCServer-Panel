# Codex Maintenance Notes - MCServer Panel

## Workspace

- Work only from WSL/Linux paths.
- Project path: `/home/Doonix/DooSys_GitHub/MCServer-Panel`.
- Avoid PowerShell path operations on this repo because UNC/WSL paths can fail with sandbox or quoting issues.
- Preferred command wrapper from Codex desktop: `wsl -e bash -lc "cd /home/Doonix/DooSys_GitHub/MCServer-Panel && <command>"`.

## Current Version

- App version starts at `1.1.8`.
- Versioning policy: semver `MAJOR.MINOR.PATCH`.
- Increment `PATCH` for every correction/fix.
- Keep these locations aligned when changing version:
  - `package.json`
  - `package-lock.json`
  - `Dockerfile` `ARG APP_VERSION`
  - `.github/workflows/docker-image.yml` build arg
  - `.env.example`
  - `docker-compose.example.yml`
  - `README.md`
  - `src/server/config.ts` fallback

Useful version command:

```bash
npm version 1.1.8 --no-git-tag-version
```

Then update Docker/docs references to the same version.

## Stack

- Frontend: React 19, Vite, TypeScript, lucide-react.
- Backend: Express, TypeScript, RCON client, PocketBase JS SDK.
- Runtime image: Node 22 Alpine.
- Embedded services in the panel container:
  - PocketBase served on `127.0.0.1:8090`.
  - Express API/UI on `APP_PORT`, default `8080`.
  - PocketBase init script under supervisord.
- Target Minecraft runtime: `itzg/minecraft-server` with RCON enabled.

## Docker / Release Flow

- Image name: `ghcr.io/doosys/mcserver-panel`.
- GitHub Actions workflow: `.github/workflows/docker-image.yml`.
- Push to `main` publishes `latest`.
- Git tag `vX.Y.Z` publishes semver tags.
- Synology compose should consume `ghcr.io/doosys/mcserver-panel:latest` during active testing.
- `docker-compose.example.yml` is panel-only; it must not define or manage the `itzg/minecraft-server` service during Synology validation.
- The existing Minecraft container should be attached once to `MCServer-panel-net` with `docker network connect MCServer-panel-net minecraft`, avoiding a game server reboot.
- If GHCR package is private, Synology needs `docker login ghcr.io` with a GitHub token that can `read:packages`.

Release commands from WSL:

```bash
git status
git add .
git commit -m "Release 1.1.8"
git push origin main
git tag v1.1.8
git push origin v1.1.8
```

## Validation Commands

Run from WSL:

```bash
npm run typecheck
npm run build
npm test
```

Notes:

- `npm test` currently runs typecheck + build.
- Docker CLI is not guaranteed to be installed in the local Debian WSL environment; Docker image build may need GitHub Actions or the Synology host.
- Network access can be restricted in Codex, so external API checks may fail locally.

## Important Files

- `Dockerfile`: production image, PocketBase download, healthcheck.
- `docker-compose.example.yml`: Synology-oriented compose using GHCR image.
- `docker/supervisord.conf`: starts PocketBase, app, and init.
- `docker/entrypoint.sh`: creates PB data directory and upserts PB superuser.
- `docker/init-pocketbase.sh`: waits for PocketBase and runs `npm run pb:init`.
- `scripts/init-pocketbase.mjs`: creates collections and initial panel user.
- `src/server/config.ts`: central env defaults.
- `src/server/routes.ts`: API routes.
- `src/server/catalog.ts`: optional Modrinth catalog integration.
- `src/client/App.tsx`: UI pages.
- `src/client/i18n.ts`: FR/EN labels.

## PocketBase Auth

- UI auth uses PocketBase user collection through `/pb` proxy.
- Initial panel user is created by `scripts/init-pocketbase.mjs`.
- Existing panel user password is updated from `PANEL_ADMIN_PASSWORD` on every init.
- Browser login uses backend endpoint `/api/auth/login`, which proxies PocketBase auth and then stores the returned token in the PocketBase client auth store.
- Superuser PocketBase login is accepted as a first-run/admin fallback; `requireAuth` validates both `users` and `_superusers` tokens.
- Preferred envs:
  - `PB_SUPERUSER_EMAIL`
  - `PB_SUPERUSER_PASSWORD`
  - `PANEL_ADMIN_EMAIL`
  - `PANEL_ADMIN_PASSWORD`
- If `PANEL_ADMIN_*` is missing, init can fallback to PB superuser credentials.
- PocketBase admin UI is exposed at `/pb/_/` through the panel.

## Catalog Status

- Modrinth code exists but is considered optional for now.
- Synology example sets:
  - `ENABLE_CATALOG=false`
  - `ENABLE_CATALOG_INSTALL=false`
- Re-enable later once base Docker/Synology validation is stable.
- Install targets when enabled:
  - datapack -> `/mc-data/world/datapacks`
  - plugin -> `/mc-data/plugins`
  - mod -> `/mc-data/mods`

## Security Rules

- Never expose RCON port `25575` publicly.
- Keep `/mc-data` scoped to the intended Minecraft server volume.
- Do not bypass `withinMcData` for filesystem paths.
- Keep RCON command allowlist conservative.
- Back up before replacing/deleting addons.
- Do not hardcode secrets; use env vars only.

## User Preferences

- User speaks French.
- Keep project and command guidance in WSL/Linux form.
- The target deployment is Synology Docker/Container Manager.
- Prefer practical implementation and validation over long theory.

## RCON Diagnostics

- Server status now exposes `rconHost`, `rconPort`, and `rconError`.
- Authenticated endpoint `/api/diagnostics/rcon` tests TCP reachability before running RCON `list`.
- Use it to distinguish Docker DNS/network issues from RCON password issues.

## Logs Integration

- Version 1.1.8 adds /api/logs/sources and /api/logs/:source.
- Sources are minecraft-container, panel-container, and minecraft-latest.
- Docker container logs use the Docker Engine API over DOCKER_SOCKET_PATH; Synology compose mounts /var/run/docker.sock read-only.
- UI supports source selection, filter, live refresh, tail size, and auto-scroll pause.
