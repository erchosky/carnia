import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export * from './generated/prisma/client';

type LogLevel = 'query' | 'info' | 'warn' | 'error';

/** Crea un cliente conectado a `DATABASE_URL` mediante el driver `pg`. */
export function createPrismaAdapter(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL no está configurada.');
  }
  return new PrismaPg({ connectionString });
}

export function createPrismaClient(log: LogLevel[] = defaultLogLevels()) {
  return new PrismaClient({ adapter: createPrismaAdapter(), log });
}

export function defaultLogLevels(): LogLevel[] {
  return process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'];
}
