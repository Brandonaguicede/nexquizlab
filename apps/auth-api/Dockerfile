FROM node:24.13.0-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tar && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY scripts/prisma.cjs scripts/prepare-scalar.cjs ./scripts/
COPY scripts/vendor/scalar-LICENSE ./scripts/vendor/scalar-LICENSE
COPY apps/auth-api ./apps/auth-api
RUN pnpm install --frozen-lockfile --filter nexquiz-auth-api...
RUN node scripts/prepare-scalar.cjs --app auth
RUN pnpm --filter nexquiz-auth-api generate && pnpm --filter nexquiz-auth-api build
RUN mkdir -p /app/images && chown node:node /app/images
FROM build AS runtime
ENV NODE_ENV=production
USER node
WORKDIR /app/apps/auth-api
EXPOSE 3001
CMD ["node", "scripts/start.cjs"]
