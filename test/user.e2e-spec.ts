import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { JwtPayload } from '../src/auth/auth.types.js';
import { createTestApp, uid } from './support/create-test-app.js';

describe('GET/PUT /api/user (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  const id = uid();
  const me = {
    username: `me_${id}`,
    email: `me_${id}@test.com`,
    password: 'password123',
  };
  const other = {
    username: `ot_${id}`,
    email: `ot_${id}@test.com`,
    password: 'password123',
  };

  const get = (tok?: string, scheme = 'Token') => {
    const req = request(app.getHttpServer()).get('/api/user');
    return tok ? req.set('Authorization', `${scheme} ${tok}`) : req;
  };
  const put = (user: object, tok: string | null = token) => {
    const req = request(app.getHttpServer()).put('/api/user').send({ user });
    return tok ? req.set('Authorization', `Token ${tok}`) : req;
  };

  beforeAll(async () => {
    app = await createTestApp();
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .send({ user: me });
    token = res.body.user.token;
    await request(app.getHttpServer()).post('/api/users').send({ user: other });
  });
  afterAll(() => app.close());

  it('AUTH-03 GET /user có token → 200', async () => {
    const res = await get(token).expect(200);
    expect(res.body.user).toEqual({
      username: me.username,
      email: me.email,
      bio: null,
      image: null,
      token,
    });
  });

  it('AUTH-04 PUT bio → lưu được', async () => {
    const res = await put({ bio: 'Updated bio' }).expect(200);
    expect(res.body.user).toMatchObject({
      username: me.username,
      bio: 'Updated bio',
      image: null,
    });
    expect(res.body.user.token).toEqual(expect.any(String));
    expect((await get(token)).body.user.bio).toBe('Updated bio');
  });

  it.each([
    ['AUTH-05', 'bio', ''],
    ['AUTH-06', 'bio', null],
    ['AUTH-08', 'image', ''],
    ['AUTH-09', 'image', null],
  ])('%s PUT %s = %j → null', async (_id, field, value) => {
    // Giá trị tạm phải hợp lệ: image bắt buộc là URL http(s) (ISS-22)
    const temp =
      field === 'image' ? 'https://example.com/temp.jpg' : 'tạm thời';
    await put({ [field]: temp }).expect(200);
    const res = await put({ [field]: value }).expect(200);
    expect(res.body.user[field]).toBeNull();
    expect((await get(token)).body.user[field]).toBeNull();
  });

  it('AUTH-07 PUT image', async () => {
    const res = await put({ image: 'https://example.com/photo.jpg' }).expect(
      200,
    );
    expect(res.body.user.image).toBe('https://example.com/photo.jpg');
  });

  it('AUTH-E18 PUT password 8 và 64 ký tự → 200, đăng nhập được bằng mật khẩu mới', async () => {
    await put({ password: 'bonjour1' }).expect(200);
    const long = 'a'.repeat(64);
    await put({ password: long }).expect(200);
    await request(app.getHttpServer())
      .post('/api/users/login')
      .send({ user: { email: me.email, password: long } })
      .expect(200);
  });

  it.each([
    ['AUTH-E13', { email: '' }, 'email', "can't be blank"],
    ['AUTH-E13', { username: '' }, 'username', "can't be blank"],
    ['AUTH-E14', { email: 'not-an-email' }, 'email', 'is invalid'],
    ['AUTH-E15', { email: null }, 'email', "can't be blank"],
    ['AUTH-E15', { username: null }, 'username', "can't be blank"],
    ['AUTH-E16', { password: '' }, 'password', "can't be blank"],
    ['AUTH-E16', { password: null }, 'password', "can't be blank"],
    [
      'AUTH-E17',
      { password: 'short7c' },
      'password',
      'is too short (minimum is 8 characters)',
    ],
  ])('%s PUT %j → 422', async (_id, body, field, message) => {
    const res = await put(body).expect(422);
    expect(res.body.errors[field][0]).toBe(message);
  });

  it('AUTH-X04 PUT username/email của người khác → 409', async () => {
    const r1 = await put({ username: other.username }).expect(409);
    expect(r1.body.errors.username[0]).toBe('has already been taken');
    const r2 = await put({ email: other.email.toUpperCase() }).expect(409);
    expect(r2.body.errors.email[0]).toBe('has already been taken');
  });

  it('AUTH-10 đổi username + email; token mới và token cũ đều dùng được', async () => {
    const upd = { username: `${me.username}_upd`, email: `upd_${me.email}` };
    const res = await put(upd).expect(200);
    expect(res.body.user).toMatchObject(upd);
    const fresh = await get(res.body.user.token).expect(200);
    expect(fresh.body.user).toMatchObject(upd);
    await get(token).expect(200); // token chỉ chứa id → không hỏng khi đổi email
  });

  it('AUTH-E11 GET /user không token → 401 token is missing', async () => {
    const res = await get().expect(401);
    expect(res.body).toEqual({ errors: { token: ['is missing'] } });
  });

  it('AUTH-E12 PUT /user không token → 401 token is missing', async () => {
    const res = await put({ bio: 'x' }, null).expect(401);
    expect(res.body).toEqual({ errors: { token: ['is missing'] } });
  });

  it('AUTH-X03 dùng scheme Bearer → 401', async () => {
    await get(token, 'Bearer').expect(401);
  });

  it('AUTH-X02 token sai chữ ký / hết hạn → 401 token is invalid', async () => {
    // Ký bằng id của user có thật: token đúng chữ ký, còn hạn thì qua (200), nên 401
    // ở dưới chỉ có thể do chữ ký hoặc hạn dùng, không phải nhánh "user không còn".
    const jwt = app.get(JwtService);
    const { sub } = jwt.decode<JwtPayload>(token);
    await get(jwt.sign({ sub })).expect(200);

    const forged = new JwtService({ secret: 'not-the-real-secret' }).sign({
      sub,
    });
    const r1 = await get(forged).expect(401);
    expect(r1.body).toEqual({ errors: { token: ['is invalid'] } });

    const expired = jwt.sign({ sub }, { expiresIn: -10 });
    const r2 = await get(expired).expect(401);
    expect(r2.body).toEqual({ errors: { token: ['is invalid'] } });
  });
});
