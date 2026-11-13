import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = configureApp(
    await NestFactory.create<NestExpressApplication>(AppModule),
  );
  // Sau reverse proxy (nginx, ALB): tin header X-Forwarded-For để req.ip là IP thật của
  // client. Không bật thì giới hạn login đếm chung một IP proxy cho mọi người (ISS-20).
  const trustProxy = process.env.TRUST_PROXY?.trim();
  if (trustProxy) {
    app.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
    );
  }
  // SIGTERM/SIGINT (docker stop, Ctrl+C) → gọi onModuleDestroy: đóng kết nối DB gọn gàng.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
  new Logger('Bootstrap').log(`API: ${await app.getUrl()}/api`);
}
await bootstrap();
