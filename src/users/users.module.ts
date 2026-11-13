import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LoginThrottleModule } from './login-throttle.js';
import { UserController } from './user.controller.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  // Repository<User> lấy từ AuthModule (đã export TypeOrmModule.forFeature([User])).
  imports: [AuthModule, LoginThrottleModule],
  controllers: [UsersController, UserController],
  providers: [UsersService],
})
export class UsersModule {}
