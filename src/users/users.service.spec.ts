import { HttpException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';
import type { User } from './user.entity.js';
import { UsersService } from './users.service.js';

describe('UsersService.update', () => {
  // Object thường (không ép sang User): spread một instance class sẽ mất prototype (lint).
  const user = { id: 7, username: 'jake', email: 'jake@x.com' };
  const jwt = {
    signAsync: vi.fn(async () => 'token'),
  } as unknown as JwtService;

  const serviceWith = (affected: number) => {
    const update = vi.fn(async () => ({ affected }));
    const users = {
      findOneBy: vi.fn(async () => ({ ...user }) as User),
      find: vi.fn(async () => []),
      update,
    } as unknown as Repository<User>;
    return { service: new UsersService(users, jwt), update };
  };

  it('user bị xoá giữa lúc đọc và ghi (UPDATE sửa 0 dòng) → 401 token is invalid, không INSERT', async () => {
    const { service } = serviceWith(0);
    const error = await service
      .update(7, { bio: 'x' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(401);
  });

  it('PUT {} → không gọi UPDATE', async () => {
    const { service, update } = serviceWith(1);
    await service.update(7, {});
    expect(update).not.toHaveBeenCalled();
  });
});
