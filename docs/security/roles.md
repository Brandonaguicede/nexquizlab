# Acceso por roles

Al registrarse se elige Profesor o Estudiante. El rol se guarda en Auth y viaja firmado en el JWT; Game verifica el rol, además de propiedad y participación.

- Profesor: administra cuestionarios e imágenes, crea y controla salas propias.
- Estudiante: entra con código, responde y consulta sus resultados.
- La navegación, la portada y las rutas protegidas muestran el espacio correspondiente.
- Para probar una partida se necesitan dos cuentas diferentes. Usar otro navegador o una ventana privada para el estudiante: las pestañas normales comparten la sesión.

La migración conserva las cuentas anteriores como Profesor para mantener el acceso a sus cuestionarios. Las cuentas nuevas tienen Estudiante como valor predeterminado si no se especifica rol. Las cuentas de demostración nuevas se crean con el rol correspondiente. Las cuentas de estudiante demo que ya existían deben reclasificarse explícitamente antes de usarlas como estudiantes; el seed no modifica cuentas existentes.

Después de actualizar los contenedores, recargar la web y volver a iniciar sesión para obtener el rol actualizado. Los tokens anteriores sin rol no permiten crear salas ni ingresar como estudiante.

El registro permite elegir Profesor; es una plataforma de registro abierto y no certifica la condición de docente de una institución.

## Verificación local — 1 de noviembre de 2026

- Migración de roles aplicada al PostgreSQL local de NexQuiz, sin borrar datos.
- Servicios auth-api, game-api y web reconstruidos y saludables en localhost:8080.
- 28 pruebas de Auth y 103 de Game aprobadas; siete pruebas que requieren una base desechable no ejecutadas.
- Compilación y lint aprobados.
- `node scripts/verify-roles.cjs`: partida real con dos contextos de navegador aislados (profesor 1440 px, estudiante 390 px), creación de cuestionario y sala, rechazo de creación por estudiante y de ingreso por profesor, respuesta vía interfaz y eventos en vivo, cierre, clasificación con un punto e aislamiento de rutas. Aprobado.
- Capturas locales: `test-results/roles-teacher.png` y `test-results/roles-student.png`.
- Se corrigió POSTGRES_PORT en la configuración local a 55432; 5432 está ocupado por otro servicio.
