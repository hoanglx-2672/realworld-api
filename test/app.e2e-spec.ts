import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp } from './support/create-test-app.js';

// i18n trên app thật (AppModule + configureApp), không dựng module riêng
// để cấu hình test không lệch với production (ISS-07).
describe('i18n (e2e)', () => {
  let app: INestApplication<App>;
  /** Body sai: email không hợp lệ → 422 với câu đã dịch. */
  const badLogin = (path = '/api/users/login') =>
    request(app.getHttpServer())
      .post(path)
      .send({ user: { email: 'not-an-email', password: 'password123' } });

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('mặc định tiếng Anh (nguyên văn spec)', async () => {
    const res = await badLogin().expect(422);
    expect(res.body).toEqual({ errors: { email: ['is invalid'] } });
  });

  it('?lang=vi', async () => {
    const res = await badLogin('/api/users/login?lang=vi').expect(422);
    expect(res.body).toEqual({ errors: { email: ['không hợp lệ'] } });
  });

  it('x-lang: vi', async () => {
    const res = await badLogin().set('x-lang', 'vi').expect(422);
    expect(res.body).toEqual({ errors: { email: ['không hợp lệ'] } });
  });

  it('Accept-Language: vi-VN,vi;q=0.9', async () => {
    const res = await badLogin()
      .set('Accept-Language', 'vi-VN,vi;q=0.9')
      .expect(422);
    expect(res.body).toEqual({ errors: { email: ['không hợp lệ'] } });
  });

  it('?lang thắng x-lang (thứ tự resolver)', async () => {
    const res = await badLogin('/api/users/login?lang=en')
      .set('x-lang', 'vi')
      .expect(422);
    expect(res.body).toEqual({ errors: { email: ['is invalid'] } });
  });

  it('ngôn ngữ không hỗ trợ → về tiếng Anh', async () => {
    const res = await badLogin('/api/users/login?lang=fr').expect(422);
    expect(res.body).toEqual({ errors: { email: ['is invalid'] } });
  });
});
