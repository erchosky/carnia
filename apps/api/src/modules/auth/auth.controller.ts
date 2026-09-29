import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  LoginSchema,
  RefreshSchema,
  RegisterSchema,
  type AuthResponse,
  type AuthTokens,
  type LoginInput,
  type PublicUser,
  type RefreshInput,
  type RegisterInput,
} from "@carnia/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod.pipe";
import {
  CurrentUser,
  type AuthenticatedUser,
} from "../../common/decorators/current-user.decorator";
import { RateLimit, RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

const MINUTE = 60_000;

@Controller("auth")
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @RateLimit({ bucket: "http:register", limit: 5, windowMs: 10 * MINUTE })
  register(
    @Body(new ZodValidationPipe(RegisterSchema)) body: RegisterInput,
  ): Promise<AuthResponse> {
    return this.auth.register(body);
  }

  @Post("login")
  @HttpCode(200)
  @RateLimit({ bucket: "http:login", limit: 10, windowMs: 5 * MINUTE })
  login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
  ): Promise<AuthResponse> {
    return this.auth.login(body);
  }

  @Post("refresh")
  @HttpCode(200)
  @RateLimit({ bucket: "http:refresh", limit: 30, windowMs: 5 * MINUTE })
  refresh(
    @Body(new ZodValidationPipe(RefreshSchema)) body: RefreshInput,
  ): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(RefreshSchema)) body: RefreshInput,
  ): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    return this.auth.me(user.userId);
  }
}
