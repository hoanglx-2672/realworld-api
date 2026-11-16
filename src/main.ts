import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

const DEFAULT_PORT = 3000;

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  const config = app.get(ConfigService);
  // SIGTERM/SIGINT (docker stop, Ctrl+C) → gọi onModuleDestroy: đóng kết nối DB gọn gàng.
  app.enableShutdownHooks();
  // `||` thay vì `??`: `.env` có dòng `PORT=` (rỗng) thì vẫn dùng cổng mặc định.
  await app.listen(config.get<string>('PORT') || DEFAULT_PORT);
  new Logger('Bootstrap').log(`API: ${await app.getUrl()}/api`);
}
await bootstrap();
