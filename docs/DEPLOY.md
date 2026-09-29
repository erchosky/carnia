# Deploy en producción

Hay dos targets soportados:
- **Vercel** para el frontend (`apps/web`).
- **Railway** o **Fly.io** para el backend + Postgres + Redis (`apps/api`).

## Variables de entorno productivas

### API (Railway/Fly)

| Variable | Ejemplo | Notas |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host/db?pgbouncer=true` | URL del pooler |
| `DIRECT_URL` | `postgresql://user:pass@host/db` | URL directa (para `migrate deploy`) |
| `REDIS_URL` | `redis://default:pass@host:6379` | Para adapter + leaderboard + rate limit |
| `JWT_ACCESS_SECRET` | (64 hex chars) | `openssl rand -hex 64` |
| `WEB_URL` | `https://carnia.app` | Origen permitido en CORS |
| `TRUST_PROXY` | `1` | Saltos de proxy de confianza; necesario para que el rate limit HTTP vea la IP real |
| `NODE_ENV` | `production` | Activa logs JSON sin pretty |
| `LOG_LEVEL` | `info` | `debug` solo para diagnóstico |

### Web (Vercel)

| Variable | Ejemplo |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.carnia.app` |
| `NEXT_PUBLIC_WS_URL` | `wss://api.carnia.app` |

## Generar secretos

```bash
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 64)"
```

Los refresh tokens son valores aleatorios opacos guardados con hash en la base de datos, así que no necesitan secreto propio.

## Deploy en Railway (recomendado para empezar)

1. **Crear proyecto** en Railway → conectar GitHub repo.
2. **Servicios Postgres + Redis**: usar los managed de Railway (un click).
3. **Servicio API**: deploy desde repo. En *Settings → Config-as-code* apunta a `apps/api/railway.toml`, que usa `apps/api/Dockerfile`.
4. **Variables**: copiar todas las de arriba en el dashboard del servicio API.
5. **Migraciones**: Railway aún no soporta `release_command` natively. Opciones:
   - **Manual la primera vez**: `railway run --service=api pnpm --filter @carnia/db exec prisma migrate deploy`
   - **En CMD del Dockerfile**: editar el `CMD` para encadenar la migración (más simple pero menos elegante).
6. **Networking**: Railway expone HTTPS + WSS automáticamente. Copiar la URL pública.
7. **Frontend (Vercel)**: deploy `apps/web` con `NEXT_PUBLIC_API_URL` apuntando al dominio de Railway.

## Deploy en Fly.io

1. **Instalar CLI**: `brew install flyctl` (mac) / `iwr https://fly.io/install.ps1 | iex` (win).
2. **Login**: `fly auth login`.
3. **Postgres**: `fly postgres create --name carnia-db --region mad` → te da `DATABASE_URL`.
4. **Redis (Upstash)**: `fly redis create --name carnia-redis` → te da `REDIS_URL`.
5. **App API**:
   ```bash
   cd apps/api
   fly launch --no-deploy   # Reusa fly.toml
   fly secrets set DATABASE_URL=... DIRECT_URL=... REDIS_URL=... \
                   JWT_ACCESS_SECRET=... TRUST_PROXY=1 \
                   WEB_URL=https://carnia.app
   fly deploy
   ```
   El `release_command` en `fly.toml` corre `prisma migrate deploy` automáticamente antes de arrancar instancias.
6. **Frontend (Vercel)**: igual que con Railway.

## Postgres en producción

- **Activa connection pooling**: Neon/Railway/Supabase lo dan en `DATABASE_URL`; `DIRECT_URL` apunta al non-pooled (para migrate).
- **No conectes directo desde múltiples instancias de API sin pooler** — Prisma abre conexiones agresivamente y agotas la cuota.

## Redis en producción

- **Upstash** funciona con `socket.io` adapter (TCP, no REST API).
- Si usas el plan free, vigila el límite de conexiones simultáneas — cada instancia abre 2 (pub + sub) + 1 por el leaderboard.

## Vercel: detalles del frontend

El `vercel.json` ya está configurado para:
- Detectar el monorepo (root directory = `apps/web`).
- Build via Turbo desde la raíz (caché compartida).
- Headers de seguridad básicos (X-Frame-Options, X-Content-Type-Options, Referrer-Policy).

**Project Settings → Root Directory**: `apps/web`.
**Project Settings → Framework Preset**: Next.js (auto-detecta).
**Project Settings → Build Command**: déjalo vacío (lo coge de `vercel.json`).

## Smoke test post-deploy

```bash
# Liveness
curl https://api.carnia.app/api/health/live
# → { "status": "ok" }

# Readiness — verifica Postgres + Redis
curl https://api.carnia.app/api/health/ready
# → { "status": "ok", "checks": { "postgres": "ok", "redis": "ok" }, ... }

# Auth registro
curl -X POST https://api.carnia.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"smoke","password":"smoketest1"}'
```

Luego desde el frontend: regístrate, crea una sala PvP, abre el código en otro navegador, juega una partida.

## Rollback

- **Vercel**: rollback de un click al deploy anterior desde el dashboard.
- **Railway**: rollback al deploy anterior desde el dashboard.
- **Fly**: `fly releases` para ver el historial, `fly releases rollback <version>`.
- **Postgres**: las migraciones son forward-only por defecto. Para rollback de schema:
  1. Genera la migración de undo manualmente en `packages/db/prisma/migrations/...`.
  2. `prisma migrate deploy` aplicará la nueva migración.

## Monitorización

- **Logs**: los JSON estructurados de Pino los puedes ingestar en Datadog/Logtail/Better Stack apuntando al stdout del container.
- **Alertas mínimas**:
  - `severity=high` en logs con tag `anti_cheat` → posible bot.
  - `checks.redis=down` en readiness más de 1 min → degradación.
  - Latencia P95 de `/api/auth/login` > 500ms → algo va mal.
