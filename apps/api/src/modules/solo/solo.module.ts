import { Module } from '@nestjs/common';
import { QuestionsModule } from '../questions/questions.module';
import { UsersModule } from '../users/users.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { SoloController } from './solo.controller';
import { SoloService } from './solo.service';

@Module({
  imports: [QuestionsModule, UsersModule, AchievementsModule],
  controllers: [SoloController],
  providers: [SoloService],
})
export class SoloModule {}
