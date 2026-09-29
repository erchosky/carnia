import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { DailyDateSchema, DailySubmitSchema, type DailySubmitInput } from '@carnia/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { DailyService } from './daily.service';

@Controller('daily')
export class DailyController {
  constructor(private readonly daily: DailyService) {}

  /** Público: preguntas de hoy (sin respuestas). */
  @Get()
  getToday() {
    return this.daily.getToday();
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.daily.getStatus(user.userId);
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(DailySubmitSchema)) body: DailySubmitInput,
  ) {
    return this.daily.submit(user.userId, body.answers);
  }

  /** Público: clasificación de hoy o de la fecha indicada (AAAA-MM-DD). */
  @Get('leaderboard')
  getLeaderboard(@Query('date', new ZodValidationPipe(DailyDateSchema.optional())) date?: string) {
    return this.daily.getLeaderboard(date);
  }
}
