import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { Prisma, type User } from '@carnia/db';
import type {
  AuthResponse,
  AuthTokens,
  LoginInput,
  PublicUser,
  RegisterInput,
} from '@carnia/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const REFRESH_TTL_DAYS = 30;
const ACCESS_TTL_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: input.email, mode: 'insensitive' } },
          { username: { equals: input.username, mode: 'insensitive' } },
        ],
      },
    });
    if (existing) {
      throw existing.email.toLowerCase() === input.email ? emailTaken() : usernameTaken();
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          username: input.username,
          passwordHash,
          rankedStats: { create: {} },
        },
      });
    } catch (err) {
      // Dos registros simultáneos con el mismo email/username.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = String(err.meta?.target ?? '');
        throw target.includes('email') ? emailTaken() : usernameTaken();
      }
      throw err;
    }

    const tokens = await this.issueTokens(user);
    return { user: this.toPublicUser(user), tokens };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    // Emails antiguos pueden tener mayúsculas: la búsqueda no distingue.
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: input.email, mode: 'insensitive' } },
    });
    // Compara siempre para no revelar por tiempo de respuesta si el email existe.
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      throw new UnauthorizedException({ code: 'invalid_credentials', message: 'Credenciales inválidas' });
    }

    const tokens = await this.issueTokens(user);
    return { user: this.toPublicUser(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: 'refresh_invalid', message: 'Sesión expirada' });
    }

    if (stored.revokedAt) {
      // Reuse de token revocado → invalida toda la familia (posible robo)
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({ code: 'refresh_reused', message: 'Sesión revocada' });
    }

    // Rotación: revoca el actual y emite uno nuevo en la misma familia
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user, stored.family);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken
      .update({ where: { tokenHash }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.toPublicUser(user);
  }

  /** Revoca todos los refresh tokens del usuario (p. ej. tras cambiar la contraseña). */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async issueTokens(user: Pick<User, 'id' | 'email' | 'username'>, family?: string): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, username: user.username },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TTL_SECONDS },
    );

    const refreshRaw = randomBytes(64).toString('hex');
    const refreshHash = hashToken(refreshRaw);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshHash,
        family: family ?? randomBytes(16).toString('hex'),
        expiresAt,
      },
    });

    return { accessToken, refreshToken: refreshRaw, expiresIn: ACCESS_TTL_SECONDS };
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      xp: user.xp,
      level: user.level,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

/** Hash bcrypt válido que no corresponde a ninguna contraseña real. */
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.2Pz7rrV1QW0SrmHsJqr9J3y1bDSe';

function emailTaken() {
  return new ConflictException({ code: 'email_taken', message: 'Ese email ya está registrado' });
}

function usernameTaken() {
  return new ConflictException({ code: 'username_taken', message: 'Ese nombre de usuario ya está cogido' });
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
