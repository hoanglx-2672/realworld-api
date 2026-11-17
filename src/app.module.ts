import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    // Đọc .env một lần, dùng được ở mọi module qua ConfigService.
    ConfigModule.forRoot({ isGlobal: true }),
  ],
})
export class AppModule {}
