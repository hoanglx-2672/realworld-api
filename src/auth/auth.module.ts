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
export function parseExpiresIn(value: string | undefined): ExpiresIn {
  const v = value?.trim() || DEFAULT_EXPIRES_IN; // `JWT_EXPIRES_IN=` rỗng → mặc định
  if (/^\d+$/.test(v)) return Number(v);
  if (!/^\d+(\.\d+)?\s*(ms|s|m|h|d|w|y)$/i.test(v)) {
    // Sai định dạng thì dừng lúc khởi động, không để mọi lần ký token đều 500.
    throw new Error(
      `JWT_EXPIRES_IN không hợp lệ: "${v}" (ví dụ 7d, 12h, 3600)`,
    );
  }
  return v as ExpiresIn;
}

const DEFAULT_EXPIRES_IN = '7d';

/** Rỗng hoặc toàn khoảng trắng cũng là thiếu: không bao giờ ký token bằng secret rỗng. */
export function requireSecret(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error('Thiếu JWT_SECRET (xem .env.example)');
  }
  return value;
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
        // Thiếu / rỗng JWT_SECRET thì app không khởi động: không chạy với secret mặc định.
        secret: requireSecret(config.get<string>('JWT_SECRET')),
        signOptions: {
          expiresIn: parseExpiresIn(config.get<string>('JWT_EXPIRES_IN')),
        },
      }),
    }),
  ],
  exports: [JwtModule, TypeOrmModule],
})
export class AuthModule {}
