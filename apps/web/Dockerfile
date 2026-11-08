FROM node:24.13.0-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile --filter nexquiz-web...
ARG VITE_AUTH_API_URL=/auth
ARG VITE_GAME_API_URL=/game
ENV VITE_AUTH_API_URL=$VITE_AUTH_API_URL VITE_GAME_API_URL=$VITE_GAME_API_URL
RUN pnpm --filter nexquiz-web build
FROM nginxinc/nginx-unprivileged:1.28.1-alpine
COPY infra/proxy/web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
