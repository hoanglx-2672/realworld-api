import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthContext } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UpdateUserRequestDto } from './dto/update-user.dto.js';
import type { UserEnvelope } from './user.types.js';
import { UsersService } from './users.service.js';

/** User đang đăng nhập: /api/user (số ít, khác /api/users). */
@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly usersService: UsersService) {}

  // GET /api/user
  @Get()
  async current(@CurrentAuth() auth: AuthContext): Promise<UserEnvelope> {
    return { user: await this.usersService.getCurrent(auth) };
  }

  // PUT /api/user
  @Put()
  async update(
    @CurrentAuth() auth: AuthContext,
    @Body() body: UpdateUserRequestDto,
  ): Promise<UserEnvelope> {
    return { user: await this.usersService.update(auth.userId, body.user) };
  }
}
