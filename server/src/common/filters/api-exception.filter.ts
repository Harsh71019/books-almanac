import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { ZodValidationException } from 'nestjs-zod';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ApiExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const code = this.codeFor(status);
    const message = this.messageFor(exception, status);

    if (status >= 500) {
      this.logger.error(
        { err: exception, path: request.url, method: request.method, status },
        'Unhandled API exception'
      );
    }

    response.status(status).json({
      error: {
        code,
        message
      }
    });
  }

  private messageFor(exception: unknown, status: number): string {
    if (exception instanceof ZodValidationException) {
      return 'Request validation failed';
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') return response;
      if (typeof response === 'object' && response && 'message' in response) {
        const message = (response as { message: string | string[] }).message;
        return Array.isArray(message) ? message.join(', ') : message;
      }
      return exception.message;
    }

    if (status >= 500) {
      return 'Something went wrong';
    }

    return 'Request failed';
  }

  private codeFor(status: number): string {
    return `HTTP_${status}`;
  }
}
