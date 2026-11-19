import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { DEFAULT_PORT } from './common/constants/app.constants.js';

async function bootstrap() {
  const app = configureApp(
    await NestFactory.create<NestExpressApplication>(AppModule),
  );
  const config = app.get(ConfigService);
  // Sau reverse proxy (nginx, ALB): tin header X-Forwarded-For để req.ip là IP thật của
  // client. Không bật thì giới hạn login đếm chung một IP proxy cho mọi người (ISS-20).
  const trustProxy = config.get<string>('TRUST_PROXY')?.trim();
  if (trustProxy) {
    app.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
    );
  }
  // SIGTERM/SIGINT (docker stop, Ctrl+C) → gọi onModuleDestroy: đóng kết nối DB gọn gàng.
  app.enableShutdownHooks();
  // `||` thay vì `??`: `.env` có dòng `PORT=` (rỗng) thì vẫn dùng cổng mặc định.
  const port = config.get<string>('PORT') || DEFAULT_PORT;
  // HOST rỗng: nghe mọi địa chỉ, giống khi không truyền host.
  const host = config.get<string>('HOST')?.trim();
  await (host ? app.listen(port, host) : app.listen(port));
  new Logger('Bootstrap').log(`API: ${await app.getUrl()}/api`);
}
await bootstrap();
