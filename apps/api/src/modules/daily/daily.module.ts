import { Module } from '@nestjs/common';
import { DailyController } from './daily.controller';
import { DailyService } from './daily.service';
import { QuestionsModule } from '../questions/questions.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [QuestionsModule, AchievementsModule],
  controllers: [DailyController],
  providers: [DailyService],
  exports: [DailyService],
})
export class DailyModule {}
