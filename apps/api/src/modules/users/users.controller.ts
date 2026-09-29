import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ChangePasswordSchema,
  UpdateUsernameSchema,
  type ChangePasswordInput,
  type UpdateUsernameInput,
} from '@carnia/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateUsername(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(UpdateUsernameSchema)) body: UpdateUsernameInput,
  ) {
    return this.users.updateUsername(user.userId, body.username);
  }

  /** Devuelve tokens nuevos: el resto de sesiones del usuario quedan revocadas. */
  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(ChangePasswordSchema)) body: ChangePasswordInput,
  ) {
    return this.users.changePassword(user.userId, body.currentPassword, body.newPassword);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.users.deleteAccount(user.userId);
  }

  @Get('me/stats')
  @UseGuards(JwtAuthGuard)
  getMyStats(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getStats(user.userId);
  }

  @Get('me/history')
  @UseGuards(JwtAuthGuard)
  getMyHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getHistory(user.userId);
  }

  /** Perfil público: no requiere autenticación. */
  @Get(':username/profile')
  async getPublicProfile(@Param('username') username: string) {
    const profile = await this.users.getPublicProfile(username);
    if (!profile) throw new NotFoundException({ code: 'user_not_found', message: 'Usuario no encontrado' });
    return profile;
  }
}
