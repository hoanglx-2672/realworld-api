import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity.js';
import type { AuthenticatedRequest, JwtPayload } from './auth.types.js';
import {
  extractToken,
  tokenInvalidException,
  tokenMissingException,
} from './auth.utils.js';

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
      throw tokenMissingException();
    }
    if (token === null) throw tokenInvalidException();
    const payload = await this.verify(token);
    // Token đúng chữ ký nhưng user đã bị xoá: không để request đi tiếp
    // (trước đây POST /articles → lỗi khoá ngoại → 500).
    if (!payload || !(await this.users.existsBy({ id: payload.sub }))) {
      throw tokenInvalidException();
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
