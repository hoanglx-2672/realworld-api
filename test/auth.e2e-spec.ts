import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp, uid } from './support/create-test-app.js';

describe('auth (e2e)', () => {
  let app: INestApplication<App>;
  const id = uid();
  const user = {
    username: `auth_${id}`,
    email: `auth_${id}@test.com`,
    password: 'password123',
  };
  const freshUser = () => {
    const x = uid();
    return {
      username: `u_${x}`,
      email: `u_${x}@test.com`,
      password: 'password123',
    };
  };

  const register = (body: object, query = '') =>
    request(app.getHttpServer()).post(`/api/users${query}`).send(body);
  const login = (body: object) =>
    request(app.getHttpServer()).post('/api/users/login').send(body);

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  describe('POST /api/users', () => {
    it('AUTH-01 đăng ký thành công → 201', async () => {
      const res = await register({ user }).expect(201);
      expect(res.body.user).toMatchObject({
        username: user.username,
        email: user.email,
        bio: null,
        image: null,
      });
      expect(res.body.user.token).toEqual(expect.any(String));
      expect(res.body.user.token).not.toBe('');
      expect(res.body.user).not.toHaveProperty('password'); // AUTH-X05
    });

    it.each([
      ['AUTH-E01', 'username'],
      ['AUTH-E02', 'email'],
      ['AUTH-E03', 'password'],
    ])("%s %s rỗng → 422 can't be blank", async (_id, field) => {
      const res = await register({
        user: { ...freshUser(), [field]: '' },
      }).expect(422);
      expect(res.body.errors[field][0]).toBe("can't be blank");
    });

    it('AUTH-E04 email sai định dạng → 422 is invalid', async () => {
      const res = await register({
        user: { ...freshUser(), email: `bad_${id}_not_an_email` },
      }).expect(422);
      expect(res.body.errors.email[0]).toBe('is invalid');
    });

    it('AUTH-E05 trùng username → 409', async () => {
      const res = await register({
        user: { ...user, email: `other_${id}@test.com` },
      }).expect(409);
      expect(res.body.errors.username[0]).toBe('has already been taken');
    });

    it('AUTH-E06 trùng email (khác hoa thường) → 409', async () => {
      const res = await register({
        user: {
          ...user,
          username: `other_${id}`,
          email: user.email.toUpperCase(),
        },
      }).expect(409);
      expect(res.body.errors.email[0]).toBe('has already been taken');
    });

    it('AUTH-X06 mật khẩu < 8 ký tự → 422', async () => {
      const res = await register({
        user: { ...freshUser(), password: 'short7c' },
      }).expect(422);
      expect(res.body.errors.password).toHaveLength(1);
    });

    it('AUTH-X08 thiếu lớp bọc user → 422', async () => {
      const res = await register(user).expect(422);
      expect(res.body.errors.user[0]).toBe("can't be blank");
    });

    it('AUTH-X09 ?lang=vi → câu lỗi tiếng Việt', async () => {
      const res = await register(
        { user: { ...freshUser(), username: '' } },
        '?lang=vi',
      ).expect(422);
      expect(res.body.errors.username[0]).toBe('không được để trống');
    });

    it('AUTH-X07 hai đăng ký trùng cùng lúc → một 201, một 409', async () => {
      const body = { user: freshUser() };
      const codes = (await Promise.all([register(body), register(body)]))
        .map((r) => r.status)
        .sort((a, b) => a - b);
      expect(codes).toEqual([201, 409]);
    });
  });

  describe('POST /api/users/login', () => {
    it('AUTH-02 đăng nhập thành công → 200', async () => {
      const res = await login({
        // AUTH-X10: field lạ (id) bị bỏ qua, không gây lỗi
        user: { email: user.email, password: user.password, id: 99 },
      }).expect(200);
      expect(res.body.user).toMatchObject({
        username: user.username,
        email: user.email,
        bio: null,
        image: null,
      });
      expect(res.body.user.token).toEqual(expect.any(String));
      expect(res.body.user).not.toHaveProperty('password');
    });

    it.each([
      [
        'AUTH-E07',
        { email: '', password: 'password123' },
        'email',
        "can't be blank",
      ],
      [
        'AUTH-E08',
        { email: 'a@test.com', password: '' },
        'password',
        "can't be blank",
      ],
      [
        'AUTH-E09',
        { email: 'a@', password: 'password123' },
        'email',
        'is invalid',
      ],
    ])('%s → 422', async (_id, body, field, message) => {
      const res = await login({ user: body }).expect(422);
      expect(res.body.errors[field][0]).toBe(message);
    });

    it('AUTH-E10 sai mật khẩu → 401 credentials invalid', async () => {
      const res = await login({
        user: { email: user.email, password: 'wrongpassword' },
      }).expect(401);
      expect(res.body).toEqual({ errors: { credentials: ['invalid'] } });
    });

    it('AUTH-X01 email chưa đăng ký → 401 giống sai mật khẩu', async () => {
      const res = await login({
        user: { email: `nobody_${id}@test.com`, password: 'password123' },
      }).expect(401);
      expect(res.body).toEqual({ errors: { credentials: ['invalid'] } });
    });
  });
});
