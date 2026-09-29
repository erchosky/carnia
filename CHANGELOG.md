# Changelog

## 2026-09-29 — Actualización de plataforma

### Actualizado

- Node.js 20 → **24 LTS** (`.nvmrc`, `engines`, Dockerfile y CI); pnpm 9 → **10**; Turborepo 2.11; TypeScript 5 → **6**.
- Web: Next.js 15 → **16**, React 19.3, Tailwind CSS 3 → **4** (tema en `globals.css` con `@theme`), ESLint 8 → **9** con configuración plana, Zustand 5, tailwind-merge 3.
- API: NestJS 11 → **12**, nestjs-pino 5 / Pino 10, bcryptjs 3, ioredis 6, Vitest 5.
- Datos: Prisma 5 → **7** con el generador `prisma-client`, driver adapter `pg` y `prisma.config.ts`. El cliente se genera en `packages/db/src/generated` (ignorado por git) y se regenera en `postinstall`.
- Contratos: Zod 3 → **4**, con mensajes de error por defecto en español.
- Lockfile regenerado desde cero: `pnpm audit` sin vulnerabilidades (overrides para `mysql2` y `deepmerge-ts`, transitivas del CLI de Prisma).

### Cambiado

- `dotenv` sustituido por `process.loadEnvFile()` nativo de Node; `nanoid` por `crypto.randomBytes`.
- `DIRECT_URL` se usa ya de verdad para las migraciones (antes estaba documentada pero el esquema no la leía).
- Hooks de React adaptados a las nuevas reglas: `useEffectEvent` en la cuenta atrás, `useSyncExternalStore` para el socket compartido y refs actualizadas en efectos.
- Dockerfile: la imagen incluye `prisma.config.ts` para `migrate deploy` y ya no regenera el cliente en producción; `fly.toml` usa `--config`.

## 2026-09-28 — Revisión de bugs, limpieza y refactor

### Bugs corregidos

**PvP (API)**
- La **revancha nunca arrancaba**: `Match.roomId` es único y la revancha reutiliza la sala, así que crear el segundo match violaba la restricción. Ahora se desvincula el match anterior en la misma transacción.
- Al cerrar una sala sin match, `clearTimers("question:")` cancelaba los temporizadores de **todas las partidas en curso del servidor**. Los timers pasan a un `TimerRegistry` con claves exactas.
- Si un jugador salía durante la cuenta atrás, el match arrancaba igualmente con un solo jugador. Ahora la sala vuelve a LOBBY.
- Supervivencia: un jugador que se quedaba sin vidas por *timeout* seguía jugando; y la eliminación por fallo cerraba el match sin revelar la ronda ni guardar sus respuestas. El motor decide ahora el final (gana quien conserva vidas) y el flujo pasa siempre por el reveal.
- El ELO se mostraba al terminar pero **no se guardaba** si no había temporada activa.
- `questionCount` del match era siempre 10 aunque la sala tuviera 5, 15 o 20 rondas.
- Si fallaba la persistencia al terminar, los jugadores se quedaban esperando `match:end` para siempre.
- Las salas en las que todos se desconectaban (o que terminaban sin revancha) no se liberaban nunca, y el usuario no podía crear otra sala sin pulsar "Salir".
- El resync no enviaba vidas ni el reveal en curso, ni el resultado si el match ya había terminado.

**PvP (web)**
- Tras una revancha, las respuestas se enviaban con el `matchId` de la URL (el match anterior) y eran rechazadas.
- El socket no se desconectaba al cerrar sesión: el siguiente usuario del navegador seguía autenticado en tiempo real como el anterior.
- `usePvpSocket` devolvía un ref, así que la primera renderización veía `socket = null` y el resync inicial podía no enviarse.
- La frase del resultado cambiaba cuatro veces por segundo (se recalculaba en cada render del contador de revancha); el marcador mostraba siempre `x/10`; "No, gracias" no abandonaba la sala.
- El error de `?join_error=` al fallar un enlace de invitación nunca se mostraba.

**Solo**
- El cronómetro de la siguiente pregunta empezaba en el servidor mientras el usuario leía la explicación: tras leer ~15 s, la respuesta contaba como *timeout*. Ahora la siguiente pregunta se pide con `POST /solo/next`, que es cuando empieza a contar.
- Dos peticiones simultáneas a la misma ronda podían puntuar dos veces (y la segunda fallaba con 500 por la restricción única).
- Las sesiones abandonadas se quedaban en memoria para siempre y sus matches en `IN_PROGRESS`; ahora caducan a los 30 minutos.
- Un error de red al responder dejaba la partida bloqueada sin mensaje.

**Resto**
- **Borrar la cuenta fallaba siempre** que el usuario hubiera jugado (claves foráneas sin `onDelete`). Ahora se borra todo lo personal; si hay historial PvP, la fila se anonimiza para no romper el historial del rival.
- Las flashcards de una categoría devolvían **todas** las preguntas (se "completaban" con el resto del banco).
- El selector de Estudio solo ofrecía 13 de las 20 categorías.
- La precisión de estadísticas y perfil asumía 10 preguntas por partida; el % de victorias del perfil dividía entre partidas totales (incluidas las de Solo), y las partidas Solo aparecían como "Victoria".
- Racha diaria: usaba la zona horaria del servidor y se mostraba a 0 si aún no habías jugado hoy.
- Reto diario: dos peticiones simultáneas a medianoche podían fallar al crearlo; un doble envío devolvía 500.
- `limit` no numérico en el ranking rompía la petición; sin temporada activa, el ranking devolvía 500.
- Login/registro distinguían mayúsculas en el email (se podía registrar el mismo email dos veces).
- La URL de Redis (con contraseña) se escribía en claro en los logs del adapter de Socket.IO.
- El viewport bloqueaba el zoom (accesibilidad).
- Contenido: la regla "semáforo averiado = STOP" era incorrecta; se corrige (mandan las señales verticales y, si no hay, la prioridad de la derecha).

### Seguridad
- Rate limiting HTTP por IP en registro, login y refresh (`RateLimitGuard`), con `TRUST_PROXY` para despliegues detrás de proxy.
- Cambiar la contraseña revoca el resto de sesiones y devuelve tokens nuevos.
- El login compara siempre contra un hash para no revelar por tiempo si un email existe.
- Arranque en producción falla pronto si faltan `WEB_URL`, `JWT_ACCESS_SECRET` o `DATABASE_URL`.

### Refactor y código muerto
- `match-orchestrator.service.ts` (1015 líneas) dividido en orquestador, `MatchFinalizerService` (persistencia, ELO, XP, logros), `TimerRegistry` y serializadores.
- Páginas grandes del frontend divididas en componentes de `features/` (hub PvP, reto diario, estudio, reglas rápidas). Componentes de pregunta, opciones y panel de resultado compartidos entre Solo, PvP, reto diario y estudio.
- Contratos compartidos para respuestas de la API (stats, perfil, daily, estudio, logros) en lugar de interfaces duplicadas en la web; definiciones de logros unificadas en `@carnia/contracts`.
- Eliminado: `ValidationPipe` de class-validator (no había DTOs) y sus dependencias, `ts-node`, `tsconfig-paths`, `@nestjs/testing`, `score-calculator` duplicado, `checkTimeoutNeeded`, `RoomStore.update`, `RedisService.required`, `QuestionsService.invalidate`, `achievement-toast`, `achievement-data` duplicado, acciones de store sin uso, evento `match:elimination` sin consumidor, scripts `lint` que solo hacían `echo`, `railway.toml` duplicado en la raíz.
- Variables de entorno documentadas que el código no usaba (`JWT_REFRESH_SECRET`, `JWT_*_TTL`) retiradas de los ejemplos.

### Tests y CI
- De 28 a 46 tests unitarios (Supervivencia, validaciones del motor, rachas diarias, `TimerRegistry`).
- Workflow de GitHub Actions: instalación bloqueada, tipos, lint, tests y build.
