import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis/redis.service';

export interface RateLimitOptions {
  /** Identificador único del bucket (ej: 'ws:answer', 'http:login') */
  bucket: string;
  /** Sujeto (userId, IP, socketId) */
  subject: string;
  /** Eventos permitidos en la ventana */
  limit: number;
  /** Ventana en ms */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * Sliding window rate limiter usando Redis sorted sets.
 *
 * Por cada evento, añade timestamp al ZSET y elimina los anteriores a (now - windowMs).
 * Si Redis no está disponible, deja pasar (fail-open) y loguea.
 *
 * Lua script atómico: garantiza que el contador y la inserción no se solapen
 * entre operaciones concurrentes del mismo subject.
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger('RateLimiter');

  // Script Lua cargado al primer uso, cacheado por SHA en Redis
  private static readonly LUA_SLIDING_WINDOW = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local windowMs = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local member = ARGV[4]

    -- limpia entradas viejas
    redis.call('ZREMRANGEBYSCORE', key, '-inf', now - windowMs)
    local count = redis.call('ZCARD', key)

    if count >= limit then
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      local resetMs = 0
      if oldest[2] then
        resetMs = (tonumber(oldest[2]) + windowMs) - now
      end
      return { 0, count, resetMs }
    end

    redis.call('ZADD', key, now, member)
    redis.call('PEXPIRE', key, windowMs)
    return { 1, count + 1, windowMs }
  `;

  constructor(private readonly redis: RedisService) {}

  async check(opts: RateLimitOptions): Promise<RateLimitResult> {
    const redis = this.redis.optional();
    if (!redis) {
      // fail-open: si no hay Redis, permitir pero loguear una vez
      return { allowed: true, remaining: opts.limit, resetMs: opts.windowMs };
    }

    const key = `rl:${opts.bucket}:${opts.subject}`;
    const now = Date.now();
    const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const result = (await redis.eval(
        RateLimiterService.LUA_SLIDING_WINDOW,
        1,
        key,
        now.toString(),
        opts.windowMs.toString(),
        opts.limit.toString(),
        member,
      )) as [number, number, number];

      return {
        allowed: result[0] === 1,
        remaining: Math.max(0, opts.limit - result[1]),
        resetMs: result[2],
      };
    } catch (err) {
      this.logger.warn(`rate limit redis error → fail-open: ${(err as Error).message}`);
      return { allowed: true, remaining: opts.limit, resetMs: opts.windowMs };
    }
  }
}
