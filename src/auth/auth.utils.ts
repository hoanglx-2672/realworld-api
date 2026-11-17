import { type HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { errorsException } from '../common/http-errors.js';
import { AUTH_SCHEME, DEFAULT_JWT_EXPIRES_IN } from './auth.constants.js';
import type { JwtExpiresIn } from './auth.types.js';

/**
 * `JWT_EXPIRES_IN`: "7d", "12h" (có đơn vị) hoặc "3600" (giây).
 * Đọc từ env luôn là chuỗi; jsonwebtoken hiểu chuỗi toàn số là **mili giây**
 * ("3600" → 3,6 giây), nên đổi sang number để được giây như người viết .env mong đợi.
 */
export function parseExpiresIn(value: string | undefined): JwtExpiresIn {
  const v = value?.trim() || DEFAULT_JWT_EXPIRES_IN; // `JWT_EXPIRES_IN=` rỗng → mặc định
  if (/^\d+$/.test(v)) return Number(v);
  if (!/^\d+(\.\d+)?\s*(ms|s|m|h|d|w|y)$/i.test(v)) {
    // Sai định dạng thì dừng lúc khởi động, không để mọi lần ký token đều 500.
    throw new Error(
      `JWT_EXPIRES_IN không hợp lệ: "${v}" (ví dụ 7d, 12h, 3600)`,
    );
  }
  return v as JwtExpiresIn;
}

/** Rỗng hoặc toàn khoảng trắng cũng là thiếu: không bao giờ ký token bằng secret rỗng. */
export function requireSecret(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error('Thiếu JWT_SECRET (xem .env.example)');
  }
  return value;
}

/**
 * Đọc header Authorization:
 * - `undefined`: không gửi header (hoặc gửi chuỗi rỗng)
 * - `null`: có header nhưng sai dạng (`Bearer x`, `Token`, `abc`)
 * - chuỗi: token
 */
export function extractToken(request: Request): string | null | undefined {
  const header = request.headers.authorization?.trim();
  if (!header) return undefined;
  const [scheme, token, ...rest] = header.split(/\s+/);
  return scheme === AUTH_SCHEME && token && !rest.length ? token : null;
}

/** 401 {"errors": {"token": ["is missing"]}} */
export const tokenMissingException = (): HttpException =>
  errorsException(HttpStatus.UNAUTHORIZED, 'token', 'errors.tokenMissing');

/** 401 {"errors": {"token": ["is invalid"]}} — dùng chung cho guard và UsersService. */
export const tokenInvalidException = (): HttpException =>
  errorsException(HttpStatus.UNAUTHORIZED, 'token', 'errors.tokenInvalid');
