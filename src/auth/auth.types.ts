import type { JwtSignOptions } from '@nestjs/jwt';
import type { Request } from 'express';

/** Thông tin đăng nhập guard gắn vào request, đọc bằng `@CurrentAuth()`. */
export interface AuthContext {
  userId: number;
  /** Token gốc trong header — GET /user trả lại đúng token này. */
  token: string;
}

export type AuthenticatedRequest = Request & { auth?: AuthContext };

/** Payload JWT: chỉ id user. */
export interface JwtPayload {
  sub: number;
}

export type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;
