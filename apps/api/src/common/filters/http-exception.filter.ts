import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

/**
 * Postgres error codes we can turn into a meaningful 4xx. Anything else stays a
 * 500 with a generic message — raw driver text (constraint names, column names,
 * "numeric field overflow") must never reach a client.
 */
const PG_ERROR_MAP: Record<string, { status: number; message: string }> = {
  '23505': { status: HttpStatus.CONFLICT, message: 'That record already exists.' },
  '23503': { status: HttpStatus.BAD_REQUEST, message: 'A referenced record does not exist.' },
  '23502': { status: HttpStatus.BAD_REQUEST, message: 'A required field is missing.' },
  '22003': { status: HttpStatus.BAD_REQUEST, message: 'A numeric value is out of the allowed range.' },
  '22P02': { status: HttpStatus.BAD_REQUEST, message: 'A value has the wrong format.' },
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let details: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;
        message = (body.message as any) || message;
        // class-validator errors put a string[] in `message` — keep that as `details` (existing shape).
        // A hand-thrown exception (e.g. `new ConflictException({ message, requiresForce, ... })`) carries
        // extra fields the caller needs; those used to be dropped on the floor, so pass the whole body
        // through as `details` whenever it's not the validation-array case.
        details = Array.isArray(body.message) ? null : body;
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
    } else {
      const pgCode = (exception as any)?.code;
      const mapped = typeof pgCode === 'string' ? PG_ERROR_MAP[pgCode] : undefined;

      if (mapped) {
        status = mapped.status;
        message = mapped.message;
      }

      // Always log the real error server-side; never return it.
      this.logger.error(
        exception instanceof Error ? `${exception.name}: ${exception.message}` : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      success: false,
      data: null,
      error: {
        code: status,
        message: Array.isArray(message) ? message[0] : message,
        details: Array.isArray(message) ? message : details,
      },
    });
  }
}
