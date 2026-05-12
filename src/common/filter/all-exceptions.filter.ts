import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let error =
      exception instanceof HttpException
        ? exception.name
        : 'Internal Server Error';

    if (payload) {
      if (typeof payload === 'string') {
        message = payload;
      } else if (typeof payload === 'object' && payload !== null) {
        const maybeMessage = (payload as { message?: string | string[] })
          .message;
        const maybeError = (payload as { error?: string }).error;

        if (Array.isArray(maybeMessage)) {
          message = maybeMessage.join('; ');
        } else if (typeof maybeMessage === 'string') {
          message = maybeMessage;
        }

        if (typeof maybeError === 'string') {
          error = maybeError;
        }
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} failed`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
