FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev && rm -rf .next/cache

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/next.config.js /app/package.json ./
COPY --from=build --chown=node:node /app/scripts/start-production.mjs /app/scripts/local-env.mjs ./scripts/
COPY --from=build --chown=node:node /app/src/lib/publicOrigin.ts ./src/lib/
USER node
EXPOSE 3000
CMD ["node", "scripts/start-production.mjs"]
