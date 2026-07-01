import { CurrentUser } from './current-user.decorator';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

function getDecoratorFactory(decorator: any) {
  class Test {
    test(@decorator() _user: any) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Test, 'test');
  return args[Object.keys(args)[0]].factory;
}

describe('CurrentUserDecorator', () => {
  it('should return request.user', () => {
    const factory = getDecoratorFactory(CurrentUser);
    const mockRequest = { user: { username: 'testadmin' } };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest
      })
    } as any;

    const result = factory(null, mockContext);
    expect(result).toEqual({ username: 'testadmin' });
  });
});
