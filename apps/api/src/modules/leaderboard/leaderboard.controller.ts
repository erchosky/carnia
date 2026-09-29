import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  getTop(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') rawLimit?: string,
    @Query('seasonId') seasonId?: string,
  ) {
    const parsed = Number.parseInt(rawLimit ?? '', 10);
    const limit = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 50;
    return this.leaderboard.getLeaderboard({
      seasonId,
      userId: user.userId,
      limit,
    });
  }
}
