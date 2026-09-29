import { Module, RequestMethod } from "@nestjs/common";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";
import type { IncomingMessage, ServerResponse } from "http";

const isDev = process.env.NODE_ENV !== "production";

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      // Nest 11 / path-to-regexp v8 requires a named wildcard.
      forRoutes: [{ path: "{*path}", method: RequestMethod.ALL }],
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
        transport: isDev
          ? {
              target: "pino-pretty",
              options: {
                singleLine: true,
                colorize: true,
                translateTime: "HH:MM:ss.l",
                ignore: "pid,hostname,req,res,responseTime",
                messageFormat: "{context} {msg}",
              },
            }
          : undefined,
        autoLogging: {
          ignore: (req: IncomingMessage) => req.url === "/api/health",
        },
        customSuccessMessage: (
          req: IncomingMessage,
          res: ServerResponse,
          responseTime: number,
        ) => `${req.method} ${req.url} → ${res.statusCode} (${responseTime}ms)`,
        customErrorMessage: (
          req: IncomingMessage,
          res: ServerResponse,
          err: Error,
        ) => `${req.method} ${req.url} → ${res.statusCode} ${err.message}`,
        // PII scrubbing
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "*.password",
            "*.passwordHash",
            "*.refreshToken",
            "*.accessToken",
          ],
          remove: true,
        },
        // Base de cada log: incluye env + pid + version
        base: {
          env: process.env.NODE_ENV ?? "development",
          service: "carnia-api",
        },
      },
    }),
  ],
})
export class LoggerModule {}
