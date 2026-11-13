import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp, uid } from './support/create-test-app.js';

// Hồi quy cho phát hiện ở docs/features/auth/review.md (R-xx).
describe('auth — dữ liệu xấu (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  const fresh = () => {
    const x = uid();
    return {
      username: `h_${x}`,
      email: `h_${x}@test.com`,
      password: 'password123',
    };
  };
  const post = (path: string, body: unknown) =>
    request(app.getHttpServer())
      .post(path)
      .send(body as object);
  const put = (body: unknown) =>
    request(app.getHttpServer())
      .put('/api/user')
      .set('Authorization', `Token ${token}`)
      .send(body as object);

  beforeAll(async () => {
    app = await createTestApp();
    token = (await post('/api/users', { user: fresh() })).body.user.token;
  });
  afterAll(() => app.close());

  it.each([
    ['/api/users', []],
    ['/api/users', [fresh()]],
    ['/api/users', 'abc'],
    ['/api/users/login', []],
  ])('R-01 POST %s với user = %j → 422, không 500', async (path, user) => {
    const res = await post(path, { user }).expect(422);
    expect(res.body.errors.user[0]).toBe('is invalid');
  });

  it('R-01 PUT /api/user với user = [] → 422', async () => {
    await put({ user: [] }).expect(422);
  });

  it.each(['   ', '\t'])(
    "R-03 username toàn khoảng trắng %j → 422 can't be blank",
    async (username) => {
      const res = await post('/api/users', {
        user: { ...fresh(), username },
      }).expect(422);
      expect(res.body.errors.username[0]).toBe("can't be blank");
    },
  );

  it('R-03 username có khoảng trắng đầu/cuối → được cắt', async () => {
    const u = fresh();
    const res = await post('/api/users', {
      user: { ...u, username: `  ${u.username}  ` },
    }).expect(201);
    expect(res.body.user.username).toBe(u.username);
  });

  it('R-04 mật khẩu 40 ký tự "é" (80 byte, quá 72 byte của bcrypt) → 422', async () => {
    const res = await post('/api/users', {
      user: { ...fresh(), password: 'é'.repeat(40) },
    }).expect(422);
    expect(res.body.errors.password).toHaveLength(1);
  });

  it('R-05 ký tự NUL trong bio / username → 422, không 500', async () => {
    await put({ user: { bio: 'a\u0000b' } }).expect(422);
    await post('/api/users', {
      user: { ...fresh(), username: 'a\u0000b' },
    }).expect(422);
  });
});

describe('auth — một câu lỗi rõ ràng mỗi field (QA-auth-02)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('username kiểu số → chỉ một câu is invalid', async () => {
    const x = uid();
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        user: {
          username: 123,
          email: `n_${x}@test.com`,
          password: 'password123',
        },
      })
      .expect(422);
    expect(res.body.errors.username).toEqual(['is invalid']);
  });
});
