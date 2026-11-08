FROM nginxinc/nginx-unprivileged:1.28.1-alpine
# Browser-facing API URLs; override at runtime. They must be listed in the APIs' CORS_ORIGINS when on another origin.
ENV AUTH_API_URL=http://localhost:8080/auth GAME_API_URL=http://localhost:8080/game NGINX_ENVSUBST_FILTER="^(AUTH|GAME)_API_URL$"
COPY apps/results-client/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY apps/results-client/public /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
