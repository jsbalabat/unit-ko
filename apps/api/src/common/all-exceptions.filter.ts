import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

// One place that turns any thrown error into a consistent JSON shape. Known
// HttpExceptions keep their status/body; anything else is logged in full and
// returned as a generic 500 so we never leak internals (DB errors, stack
// traces) to the client.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Http");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    // Supabase/Postgrest errors are plain objects, not Error instances, so
    // String(exception) would log "[object Object]". Serialize them instead so
    // the real message/code/details/hint are visible in the server log.
    let detail: string;
    if (exception instanceof Error) {
      detail = exception.stack ?? exception.message;
    } else {
      try {
        detail = JSON.stringify(exception);
      } catch {
        detail = String(exception);
      }
    }
    this.logger.error(`Unhandled error on ${req.method} ${req.url}`, detail);

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
}
