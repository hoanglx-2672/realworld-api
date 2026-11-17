import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity.js';
import { parseExpiresIn, requireSecret } from './auth.utils.js';

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
