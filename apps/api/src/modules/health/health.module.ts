import { Controller, Get, HttpStatus, Module, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

interface HealthCheck {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  version: string;
  checks: {
    postgres: 'ok' | 'down';
    redis: 'ok' | 'down' | 'disabled';
  };
}

const START_TIME = Date.now();

@Controller('health')
class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness — el proceso responde. K8s/Railway lo usan para reiniciar. */
  @Get('live')
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness — el proceso puede atender tráfico (DB/Redis OK). */
  @Get('ready')
  async readiness(@Res() res: Response): Promise<void> {
    const result = await this.runChecks();
    const code =
      result.status === 'ok'
        ? HttpStatus.OK
        : result.status === 'degraded'
          ? HttpStatus.OK // degraded sigue respondiendo
          : HttpStatus.SERVICE_UNAVAILABLE;
    res.status(code).json(result);
  }

  /** Endpoint general (compat). */
  @Get()
  async health(@Res() res: Response): Promise<void> {
    const result = await this.runChecks();
    res.status(HttpStatus.OK).json(result);
  }

  private async runChecks(): Promise<HealthCheck> {
    const checks: HealthCheck['checks'] = {
      postgres: 'down',
      redis: 'disabled',
    };

    // Postgres
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.postgres = 'ok';
    } catch {
      checks.postgres = 'down';
    }

    // Redis
    const client = this.redis.optional();
    if (client) {
      try {
        await client.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'down';
      }
    }

    const status: HealthCheck['status'] =
      checks.postgres === 'down'
        ? 'down'
        : checks.redis === 'down'
          ? 'degraded'
          : 'ok';

    return {
      status,
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      version: process.env.npm_package_version ?? '0.0.0',
      checks,
    };
  }
}

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
