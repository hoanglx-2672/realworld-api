import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  // SIGTERM/SIGINT (docker stop, Ctrl+C) → gọi onModuleDestroy: đóng kết nối DB gọn gàng.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
  new Logger('Bootstrap').log(`API: ${await app.getUrl()}/api`);
}
await bootstrap();
