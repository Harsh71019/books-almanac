import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';
import { PinoLogger } from 'nestjs-pino';
import mongoose from 'mongoose';
import { ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';

describe('ApiExceptionFilter', () => {
  let filter: ApiExceptionFilter;
  let loggerMock: jest.Mocked<PinoLogger>;
  let responseMock: any;
  let requestMock: any;
  let hostMock: jest.Mocked<ArgumentsHost>;

  beforeEach(() => {
    loggerMock = {
      setContext: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as any;

    filter = new ApiExceptionFilter(loggerMock);

    responseMock = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    requestMock = {
      url: '/test',
      method: 'GET'
    };

    hostMock = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => responseMock,
        getRequest: () => requestMock
      })
    } as any;
  });

  it('should handle standard HttpException', () => {
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    filter.catch(exception, hostMock);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(responseMock.json).toHaveBeenCalledWith({
      error: {
        code: 'HTTP_403',
        message: 'Forbidden'
      }
    });
    expect(loggerMock.warn).toHaveBeenCalled();
  });

  it('should handle standard HttpException with object array message', () => {
    const exception = new HttpException({ message: ['Name is required', 'Age must be positive'] }, HttpStatus.BAD_REQUEST);
    filter.catch(exception, hostMock);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(responseMock.json).toHaveBeenCalledWith({
      error: {
        code: 'HTTP_400',
        message: 'Name is required, Age must be positive'
      }
    });
  });

  it('should handle standard HttpException with object string message', () => {
    const exception = new HttpException({ message: 'User not found' }, HttpStatus.NOT_FOUND);
    filter.catch(exception, hostMock);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(responseMock.json).toHaveBeenCalledWith({
      error: {
        code: 'HTTP_404',
        message: 'User not found'
      }
    });
  });

  it('should handle standard HttpException with empty object message', () => {
    const exception = new HttpException({}, HttpStatus.BAD_REQUEST);
    filter.catch(exception, hostMock);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(responseMock.json).toHaveBeenCalledWith({
      error: {
        code: 'HTTP_400',
        message: 'Http Exception'
      }
    });
  });

  it('should handle Mongoose CastError', () => {
    const error = new mongoose.Error.CastError('ObjectId', 'invalid_id', 'id');
    filter.catch(error, hostMock);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(responseMock.json).toHaveBeenCalledWith({
      error: {
        code: 'INVALID_ID',
        message: 'Invalid value for id'
      }
    });
  });

  it('should handle Mongoose ValidationError', () => {
    const error = new mongoose.Error.ValidationError();
    error.errors = {
      title: new mongoose.Error.ValidatorError({ message: 'Title is required', path: 'title' })
    };
    filter.catch(error, hostMock);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(responseMock.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Title is required'
      }
    });
  });

  it('should handle TypeError with ERR_INVALID_URL', () => {
    const error = new TypeError('Invalid URL');
    (error as any).code = 'ERR_INVALID_URL';
    filter.catch(error, hostMock);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(responseMock.json).toHaveBeenCalledWith({
      error: {
        code: 'INVALID_URL',
        message: 'Invalid URL provided'
      }
    });
  });

  it('should handle ZodValidationException', () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: 'invalid' });
    if (result.success) throw new Error('Expected validation error');

    const exception = new ZodValidationException(result.error);
    filter.catch(exception, hostMock);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(responseMock.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [
          {
            field: 'email',
            message: 'Invalid email'
          }
        ]
      }
    });
  });

  it('should handle general Error as 500', () => {
    const error = new Error('Database crash');
    filter.catch(error, hostMock);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responseMock.json).toHaveBeenCalledWith({
      error: {
        code: 'HTTP_500',
        message: 'Something went wrong'
      }
    });
    expect(loggerMock.error).toHaveBeenCalled();
  });
});
