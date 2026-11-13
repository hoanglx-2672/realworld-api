import { join } from 'node:path';
import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import {
  AcceptLanguageLocaleResolver,
  HeaderLocaleResolver,
  I18nModule,
  JsonI18nLoader,
  QueryLocaleResolver,
} from '@nestjs/i18n';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { NoStoreMiddleware } from './common/no-store.middleware.js';
import { typeOrmOptions } from './database/typeorm.options.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    // 1. Đọc .env một lần, dùng được ở mọi module qua ConfigService.
    ConfigModule.forRoot({ isGlobal: true }),

    // 2. Kết nối Postgres. Dùng chung cấu hình với TypeORM CLI (data-source.ts).
    TypeOrmModule.forRootAsync({
      useFactory: () => typeOrmOptions(process.env),
    }),

    // 3. Đa ngôn ngữ. File dịch nằm ở src/i18n/<locale>/<namespace>.json
    I18nModule.forRootAsync({
      loader: new JsonI18nLoader({ path: join(import.meta.dirname, 'i18n') }),
      // Thử lần lượt, cái nào tìm được ngôn ngữ hỗ trợ trước thì thắng.
      resolvers: [
        new QueryLocaleResolver('lang'), //     ?lang=vi
        new HeaderLocaleResolver('x-lang'), //  x-lang: vi
        new AcceptLanguageLocaleResolver(), //  Accept-Language: vi-VN,vi;q=0.9
      ],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        defaultLocale: config.get('DEFAULT_LOCALE', 'en'),
      }),
    }),

    UsersModule,
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
