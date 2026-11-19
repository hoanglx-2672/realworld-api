/** Spec RealWorld: `Authorization: Token <jwt>` (không phải `Bearer`). */
export const AUTH_SCHEME = 'Token';

/** Thời hạn token khi `.env` không có JWT_EXPIRES_IN (hoặc để trống). */
export const DEFAULT_JWT_EXPIRES_IN = '7d';
