import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RateLimiterService } from '../rate-limiter/rate-limiter.service';

interface RateLimitRule {
  bucket: string;
  limit: number;
  windowMs: number;
}

const RATE_LIMIT_KEY = 'carnia:rate_limit';

/** Limita peticiones HTTP por IP. Requiere `RateLimitGuard` en el controlador o ruta. */
export const RateLimit = (rule: RateLimitRule) => SetMetadata(RATE_LIMIT_KEY, rule);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiterService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const rule = this.reflector.getAllAndOverride<RateLimitRule | undefined>(RATE_LIMIT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!rule) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const result = await this.limiter.check({ ...rule, subject: req.ip ?? 'unknown' });
    if (result.allowed) return true;

    throw new HttpException(
      {
        code: 'rate_limited',
        message: `Demasiados intentos. Vuelve a probar en ${Math.ceil(result.resetMs / 1000)} s.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
