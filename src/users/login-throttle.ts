import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

/**
 * ISS-20: chặn dò mật khẩu ở POST /api/users/login — mỗi IP tối đa `LOGIN_THROTTLE_LIMIT`
 * lần trong `LOGIN_THROTTLE_TTL_MS` ms; vượt → 429 + header `Retry-After`.
 * Bộ đếm nằm trong RAM của tiến trình: chạy nhiều instance thì cần storage dùng chung (Redis).
 * Sau reverse proxy phải bật `trust proxy`, không thì mọi người dùng chung IP của proxy.
 */
/**
 * Số nguyên dương từ env; rỗng → mặc định. Sai (0, âm, "ten") thì dừng lúc khởi động:
 * `Number('')` = 0 sẽ chặn mọi lần login, `NaN` thì tắt hẳn việc chặn mà không ai biết.
 */
export function positiveInt(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new Error(`${name} phải là số nguyên dương (nhận: "${value}")`);
  }
  return n;
}

export const LoginThrottleModule = ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => [
    {
      limit: positiveInt(
        'LOGIN_THROTTLE_LIMIT',
        config.get<string>('LOGIN_THROTTLE_LIMIT'),
        10,
      ),
      ttl: positiveInt(
        'LOGIN_THROTTLE_TTL_MS',
        config.get<string>('LOGIN_THROTTLE_TTL_MS'),
        60_000,
      ),
    },
  ],
});
