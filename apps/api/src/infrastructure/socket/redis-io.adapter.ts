import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { INestApplicationContext } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { Server, ServerOptions } from 'socket.io';
import { maskUrl } from '../redis/redis.service';

export class RedisIoAdapter extends IoAdapter {
  // `logger` ya existe en IoAdapter: nombre propio para no pisarlo.
  private readonly redisLogger = new Logger('RedisIoAdapter');
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(url: string): Promise<void> {
    const pubClient = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: null });
    const subClient = pubClient.duplicate();
    pubClient.on('error', (err) => this.redisLogger.error('pub error', err));
    subClient.on('error', (err) => this.redisLogger.error('sub error', err));
    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.redisLogger.log(`Connected Socket.IO Redis adapter → ${maskUrl(url)}`);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, options);
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}
