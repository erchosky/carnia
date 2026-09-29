import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpException");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res
        .status(status)
        .json(
          typeof body === "string"
            ? { code: "http_error", message: body }
            : body,
        );
      return;
    }

    const stack =
      exception instanceof Error ? exception.stack : String(exception);
    this.logger.error("Unhandled exception", stack);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: "internal_error",
      message: "Algo ha ido mal. Inténtalo de nuevo.",
    });
  }
}
