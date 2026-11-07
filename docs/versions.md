# Versiones declaradas
Las versiones exactas de cada dependencia están en package.json de cada aplicación. Son una selección conservadora compatible; no una afirmación de que sean las últimas versiones publicadas.

| Componente | Versión |
| --- | --- |
| Node.js LTS | 24.13.0 en Docker; 24.x en engines |
| pnpm | 10.28.2 |
| TypeScript | 5.9.3 |
| React | 19.2.4 |
| React Router | 7.13.0 |
| Vite | 7.3.1 |
| Tailwind CSS | 4.1.18 |
| NestJS | 11.1.12 |
| Prisma | 6.19.0 |
| PostgreSQL | 17.7 |
| Scalar NestJS / bundle navegador | 1.0.27 / 1.44.23 |
| OpenTelemetry API / Node SDK / Metrics SDK | 1.9.0 / 0.211.0 / 2.5.0 |
| Jest / ts-jest / Supertest | 30.2.0 / 29.4.6 / 7.2.2 |
| Playwright | 1.58.2 |
| Socket.IO (servidor y cliente) / @nestjs/websockets | 4.8.3 / 11.1.12 |
| Collector / Prometheus / Grafana | 0.145.0 / 3.9.1 / 12.3.2 |
| Caddy / Nginx unprivileged | 2.10.2 / 1.28.1 |

El árbol se resolvió y validó en el Hito 1.3; pnpm-lock.yaml real fija las transitivas. Hito 1.6 no añade dependencias: el bundle Scalar 1.44.23 se prepara como asset a partir del paquete oficial, comprobando integridad y conservando licencia/procedencia. La adquisición está bloqueada en esta sesión; el renderizado local permanece pendiente hasta contar con ese artefacto real. Para reproducibilidad binaria registrar también digests de imágenes durante release.

Fuentes primarias consultadas: [requisitos Prisma](https://docs.prisma.io/docs/orm/v6/reference/system-requirements), [Vite 7](https://vite.dev/blog/announcing-vite7), [métricas OpenTelemetry](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/metrics.md), [changelog OpenTelemetry](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/CHANGELOG.md). Prisma 6 admite Node 24 y Vite 7 admite Node 22.12 o superior. El build y las pruebas del árbol resuelto siguen siendo la validación decisiva.
