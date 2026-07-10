import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { PinoLogger } from 'nestjs-pino';
import { ZodValidationException } from 'nestjs-zod';
import * as Sentry from '@sentry/node';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ApiExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'HTTP_500';
    let message = 'Something went wrong';
    let details: unknown = undefined;

    if (exception instanceof ZodValidationException) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'Request validation failed';
      details = exception.getZodError().errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message
      }));
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = `HTTP_${status}`;
      message = this.extractMessage(exception);
    } else if (exception instanceof mongoose.Error.CastError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'INVALID_ID';
      message = `Invalid value for ${exception.path}`;
    } else if (exception instanceof mongoose.Error.ValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = Object.values(exception.errors)
        .map((e) => e.message)
        .join(', ');
    } else if (exception instanceof TypeError && (exception as any).code === 'ERR_INVALID_URL') {
      status = HttpStatus.BAD_REQUEST;
      code = 'INVALID_URL';
      message = 'Invalid URL provided';
    }

    // Never include req.body here — several routes (Kavita browse/import,
    // login) carry passwords in the body, and this filter is @Catch()-wide.
    const context = { path: request.url, method: request.method, status, code };

    if (status >= 500) {
      this.logger.error({ err: exception, ...context }, 'Unhandled API exception');
      Sentry.captureException(exception, { level: 'error', extra: context });
    } else {
      this.logger.warn({ ...context, message }, 'Client error');
      // 4xx are often still worth alerting on for a single-user app (e.g. a
      // Kavita import failing with a 502/400 is a real, actionable failure,
      // not routine user error like a wrong login password) — captured as
      // 'warning' so they're visually distinct from real 5xx in Glitchtip.
      Sentry.captureMessage(`${code}: ${message}`, { level: 'warning', extra: context });
    }

    response.status(status).json({
      error: {
        code,
        message,
        ...(details ? { details } : {})
      }
    });
  }

  private extractMessage(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response && 'message' in response) {
      const message = (response as { message: string | string[] }).message;
      return Array.isArray(message) ? message.join(', ') : message;
    }
    return exception.message;
  }
}
