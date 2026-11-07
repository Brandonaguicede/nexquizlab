# Oracle Cloud Always Free — NexQuiz

Preparación: 1 de noviembre de 2026. No hay cuenta, VM ni despliegue público creados todavía. Las rutas de profesor y estudiante comparten una URL HTTPS y mantienen permisos diferentes.

## Recursos y costo

Crear una VM **VM.Standard.A1.Flex**, Ubuntu ARM64, **2 OCPU / 12 GB RAM**, en la región principal de la cuenta. Propuesta: disco de arranque de 100 GB, dentro de la cuota total compartida de 200 GB. Revisar los recursos que ya consume la cuenta y la estimación de Oracle antes de confirmar. No crear un PostgreSQL administrado, balanceador, NAT Gateway ni recursos adicionales de pago: todo el stack corre con Docker en la VM.

Oracle documenta actualmente 1.500 OCPU-horas y 9.000 GB-horas mensuales para A1 en cuentas Always Free. La disponibilidad depende de la región; puede no haber capacidad. Las instancias inactivas pueden recuperarse. Los créditos promocionales de 30 días no equivalen a Always Free. No se garantiza disponibilidad permanente ni costo cero si se exceden las cuotas.

Fuente: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

## Red y nombre público

1. Asignar IP pública a la VM, en una subred pública con ruta al Internet Gateway.
2. Permitir TCP 80 y 443 desde Internet en las reglas OCI y el firewall del sistema. UDP 443 es opcional para HTTP/3. Permitir SSH TCP 22 solo desde la IP del administrador.
3. Conservar las reglas SSH y del sistema que vienen con Ubuntu; no vaciar iptables ni desactivar el firewall. No publicar PostgreSQL (5432), APIs (3001/3002), Prometheus, Tempo ni Grafana.
4. Registrar un subdominio gratuito de DuckDNS y apuntarlo a la IP pública real. No publicar un registro AAAA sin configurar también IPv6. Si la IP cambia, actualizar DNS. No hace falta comprar un dominio.

DuckDNS documenta su servicio gratuito en https://www.duckdns.org/about.jsp. Caddy ya gestiona HTTPS y los WebSockets en el proyecto; necesita DNS correcto y los puertos 80/443 accesibles. No abrir el juego por HTTP: las cookies de producción requieren HTTPS.

## Preparar la VM

Entrar por SSH con la clave creada para la VM. No enviar la clave privada por chat ni subirla al repositorio. Instalar Git, Docker Engine y el plugin Compose v2 para Ubuntu ARM64 siguiendo https://docs.docker.com/engine/install/ubuntu/. Los comandos siguientes asumen que el usuario tiene acceso a Docker. No hace falta instalar Node ni PostgreSQL en el host.

Clonar el repositorio real en una carpeta nueva de la VM. Si aún no está publicado, primero hay que crear el remoto y subir las fuentes, excluyendo `.env*`, `secrets/`, `node_modules/`, imágenes y resultados de pruebas. No copiar la configuración de desarrollo al servidor.

Desde la raíz del repositorio en la VM:

```bash
# Sustituir por el nombre real que ya apunta a la IP de la VM.
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/work" -w /work \
  node:24.13.0-bookworm-slim node scripts/setup-oracle.cjs tu-subdominio.duckdns.org

bash scripts/deploy-oracle.sh
```

Usar el nombre real en minúsculas. El ejemplo es una instrucción, no un dominio provisionado. El generador crea `.env.oracle` y `secrets/oracle/` con credenciales nuevas; preserva `.env` y las claves locales. Se niega a sobrescribir un entorno Oracle existente. Los archivos de clave son legibles dentro de los contenedores; la carpeta privada del host limita su acceso.

El despliegue verifica configuración, construye las cuatro aplicaciones secuencialmente en ARM64 para reducir el pico de memoria, inicia PostgreSQL, aplica migraciones y levanta servicios con sus comprobaciones de salud. Reutiliza las imágenes construidas para los jobs de migración. No publica imágenes en un registro y no necesita cuenta Docker Hub. La primera construcción requiere Internet y puede tardar varios minutos.

El límite inicial de 50 participantes es una configuración a validar, no una capacidad acreditada en Oracle. Las cuentas demo se desactivan por defecto: registrar cuentas separadas de Profesor y Estudiante desde la web.

## Direcciones y comprobación

- Aplicación: `https://tu-subdominio.duckdns.org/`
- Estudiante: `/join`; profesor: `/quizzes` después de iniciar sesión.
- Cliente independiente: `/client/`.
- Scalar: `/auth/docs` y `/game/docs`.

Comprobar ambos endpoints desde fuera de la VM:

```bash
curl --fail https://tu-subdominio.duckdns.org/auth/api/v1/health/ready
curl --fail https://tu-subdominio.duckdns.org/game/api/v1/health/ready
```

Probar creación de cuestionario, pregunta con imagen, sala y código; entrar con una cuenta Estudiante en otro navegador o celular; responder, desconectar/reconectar, cerrar y consultar resultados en ambos clientes. Confirmar que Estudiante no puede crear cuestionarios o salas y que Profesor no participa en su propia sala.

Desde el equipo de desarrollo, con dependencias instaladas, ejecutar carga **solo sobre el servidor propio**, cuando no haya una clase activa:

```bash
BASE_URL=https://tu-subdominio.duckdns.org node scripts/load-test.mjs 10 30 50
```

Grafana queda en loopback. Acceder mediante `ssh -L 3000:localhost:3000 ubuntu@IP_PUBLICA` y abrir `http://localhost:3000`. Usar las credenciales de `.env.oracle`, que no se imprimen durante la instalación. No exponer el puerto 3000.

## Operación y respaldo

Usar siempre los dos archivos juntos; el archivo Oracle es un complemento, no un despliegue independiente:

```bash
docker compose --env-file .env.oracle -f docker-compose.prod.yml -f docker-compose.oracle.yml ps
docker compose --env-file .env.oracle -f docker-compose.prod.yml -f docker-compose.oracle.yml logs --tail=100
```

Prometheus conserva hasta siete días con límite de tamaño de 2 GB; Tempo conserva trazas 72 horas. Revisar `df -h` y `docker system df`; no ejecutar limpiezas de volúmenes. Las imágenes de compilación también consumen disco.

Antes de actualizar, ejecutar `bash scripts/backup-oracle.sh` en una ventana de mantenimiento: detiene brevemente ambas APIs, copia las dos bases, imágenes y configuración privada, y reinicia las APIs incluso si falla la copia. Solo una carpeta con `COMPLETE.txt` indica que terminó la copia; además hay que confirmar que ambas APIs estén saludables. Las copias contienen contraseñas y claves: cifrarlas y conservar una copia fuera de la VM en almacenamiento propio, con acceso restringido. Seguir el procedimiento general de restauración de [README.md](README.md) y ensayar en un entorno aparte, restaurando también imágenes y claves. Una copia solo dentro de la VM no protege frente a su pérdida.

Para actualizar: revisar los cambios, respaldar, actualizar fuentes y ejecutar `bash scripts/deploy-oracle.sh`. Hay interrupción durante recreación y migraciones; programarla fuera de partidas. No usar `down -v`. Volver a una imagen anterior no revierte migraciones: confirmar compatibilidad o restaurar desde una copia probada.

## Pendiente para dar el despliegue por terminado

Cuenta y capacidad Always Free, IP y DNS reales, construcción y ejecución nativas ARM64, certificado HTTPS, prueba en celulares, carga, respaldo/restauración y URL pública registrada en el README. Las validaciones locales de configuración no acreditan estos puntos.

## Validación de esta preparación

Comprobado localmente el 1 de noviembre de 2026:

- `pnpm verify:oracle`: generación aislada de secretos y entorno ARM64, rechazo de sobrescritura, claves RSA correspondientes y validación de producción; Compose combinado, imágenes compartidas por migraciones y puertos internos.
- Siete pruebas de tooling, Prisma y preparación Oracle aprobadas.
- Sintaxis Bash de despliegue y respaldo aprobada. El despliegue rechaza la máquina local x64 antes de iniciar acciones Docker.
- Manifiestos públicos de Node, PostgreSQL, nginx, Caddy, OpenTelemetry Collector, Tempo, Prometheus y Grafana incluyen `linux/arm64` para las versiones fijadas.
- Prueba de carga local con dos participantes aprobada, incluidos rechazo de sobrecupo y seis respuestas duplicadas sin puntaje doble. El script de carga ahora registra Profesor y Estudiante con sus roles correspondientes.

Esto valida la preparación; no sustituye una construcción ARM64 completa ni acredita ejecución, HTTPS, capacidad o restauración en una VM Oracle. El respaldo todavía requiere ensayo operativo en un destino aislado antes de depender de él.
