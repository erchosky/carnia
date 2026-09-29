// Debe ser el primer import: varios módulos leen process.env al cargarse.
import './load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoNestLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './infrastructure/socket/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoNestLogger));
  app.flushLogs();

  app.setGlobalPrefix('api');
  // La validación de entrada se hace con Zod (ZodValidationPipe) en cada endpoint.

  // Sin WEB_URL en producción todas las peticiones del navegador fallarían por CORS.
  const webUrl = process.env.WEB_URL;
  if (process.env.NODE_ENV === 'production') {
    for (const name of ['WEB_URL', 'JWT_ACCESS_SECRET', 'DATABASE_URL']) {
      if (!process.env[name]) throw new Error(`${name} env var is required in production.`);
    }
  }

  // Detrás de un proxy (Railway, Fly, Nginx…) hace falta para que req.ip sea la IP real
  // del cliente y el rate limit HTTP funcione. Ej.: TRUST_PROXY=1
  if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.getHttpAdapter().getInstance().set('trust proxy', Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
  }
  app.enableCors({
    origin: [webUrl ?? 'http://localhost:3000'],
    credentials: false,
  });

  // Socket.IO con Redis adapter (preparado para multi-nodo)
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const ioAdapter = new RedisIoAdapter(app);
    await ioAdapter.connectToRedis(redisUrl);
    app.useWebSocketAdapter(ioAdapter);
  }

  // Graceful shutdown — los containers (Railway/Fly) mandan SIGTERM
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port);
  const logger = app.get(PinoNestLogger);
  logger.log(`🚀 CarnIA API running on http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
