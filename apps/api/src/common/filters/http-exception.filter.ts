import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
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
    } else if (exception instanceof Error) {
      message = exception.message;
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
