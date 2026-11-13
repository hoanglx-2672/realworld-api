import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity.js';

type ExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

/**
 * `JWT_EXPIRES_IN`: "7d", "12h" (có đơn vị) hoặc "3600" (giây).
 * Đọc từ env luôn là chuỗi; jsonwebtoken hiểu chuỗi toàn số là **mili giây**
 * ("3600" → 3,6 giây), nên đổi sang number để được giây như người viết .env mong đợi.
 */
export function parseExpiresIn(value: string): ExpiresIn {
  return /^\d+$/.test(value) ? Number(value) : (value as ExpiresIn);
}

/**
 * Module nào dùng `JwtAuthGuard` thì import AuthModule: guard cần `JwtService`
 * (kiểm chữ ký) và `Repository<User>` (kiểm user còn tồn tại).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Thiếu JWT_SECRET thì app không khởi động: không bao giờ chạy với secret mặc định.
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: parseExpiresIn(config.get('JWT_EXPIRES_IN', '7d')),
        },
      }),
    }),
  ],
  exports: [JwtModule, TypeOrmModule],
})
export class AuthModule {}
