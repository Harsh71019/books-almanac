import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerModule } from 'nestjs-pino';
import { ServeStaticModule } from '@nestjs/serve-static';
import { validateEnv } from './common/config/env.validation';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { BooksModule } from './books/books.module';
import { MetaModule } from './meta/meta.module';
import { SettingsModule } from './settings/settings.module';
import { StatsModule } from './stats/stats.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { HealthModule } from './health/health.module';
import { ReadingSessionsModule } from './reading-sessions/reading-sessions.module';
import { KavitaModule } from './kavita/kavita.module';
import { resolveConfiguredPath } from './common/utils/paths';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), '../.env')
      ],
      validate: validateEnv
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        customProps: () => ({ service: 'reading-almanac-api' }),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, colorize: true }
              }
      }
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        dbName: config.getOrThrow<string>('MONGODB_DB_NAME')
      })
    }),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          rootPath: resolveConfiguredPath(config.getOrThrow<string>('CLIENT_BUILD_DIR')),
          exclude: ['/api/(.*)', '/uploads/(.*)']
        },
        {
          rootPath: resolveConfiguredPath(config.getOrThrow<string>('UPLOAD_DIR')),
          serveRoot: config.getOrThrow<string>('PUBLIC_UPLOAD_PATH')
        }
      ]
    }),
    UsersModule,
    AuthModule,
    BooksModule,
    MetaModule,
    UploadsModule,
    StatsModule,
    SettingsModule,
    HealthModule,
    ReadingSessionsModule,
    KavitaModule
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    }
  ]
})
export class AppModule {}
