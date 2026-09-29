import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { QuestionsModule } from '../questions/questions.module';
import { UsersModule } from '../users/users.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { AntiCheatModule } from '../anti-cheat/anti-cheat.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { MatchGateway } from './gateway/match.gateway';
import { MatchOrchestratorService } from './orchestrator/match-orchestrator.service';
import { MatchmakingService } from './orchestrator/matchmaking.service';
import { MatchFinalizerService } from './orchestrator/match-finalizer.service';
import { RoomStore } from './orchestrator/room-store';

@Module({
  imports: [
    AuthModule,
    QuestionsModule,
    UsersModule,
    LeaderboardModule,
    AntiCheatModule,
    AchievementsModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [MatchGateway, MatchOrchestratorService, MatchFinalizerService, MatchmakingService, RoomStore],
})
export class RealtimeModule {}
