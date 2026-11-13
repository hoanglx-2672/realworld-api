import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

/** App đầy đủ như main.ts, nối vào Postgres local (npm run db:up). */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = configureApp(
    moduleRef.createNestApplication<INestApplication<App>>(),
  );
  await app.init();
  return app;
}

/** Hậu tố duy nhất mỗi lần gọi, để username/email không đụng dữ liệu cũ. */
export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface TestUser {
  username: string;
  token: string;
}

/** Đăng ký một user mới qua API, trả username + token. */
export async function registerUser(
  app: INestApplication<App>,
  prefix = 'u',
): Promise<TestUser> {
  const x = uid();
  const res = await request(app.getHttpServer())
    .post('/api/users')
    .send({
      user: {
        username: `${prefix}_${x}`,
        email: `${prefix}_${x}@test.com`,
        password: 'password123',
      },
    })
    .expect(201);
  return { username: res.body.user.username, token: res.body.user.token };
}
