import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { errorsException } from '../common/http-errors.js';
import { User } from '../users/user.entity.js';

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

/** Spec RealWorld: `Authorization: Token <jwt>` (không phải `Bearer`). */
const SCHEME = 'Token';

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
  return scheme === SCHEME && token && !rest.length ? token : null;
}

const invalidToken = () =>
  errorsException(HttpStatus.UNAUTHORIZED, 'token', 'errors.tokenInvalid');

/**
 * Bắt buộc đăng nhập:
 * - không có header → 401 {"errors": {"token": ["is missing"]}}
 * - header sai dạng / sai chữ ký / hết hạn / user không còn → 401 {"errors": {"token": ["is invalid"]}}
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  /** `true` ở OptionalJwtAuthGuard: không có header thì cho qua như khách. */
  protected readonly optional: boolean = false;

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractToken(request);
    if (token === undefined) {
      if (this.optional) return true;
      throw errorsException(
        HttpStatus.UNAUTHORIZED,
        'token',
        'errors.tokenMissing',
      );
    }
    if (token === null) throw invalidToken();
    const payload = await this.verify(token);
    // Token đúng chữ ký nhưng user đã bị xoá: không để request đi tiếp
    // (trước đây POST /articles → lỗi khoá ngoại → 500).
    if (!payload || !(await this.users.existsBy({ id: payload.sub }))) {
      throw invalidToken();
    }
    request.auth = { userId: payload.sub, token };
    return true;
  }

  /** Payload hợp lệ; sai chữ ký / hết hạn / payload lạ → undefined. */
  private async verify(token: string): Promise<JwtPayload | undefined> {
    try {
      const { sub } = await this.jwt.verifyAsync<{ sub?: unknown }>(token);
      return Number.isSafeInteger(sub) ? { sub: sub as number } : undefined;
    } catch {
      return undefined;
    }
  }
}

/**
 * Đăng nhập tuỳ chọn (xem bài, danh sách bài): không header → khách (`auth` undefined);
 * có header nhưng hỏng → vẫn 401, không lặng lẽ coi là khách.
 */
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  protected override readonly optional = true;
}
