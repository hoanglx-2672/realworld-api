import { join } from 'node:path';
import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { I18nModule, JsonI18nLoader } from '@nestjs/i18n';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import {
  DEFAULT_LOCALE,
  LOCALE_RESOLVERS,
} from './common/constants/i18n.constants.js';
import { NoStoreMiddleware } from './common/no-store.middleware.js';

@Module({
  imports: [
    // 1. Đọc .env một lần, dùng được ở mọi module qua ConfigService.
    ConfigModule.forRoot({ isGlobal: true }),

    // 2. Đa ngôn ngữ. File dịch nằm ở src/i18n/<locale>/<namespace>.json
    I18nModule.forRootAsync({
      loader: new JsonI18nLoader({ path: join(import.meta.dirname, 'i18n') }),
      resolvers: LOCALE_RESOLVERS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        defaultLocale: config.get<string>('DEFAULT_LOCALE') || DEFAULT_LOCALE,
      }),
    }),
  ],
  providers: [
    // Filter toàn cục đăng ký qua DI (không dùng app.useGlobalFilters) để tiêm được
    // I18nService, và để app trong e2e (cũng dựng từ AppModule) có cùng filter.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(NoStoreMiddleware).forRoutes('{*path}');
  }
}
