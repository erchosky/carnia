import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables del entorno (CI, Docker, plataforma de despliegue).
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Las migraciones usan la conexión directa (sin pooler) si existe.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
