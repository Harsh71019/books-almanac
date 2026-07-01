import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflectorMock: jest.Mocked<Reflector>;
  let contextMock: ExecutionContext;

  beforeEach(() => {
    reflectorMock = {
      getAllAndOverride: jest.fn()
    } as any;

    guard = new JwtAuthGuard(reflectorMock);

    contextMock = {
      getHandler: jest.fn(),
      getClass: jest.fn()
    } as any;
  });

  it('should return true if route is marked as public', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(true);
    const result = guard.canActivate(contextMock);
    expect(result).toBe(true);
    expect(reflectorMock.getAllAndOverride).toHaveBeenCalledWith(
      expect.any(String),
      [undefined, undefined]
    );
  });

  it('should call super.canActivate if route is not public', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);
    const superCanActivateSpy = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(true);

    const result = guard.canActivate(contextMock);
    expect(result).toBe(true);
    expect(superCanActivateSpy).toHaveBeenCalledWith(contextMock);

    superCanActivateSpy.mockRestore();
  });
});
