FROM node:22.22.0-alpine3.23 AS dependencies

WORKDIR /app

RUN apk add --no-cache g++ make python3

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/document-contract/package.json ./packages/document-contract/package.json
RUN npm_config_build_from_source=true npm ci

FROM dependencies AS build

COPY tsconfig*.json ./
COPY apps/api ./apps/api
COPY packages/document-contract ./packages/document-contract
RUN npm exec tsc -- --build \
    packages/document-contract/tsconfig.json \
    apps/api/tsconfig.json \
    --force \
  && npm prune --omit=dev

FROM node:22.22.0-alpine3.23 AS runtime

ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3000 \
    NPM_CONFIG_CACHE=/tmp/npm \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/packages/document-contract/package.json ./packages/document-contract/package.json
COPY --from=build --chown=node:node /app/packages/document-contract/dist ./packages/document-contract/dist

WORKDIR /app/apps/api

USER node

EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health/ready').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
