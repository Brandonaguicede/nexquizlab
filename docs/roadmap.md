# Plan de cierre del Proyecto 2

**Estado actualizado (31 de octubre de 2026):** Hitos 1 a 5 cerrados y archivados en OpenSpec. Del Hito 6 quedan solo las tareas que requieren credenciales y servidor del equipo: publicar en Docker Hub, desplegar en un VPS con URL pública, la prueba en ese destino y el historial de Git con PR por integrante. Ver [docs/testing/hito-6.md](testing/hito-6.md).

Estado original al planificar: Hitos 1 (base), 2 (autenticación) y 3 (cuestionarios e imágenes) cerrados y archivados en OpenSpec. Faltaba el núcleo del juego, la operación reproducible y el despliegue. Cada hito restante es un cambio OpenSpec y un Pull Request que incluye su carpeta archivada (`openspec archive`).

| Hito | Cambio OpenSpec | Resultado | Bloquea a |
| --- | --- | --- | --- |
| 0 | — | Repositorio con historial, remoto y flujo de PR | Todo |
| 4 | [hito-4-live-game](../openspec/changes/hito-4-live-game/proposal.md) | Sala, partida en vivo, respuestas, puntaje y resultados | 5, 6 |
| 5 | [hito-5-results-and-operations](../openspec/changes/hito-5-results-and-operations/proposal.md) | API de resultados, cliente adicional, seed y script de inicio | 6 |
| 6 | [hito-6-production](../openspec/changes/hito-6-production/proposal.md) | Docker Hub, VPS, trazas en Grafana, carga, evidencia y documentación final | Defensa |

## Hito 0: hacerlo hoy
1. Revisar `git status`: que no aparezcan `.env`, `secrets/`, `.cache/`, `.pnpm-store/`, `images/` ni `test-results/`.
2. Primer commit en `main`, crear el repositorio en GitHub y hacer push. Proteger `main` (solo entra por PR con CI verde).
3. Archivar `openspec/changes/hito-1` o documentar por qué queda abierto.
4. Corregir textos desactualizados: README ("No se implementan cuestionarios…"), Home ("las salas llegarán…") y el ER "de planificación" en `docs/database/README.md`.
5. Cada integrante configura su `git config user.name/user.email` local. Los aportes se demuestran con commits y PRs propios.

## Reparto sugerido (tres frentes en paralelo)
Ajustar nombres al equipo. Cada frente trabaja en su rama `hito-N/<tema>` y abre PR contra la rama del hito.

| Frente | Hito 4 | Hito 5 | Hito 6 |
| --- | --- | --- | --- |
| A — Dominio y datos | Máquina de estados, snapshot, migración, respuestas y puntaje | API de resultados e historial | Diagramas de clases y ER, especificación breve |
| B — Tiempo real e infraestructura | Gateway Socket.IO, proxy WebSocket, temporizador y reconexión | Seed por red y scripts de inicio y parada | Docker Hub, VPS, Tempo, prueba de carga |
| C — Web y pruebas | Pantallas de anfitrión, unirse, jugar y resultados | Cliente adicional | Playwright multi-dispositivo y evidencia |

Orden interno del Hito 4: primero A (contratos REST y dominio con pruebas unitarias), luego B y C en paralelo sobre esos contratos. Acordar los DTO y eventos del `design.md` antes de programar.

## Cobertura del enunciado
| Requisito | Dónde se cumple |
| --- | --- |
| Perfiles, nombre visible en el juego | Hito 2 + claim `name` (Hito 4) |
| CRUD de cuestionarios e imágenes | Hito 3 |
| Sala con código, lobby, inicio | Hito 4 · live-game |
| Pregunta en vivo, V/F, tiempo, avance del anfitrión | Hito 4 · live-game |
| Revelar respuesta, 1 punto por acierto, clasificación guardada | Hito 4 · live-game |
| REST de sesiones y resultados | Hitos 4 y 5 |
| Tiempo real documentado (eventos, autenticación, recuperación) | Hito 4 · `docs/api/realtime.md` |
| Auth separado, audiencia Game | Hito 2 |
| OpenAPI / Scalar por API | Hitos 1–5 (cada endpoint nuevo) |
| OpenTelemetry + Grafana por servicio | Hito 1 (métricas) + Hito 6 (trazas, métricas de juego) |
| Seed de usuario y quiz demo, script de inicio | Hito 5 |
| Docker Hub, VPS con URL | Hito 6 |
| Comprobaciones obligatorias y máximo de participantes | Hito 4 (pruebas) + Hito 6 (carga y evidencia) |
| Cliente adicional | Hito 5 |
| Especificación breve, diagramas, evidencia, aportes | Hito 6 + historial Git |

## Ensayo de la defensa (al final del Hito 6)
- Inicio local desde cero con `scripts/start.sh` en una máquina que solo tenga Git y Docker.
- Partida real en la URL pública con al menos 10 celulares, desconectando el Wi-Fi de uno a mitad de pregunta.
- Cliente adicional consultando los resultados de esa partida.
- Cada integrante explica su PR y responde: cómo llega una pregunta, dónde se valida la respuesta, cómo se evita el doble puntaje y cómo otro proyecto consume la API.
