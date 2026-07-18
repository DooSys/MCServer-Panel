# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22-alpine
ARG APP_VERSION=1.1.7
ARG PB_VERSION=0.38.2

FROM node:${NODE_VERSION} AS build
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:${NODE_VERSION} AS runtime
ARG APP_VERSION
ARG PB_VERSION
ARG TARGETARCH

LABEL org.opencontainers.image.title="MCServer Panel" \
  org.opencontainers.image.description="Modern web panel for itzg/minecraft-server with RCON, PocketBase and controlled addon management." \
  org.opencontainers.image.source="https://github.com/DooSys/MCServer-Panel" \
  org.opencontainers.image.version="${APP_VERSION}"

WORKDIR /app
ENV NODE_ENV=production \
  APP_VERSION=${APP_VERSION} \
  APP_PORT=8080 \
  POCKETBASE_URL=http://127.0.0.1:8090 \
  POCKETBASE_DATA=/app/pb_data \
  MC_DATA_PATH=/mc-data \
  REQUIRE_AUTH=true

RUN apk add --no-cache curl unzip supervisor tzdata \
  && case "${TARGETARCH:-amd64}" in \
    amd64) PB_ARCH="amd64" ;; \
    arm64) PB_ARCH="arm64" ;; \
    *) echo "Unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; \
  esac \
  && curl -fsSL -o /tmp/pocketbase.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip" \
  && unzip /tmp/pocketbase.zip -d /usr/local/bin \
  && chmod +x /usr/local/bin/pocketbase \
  && rm /tmp/pocketbase.zip

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY pb_migrations ./pb_migrations
COPY scripts ./scripts
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/init-pocketbase.sh /init-pocketbase.sh
RUN chmod +x /entrypoint.sh /init-pocketbase.sh \
  && mkdir -p /app/pb_data /mc-data /tmp/mcserver-panel-uploads /tmp/mcserver-panel-catalog

EXPOSE 8080
VOLUME ["/app/pb_data", "/mc-data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" || exit 1
CMD ["/entrypoint.sh"]
