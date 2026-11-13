import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LoginRequestDto } from './dto/login-user.dto.js';
import { RegisterRequestDto } from './dto/register-user.dto.js';
import type { UserEnvelope } from './user.mapper.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // POST /api/users → 201 {"user": {...}}
  @Post()
  async register(@Body() body: RegisterRequestDto): Promise<UserEnvelope> {
    return { user: await this.usersService.register(body.user) };
  }

  // POST /api/users/login → 200 (Nest mặc định POST = 201, spec đòi 200)
  // Guard chỉ gắn ở login: giới hạn số lần thử theo IP (login-throttle.ts, ISS-20).
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  async login(@Body() body: LoginRequestDto): Promise<UserEnvelope> {
    return { user: await this.usersService.login(body.user) };
  }
}
