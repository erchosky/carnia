import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { SoloModule } from './modules/solo/solo.module';
import { HealthModule } from './modules/health/health.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { DailyModule } from './modules/daily/daily.module';
import { StudyModule } from './modules/study/study.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { RateLimiterModule } from './common/rate-limiter/rate-limiter.module';
import { LoggerModule } from './common/logging/logger.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    LoggerModule,
    PrismaModule,
    RedisModule,
    RateLimiterModule,
    AuthModule,
    UsersModule,
    QuestionsModule,
    SoloModule,
    RealtimeModule,
    LeaderboardModule,
    DailyModule,
    StudyModule,
    AchievementsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
