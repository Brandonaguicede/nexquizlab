# Validación de NexQuiz

Informes vigentes: [Hito 6](hito-6.md) (observabilidad, capacidad, producción), [Hito 5](hito-5.md) (resultados, cliente independiente, seed y scripts) y [Hito 4](hito-4.md): salas, partida en vivo, canal Socket.IO, reconexión, persistencia tras reinicio y comprobaciones obligatorias. [Hito 3](hito-3.md) cubre cuestionarios, preguntas e imágenes privadas. [Hito 2](hito-2.md) conserva la evidencia de autenticación y [Hito 1](hito-1.md) el historial de la plataforma y Scalar.

`pnpm verify`, `pnpm test:docs` y `pnpm test:e2e` mantienen la regresión existente. `pnpm test:identity` usa el stack real de NexQuiz en localhost:8080; no simula Auth ni Game. `pnpm test:identity:db` exige NEXQUIZ_TEST_DB_PORT explícito y usa PostgreSQL real. Los tests de identidad conservan sus usuarios sintéticos; no borran datos ni volúmenes. Los resultados generados permanecen ignorados por Git. No se realizó publicación externa.
