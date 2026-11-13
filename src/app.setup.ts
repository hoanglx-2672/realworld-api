import type { INestApplication } from '@nestjs/common';

/**
 * Cấu hình chung cho app thật (main.ts) và app trong e2e test,
 * để test chạy đúng như production.
 */
export function configureApp<T extends INestApplication>(app: T): T {
  // Spec RealWorld: mọi endpoint nằm dưới /api
  app.setGlobalPrefix('api');
  return app;
}
