import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { LoginThrottleModule } from './login-throttle.js';
import { User } from './user.entity.js';
import { UserController } from './user.controller.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule, LoginThrottleModule],
  controllers: [UsersController, UserController],
  providers: [UsersService],
})
export class UsersModule {}
