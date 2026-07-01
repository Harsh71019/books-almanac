import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { ConfigService } from '@nestjs/config';
import { CoverCacheService } from './cover-cache.service';
import { BadRequestException } from '@nestjs/common';

jest.mock('@nestjs/platform-express', () => {
  const actual = jest.requireActual('@nestjs/platform-express');
  return {
    ...actual,
    FileInterceptor: jest.fn().mockImplementation((fieldName, options) => {
      (globalThis as any).mockFileInterceptorOptions = options;
      return actual.FileInterceptor(fieldName, options);
    })
  };
});

jest.mock('multer', () => {
  const mockMulter = jest.fn().mockImplementation(() => ({
    single: jest.fn(),
    array: jest.fn(),
    fields: jest.fn(),
    any: jest.fn()
  }));
  (mockMulter as any).diskStorage = jest.fn().mockImplementation((options) => {
    (globalThis as any).mockStorageOptions = options;
    return {};
  });
  return mockMulter;
});

describe('UploadsController', () => {
  let controller: UploadsController;
  let configServiceMock: any;
  let coverCacheMock: any;

  beforeEach(async () => {
    configServiceMock = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'PUBLIC_UPLOAD_PATH') return '/uploads';
        return '';
      })
    };

    coverCacheMock = {
      cacheExternalCover: jest.fn().mockResolvedValue('/uploads/covers/cached.jpg')
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [
        {
          provide: ConfigService,
          useValue: configServiceMock
        },
        {
          provide: CoverCacheService,
          useValue: coverCacheMock
        }
      ]
    }).compile();

    controller = module.get<UploadsController>(UploadsController);
  });

  describe('uploadCover', () => {
    it('should return public path for uploaded file', () => {
      const fileMock = { filename: 'test.jpg' } as any;
      const res = controller.uploadCover(fileMock);
      expect(res).toEqual({ url: '/uploads/test.jpg' });
    });

    it('should throw BadRequestException if file is missing', () => {
      expect(() => controller.uploadCover(undefined as any)).toThrow(BadRequestException);
    });
  });

  describe('cacheCover', () => {
    it('should call coverCache and return URL', async () => {
      const res = await controller.cacheCover({ url: 'http://example.com/cover.jpg' });
      expect(coverCacheMock.cacheExternalCover).toHaveBeenCalledWith('http://example.com/cover.jpg');
      expect(res).toEqual({ url: '/uploads/covers/cached.jpg' });
    });
  });

  describe('multer options', () => {
    it('should generate filename with suffix', () => {
      const mockStorageOptions = (globalThis as any).mockStorageOptions;
      expect(mockStorageOptions).toBeDefined();
      const callback = jest.fn();
      mockStorageOptions.filename(null, { originalname: 'image.PNG' }, callback);
      expect(callback).toHaveBeenCalledWith(null, expect.stringMatching(/^cover-\d+-\d+\.png$/));
    });
  });

  describe('fileFilter', () => {
    it('should allow JPEG, PNG and WebP and reject other mime types', () => {
      const options = (globalThis as any).mockFileInterceptorOptions;
      expect(options).toBeDefined();
      expect(options.fileFilter).toBeDefined();

      const callback = jest.fn();
      options.fileFilter(null, { mimetype: 'image/jpeg' }, callback);
      expect(callback).toHaveBeenCalledWith(null, true);

      callback.mockClear();
      options.fileFilter(null, { mimetype: 'application/pdf' }, callback);
      expect(callback).toHaveBeenCalledWith(expect.any(BadRequestException), false);
    });
  });
});
