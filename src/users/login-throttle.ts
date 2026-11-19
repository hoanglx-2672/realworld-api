import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { positiveInt } from '../common/utils/env.util.js';
import {
  LOGIN_THROTTLE_DEFAULT_LIMIT,
  LOGIN_THROTTLE_DEFAULT_TTL_MS,
} from './users.constants.js';

/**
 * ISS-20: chặn dò mật khẩu ở POST /api/users/login — mỗi IP tối đa `LOGIN_THROTTLE_LIMIT`
 * lần trong `LOGIN_THROTTLE_TTL_MS` ms; vượt → 429 + header `Retry-After`.
 * Bộ đếm nằm trong RAM của tiến trình: chạy nhiều instance thì cần storage dùng chung (Redis).
 * Sau reverse proxy phải đặt `TRUST_PROXY` (main.ts), không thì mọi người dùng chung IP của proxy.
 */
export const LoginThrottleModule = ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => [
    {
      limit: positiveInt(
        'LOGIN_THROTTLE_LIMIT',
        config.get<string>('LOGIN_THROTTLE_LIMIT'),
        LOGIN_THROTTLE_DEFAULT_LIMIT,
      ),
      ttl: positiveInt(
        'LOGIN_THROTTLE_TTL_MS',
        config.get<string>('LOGIN_THROTTLE_TTL_MS'),
        LOGIN_THROTTLE_DEFAULT_TTL_MS,
      ),
    },
  ],
});
