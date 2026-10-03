# CarnIA

El teórico del carné, pero con partidas, retos y piques. CarnIA sirve para practicar las preguntas de la DGT del permiso B: puedes ir a tu bola, repasar lo que más fallas o jugar un 1 contra 1 en tiempo real.

La idea es que estudiar señales y prioridades dé un poco menos de pereza. Si vas a fallar una pregunta, por lo menos que te explique por qué.

## Qué trae

- **Solo**: 10 preguntas cronometradas por categoría o mezcladas, puntuación por velocidad, explicación tras cada respuesta y XP. Incluye *Modo Trampa* (solo preguntas engañosas).
- **PvP 1v1 en tiempo real**: sala privada por código o emparejamiento aleatorio, modos Clásico, Supervivencia (3 vidas) y Blitz, rondas/tiempo/categorías configurables, ELO, revancha y reconexión.
- **Reto diario**: las mismas 10 preguntas para todos, clasificación del día y racha.
- **Estudio**: repaso de tus preguntas más falladas y flashcards por categoría.
- **Progresión**: niveles por XP, ranking por temporada, logros y perfiles públicos.
- **Reglas rápidas**: mnemotecnias para lo más preguntado.

## Qué hay por dentro

Monorepo **pnpm 10 + Turborepo**, TypeScript 6 en todo el código:

```text
apps/web                   Next.js 16 (App Router), React 19, Tailwind CSS 4, Zustand 5, TanStack Query
apps/api                   NestJS 12: REST + Socket.IO, JWT access/refresh, logs Pino
packages/contracts         Esquemas Zod 4, tipos y constantes compartidos por web y API
packages/db                Esquema Prisma 7, cliente generado, migraciones y seed (220 preguntas)
packages/config-typescript Configuración TypeScript base
docs/                      Despliegue e historial de auditoría
```

- **Datos**: PostgreSQL 16 vía Prisma 7 (driver adapter `pg`). **Redis 7** (opcional en local) para el adapter de Socket.IO, el ranking y el rate limiting.
- **El servidor manda en el PvP**: valida respuestas, mide tiempos y calcula puntuación y ganador. Las reglas del juego son funciones puras (`apps/api/src/modules/game/engine`) con tests; el orquestador en tiempo real (`modules/realtime`) solo coordina timers, sockets y persistencia.
- **Contratos compartidos**: web y API importan los mismos esquemas y tipos de `@carnia/contracts`, así que un cambio de payload rompe la compilación en ambos lados.

## Cómo arrancarlo

Requisitos: **Node.js 24** (`.nvmrc`; mínimo 22.12), Corepack (incluido en Node) y Docker (o PostgreSQL/Redis propios).

1. Instala las dependencias. Corepack usa automáticamente la versión de pnpm fijada en `package.json`, y la instalación genera el cliente de Prisma:

```bash
corepack enable
pnpm install --frozen-lockfile
```

2. Crea los archivos de configuración a partir de los ejemplos, levanta las bases de datos, aplica las migraciones, carga las preguntas y arranca:

```bash

cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

docker compose up -d          # PostgreSQL en :5433 y Redis en :6379
pnpm --filter @carnia/db migrate:deploy
pnpm db:seed                  # idempotente: se puede repetir
pnpm dev
```

pnpm 10 no ejecuta los scripts de instalación de dependencias salvo que se autoricen; los que CarnIA no necesita (Prisma engines, esbuild…) están listados en `pnpm-workspace.yaml` para que no aparezca el aviso.

Web en <http://localhost:3000>, API en <http://localhost:3001/api> (health: `/api/health/live` y `/api/health/ready`).

El seed crea dos cuentas **solo para desarrollo local**: `demo1@carnia.app` y `demo2@carnia.app`, contraseña `carnia123`. Para probar PvP, entra con una en cada navegador (o ventana privada).

## Variables de entorno

| Variable              | Servicio | Obligatoria    | Propósito                                                   |
| --------------------- | -------- | -------------- | ----------------------------------------------------------- |
| `DATABASE_URL`        | DB/API   | Sí             | Conexión de Prisma a PostgreSQL                             |
| `DIRECT_URL`          | DB       | No             | Conexión directa (sin pooler) para migraciones; si falta se usa `DATABASE_URL` |
| `JWT_ACCESS_SECRET`   | API      | Sí             | Firma de los access tokens (`openssl rand -hex 64`)         |
| `WEB_URL`             | API      | Sí en prod.    | Origen permitido por CORS                                   |
| `REDIS_URL`           | API      | Recomendada    | Socket.IO multi-nodo, ranking y rate limiting               |
| `API_PORT` / `PORT`   | API      | No             | Puerto (por defecto `3001`)                                 |
| `TRUST_PROXY`         | API      | Detrás de proxy | Saltos de proxy de confianza, para que el rate limit vea la IP real |
| `LOG_LEVEL`           | API      | No             | Nivel de log de Pino                                        |
| `NEXT_PUBLIC_API_URL` | Web      | Sí             | URL pública de la API                                       |
| `NEXT_PUBLIC_WS_URL`  | Web      | Sí             | URL pública de Socket.IO (`wss://` en producción)           |

Los refresh tokens son valores aleatorios opacos guardados con hash (con rotación y detección de reutilización), por eso no hay secreto de refresh.

## Comandos

```bash
pnpm dev           # API y web en modo desarrollo
pnpm build         # build de todos los paquetes
pnpm typecheck     # TypeScript en todo el monorepo
pnpm lint          # ESLint (web)
pnpm test          # tests (Vitest, API)
pnpm db:seed       # seed idempotente
pnpm db:studio     # Prisma Studio
```

La integración continua (`.github/workflows/ci.yml`) ejecuta instalación bloqueada, tipos, lint, tests y build en cada push y pull request.

## Seguridad

- Contraseñas con bcrypt; refresh tokens rotativos (reutilizar uno revocado invalida toda la familia).
- Rate limiting por IP en registro, login y refresh, y por usuario en los eventos Socket.IO (requiere Redis; sin Redis se permite el tráfico).
- Cambiar la contraseña cierra el resto de sesiones.
- Borrar la cuenta elimina perfil, logros, ranking y partidas solo; las partidas contra otros jugadores se conservan anonimizadas para no romper el historial del rival.

## Despliegue

La web está preparada para Vercel (`apps/web/vercel.json`) y la API para Railway o Fly.io con el Dockerfile multi-stage de `apps/api`. Ver [`docs/DEPLOY.md`](docs/DEPLOY.md).

Antes de exponerla públicamente: secretos reales, URLs HTTPS/WSS, `TRUST_PROXY`, `prisma migrate deploy`, borrar o cambiar las cuentas demo y configurar backups de PostgreSQL.

## Cosas que todavía tienen sus peros

- Las salas PvP y las sesiones Solo viven en memoria del proceso: escalar la API a varias instancias requiere afinidad de sesión o mover ese estado a Redis.
- Los tokens del cliente se guardan en `localStorage`; migrar a cookies `HttpOnly` reduciría el impacto de un XSS.
- La API, `contracts` y `db` no tienen ESLint propio (sí comprobación de tipos estricta).
- No hay suite E2E versionada.

Historial de cambios en [`CHANGELOG.md`](CHANGELOG.md).
