# syntax=docker/dockerfile:1

# glibc base: Prisma schema-engine needs it (avoid alpine/musl).
FROM node:22.23.4-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1

# postinstall runs `prisma generate`, so schema + config must exist before npm ci.
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=deps /app/lib/generated ./lib/generated
RUN npm run build

# Prisma CLI only: version and transitive deps come from the app's package.json + lockfile.
FROM base AS migrate
WORKDIR /migrate
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  want=$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version") \
  && node -e "const fs=require('fs'),p=require('./package.json');fs.writeFileSync('package.json',JSON.stringify({private:true,dependencies:{prisma:p.devDependencies.prisma},overrides:p.overrides}))" \
  && npm install --no-audit --no-fund \
  && got=$(node -p "require('prisma/package.json').version") \
  && { [ "$got" = "$want" ] || { echo "prisma $got != app lockfile $want" >&2; exit 1; }; }
COPY prisma.config.ts ./
COPY prisma ./prisma
USER node
ENTRYPOINT ["/migrate/node_modules/.bin/prisma"]
CMD ["migrate", "deploy"]

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=8282
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Files stay root-owned (read-only for node); only the Next cache dir is writable.
RUN mkdir -p /app/.next/cache && chown node:node /app/.next/cache
USER node
EXPOSE 8282
# proxy.ts answers 403 to loopback requests without the trusted IP header; any non-5xx means the server is up.
HEALTHCHECK --interval=60s --timeout=10s --retries=3 --start-period=60s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8282)+'/',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]