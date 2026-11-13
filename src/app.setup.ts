import type { INestApplication } from '@nestjs/common';
import { I18nValidationPipe } from '@nestjs/i18n';
import { validationExceptionFactory } from './common/validation-exception.factory.js';

/**
 * Cấu hình chung cho app thật (main.ts) và app trong e2e test,
 * để test chạy đúng như production.
 */
export function configureApp<T extends INestApplication>(app: T): T {
  // Spec RealWorld: mọi endpoint nằm dưới /api
  app.setGlobalPrefix('api');

  // Giống ValidationPipe nhưng dịch lỗi theo ngôn ngữ của request
  // (tra key `validation.<tên-constraint>`), rồi đổi sang định dạng lỗi của spec:
  // 422 {"errors": {"<field>": ["..."]}}
  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  return app;
}
