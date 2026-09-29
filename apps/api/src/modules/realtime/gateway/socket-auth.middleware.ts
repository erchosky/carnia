import { JwtService } from '@nestjs/jwt';
import type { TypedSocket } from './typed-socket';
import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  username: string;
}

export function buildSocketAuthMiddleware(jwt: JwtService, prisma: PrismaService) {
  return async (socket: TypedSocket, next: (err?: Error) => void): Promise<void> => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') as string | undefined);
      if (!token) return next(new Error('unauthorized'));

      const payload = await jwt.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, avatarUrl: true, level: true },
      });
      if (!user) return next(new Error('user_not_found'));

      socket.data.userId = user.id;
      socket.data.username = user.username;
      socket.data.avatarUrl = user.avatarUrl;
      socket.data.level = user.level;
      socket.data.joinedRoomId = null;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  };
}
