import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp, registerUser, uid } from './support/create-test-app.js';

// ISS-20. App riêng với giới hạn thấp: cả bộ e2e chạy với LOGIN_THROTTLE_LIMIT=1000
// (vitest.config.e2e.ts) để các test khác không vướng 429.
describe('giới hạn số lần đăng nhập theo IP (e2e)', () => {
  let app: INestApplication<App>;
  const LIMIT = 2;
  const login = (query = '') =>
    request(app.getHttpServer())
      .post(`/api/users/login${query}`)
      .send({
        user: { email: `nobody_${uid()}@test.com`, password: 'password123' },
      });

  beforeAll(async () => {
    const before = process.env.LOGIN_THROTTLE_LIMIT;
    process.env.LOGIN_THROTTLE_LIMIT = String(LIMIT);
    try {
      app = await createTestApp();
    } finally {
      // Gán undefined vào process.env sẽ thành chuỗi "undefined" → phải xoá hẳn.
      if (before === undefined) delete process.env.LOGIN_THROTTLE_LIMIT;
      else process.env.LOGIN_THROTTLE_LIMIT = before;
    }
  });
  afterAll(() => app.close());

  it('lần thứ LIMIT + 1 → 429 kèm Retry-After; đăng ký không bị chặn', async () => {
    for (let i = 0; i < LIMIT; i++) await login().expect(401);

    const res = await login().expect(429);
    expect(res.body).toEqual({
      errors: { request: ['too many attempts, try again later'] },
    });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);

    const vi = await login('?lang=vi').expect(429);
    expect(vi.body).toEqual({
      errors: { request: ['thử quá nhiều lần, vui lòng thử lại sau'] },
    });

    // Guard chỉ gắn ở login: đăng ký cùng IP vẫn qua.
    await registerUser(app, 'thr');
  });
});
