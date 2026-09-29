import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QuestionCategorySchema, type QuestionCategory } from '@carnia/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { StudyService } from './study.service';

@Controller('study')
@UseGuards(JwtAuthGuard)
export class StudyController {
  constructor(private readonly study: StudyService) {}

  @Get('weak-spots')
  getWeakSpots(@CurrentUser() user: AuthenticatedUser) {
    return this.study.getWeakSpots(user.userId);
  }

  @Get('flashcards')
  getFlashcards(
    @Query('category', new ZodValidationPipe(QuestionCategorySchema.optional())) category?: QuestionCategory,
  ) {
    return this.study.getFlashcards(category);
  }
}
