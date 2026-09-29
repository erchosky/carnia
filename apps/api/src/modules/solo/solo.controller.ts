import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  SoloAnswerSchema,
  SoloNextSchema,
  SoloStartSchema,
  type SoloAnswerInput,
  type SoloAnswerResponse,
  type SoloNextInput,
  type SoloRound,
  type SoloStartInput,
  type SoloStartResponse,
} from "@carnia/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod.pipe";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SoloService } from "./solo.service";

@Controller("solo")
@UseGuards(JwtAuthGuard)
export class SoloController {
  constructor(private readonly solo: SoloService) {}

  @Post("start")
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(SoloStartSchema)) body: SoloStartInput,
  ): Promise<SoloStartResponse> {
    return this.solo.start(user.userId, body);
  }

  @Post("next")
  next(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(SoloNextSchema)) body: SoloNextInput,
  ): Promise<SoloRound> {
    return this.solo.next(user.userId, body.sessionId);
  }

  @Post("answer")
  answer(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(SoloAnswerSchema)) body: SoloAnswerInput,
  ): Promise<SoloAnswerResponse> {
    return this.solo.answer(user.userId, body);
  }
}
