import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

/**
 * ISS-20: chặn dò mật khẩu ở POST /api/users/login — mỗi IP tối đa `LOGIN_THROTTLE_LIMIT`
 * lần trong `LOGIN_THROTTLE_TTL_MS` ms; vượt → 429 + header `Retry-After`.
 * Bộ đếm nằm trong RAM của tiến trình: chạy nhiều instance thì cần storage dùng chung (Redis).
 * Sau reverse proxy phải bật `trust proxy`, không thì mọi người dùng chung IP của proxy.
 */
export const LoginThrottleModule = ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => [
    {
      limit: Number(config.get('LOGIN_THROTTLE_LIMIT', 10)),
      ttl: Number(config.get('LOGIN_THROTTLE_TTL_MS', 60_000)),
    },
  ],
});
