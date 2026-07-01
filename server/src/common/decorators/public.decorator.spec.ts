import { Public, IS_PUBLIC_KEY } from './public.decorator';

describe('PublicDecorator', () => {
  it('should set metadata IS_PUBLIC_KEY to true', () => {
    class Test {
      @Public()
      method() {}
    }

    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, Test.prototype.method);
    expect(isPublic).toBe(true);
  });
});
