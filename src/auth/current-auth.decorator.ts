import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthContext, AuthenticatedRequest } from './jwt-auth.guard.js';

/** `@CurrentAuth() auth: AuthContext` — chỉ dùng sau `@UseGuards(JwtAuthGuard)`. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().auth,
);
