import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { Tag } from '../src/tags/tag.entity.js';
import {
  createTestApp,
  registerUser,
  type TestUser,
  uid,
} from './support/create-test-app.js';

// Hồi quy cho sổ theo dõi vấn đề: docs/tracker.html (mã ISS-xx).
describe('sổ theo dõi vấn đề (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let me: TestUser;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Token ${token}` });
  const createArticle = (token: string, tagList: string[]) =>
    http()
      .post('/api/articles')
      .set(auth(token))
      .send({
        article: { title: `t ${uid()}`, description: 'd', body: 'b', tagList },
      });

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    me = await registerUser(app, 'iss');
  });
  afterAll(() => app.close());

  describe('ISS-01 lỗi ngoài validation cũng theo định dạng {"errors": …}', () => {
    const malformed = () =>
      http()
        .post('/api/users/login')
        .set('Content-Type', 'application/json')
        .send('{"user": ');

    it('JSON hỏng → 400 {"errors":{"body":["is malformed"]}}', async () => {
      const res = await malformed().expect(400);
      expect(res.body).toEqual({ errors: { body: ['is malformed'] } });
    });

    it.each([
      ['?lang=vi', (r: request.Test) => r],
      ['x-lang: vi', (r: request.Test) => r.set('x-lang', 'vi')],
      [
        'Accept-Language: vi-VN',
        (r: request.Test) => r.set('Accept-Language', 'vi-VN,vi;q=0.9'),
      ],
    ])('JSON hỏng + %s → câu tiếng Việt', async (name, withLang) => {
      const base = name.startsWith('?')
        ? http().post('/api/users/login?lang=vi')
        : http().post('/api/users/login');
      const res = await withLang(base)
        .set('Content-Type', 'application/json')
        .send('{"user": ')
        .expect(400);
      expect(res.body).toEqual({ errors: { body: ['sai định dạng'] } });
    });

    it('route không tồn tại → 404 {"errors":{"path":["not found"]}}', async () => {
      const res = await http().get('/api/khong-co-route').expect(404);
      expect(res.body).toEqual({ errors: { path: ['not found'] } });
    });

    it('lỗi do mình ném (đã đúng định dạng) giữ nguyên', async () => {
      const res = await http().get('/api/user').expect(401);
      expect(res.body).toEqual({ errors: { token: ['is missing'] } });
    });
  });

  describe('ISS-02 GET /api/tags chỉ liệt kê tag còn được dùng (articles R-05)', () => {
    it('xoá bài cuối cùng mang tag → tag biến khỏi danh sách', async () => {
      const lonely = `lonely_${uid()}`;
      const kept = `kept_${uid()}`;
      const a = (await createArticle(me.token, [lonely, kept]).expect(201)).body
        .article;
      await createArticle(me.token, [kept]).expect(201);

      let tags: string[] = (await http().get('/api/tags').expect(200)).body
        .tags;
      expect(tags).toEqual(expect.arrayContaining([lonely, kept]));

      await http()
        .delete(`/api/articles/${a.slug}`)
        .set(auth(me.token))
        .expect(204);
      tags = (await http().get('/api/tags').expect(200)).body.tags;
      expect(tags).toContain(kept);
      expect(tags).not.toContain(lonely);
    });
  });

  describe('ISS-03 đổi mật khẩu KHÔNG thu hồi token cũ (spec: errors_auth.hurl:240–261)', () => {
    it('token cũ vẫn dùng được sau hai lần đổi mật khẩu; đăng nhập bằng mật khẩu mới', async () => {
      const user = await registerUser(app, 'pw');
      for (const password of ['new-password-1', 'a'.repeat(64)]) {
        await http()
          .put('/api/user')
          .set(auth(user.token))
          .send({ user: { password } })
          .expect(200);
      }
      await http().get('/api/user').set(auth(user.token)).expect(200);
      // Đúng như tên test: mật khẩu mới (64 ký tự) đăng nhập được, mật khẩu cũ thì không.
      const login = (password: string) =>
        http()
          .post('/api/users/login')
          .send({ user: { email: `${user.username}@test.com`, password } });
      await login('a'.repeat(64)).expect(200);
      await login('password123').expect(401);
    });
  });

  describe('ISS-04 response không được cache (Sunlint S037)', () => {
    it.each(['/api/user', '/api/articles?limit=1', '/api/tags'])(
      'GET %s → Cache-Control: no-store',
      async (path) => {
        const res = await http().get(path).set(auth(me.token)).expect(200);
        expect(res.headers['cache-control']).toBe('no-store');
      },
    );

    it('POST /api/users/login thành công (response chứa token) → Cache-Control: no-store', async () => {
      const user = await registerUser(app, 'nc');
      const res = await http()
        .post('/api/users/login')
        .send({
          user: { email: `${user.username}@test.com`, password: 'password123' },
        })
        .expect(200);
      expect(res.body.user.token).toEqual(expect.any(String));
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('ISS-24 JSON hỏng (lỗi body-parser, trước middleware) → vẫn có Cache-Control: no-store', async () => {
      const res = await http()
        .post('/api/users/login')
        .set('Content-Type', 'application/json')
        .send('{"user": ')
        .expect(400);
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe('ISS-05 nhiều request cùng tạo một tag mới', () => {
    it('5 bài đồng thời cùng tag mới → cả 5 là 201, chỉ có 1 tag', async () => {
      const shared = `shared_${uid()}`;
      const results = await Promise.all(
        Array.from({ length: 5 }, () => createArticle(me.token, [shared])),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
      expect(await db.getRepository(Tag).countBy({ name: shared })).toBe(1);
    });
  });

  describe('ISS-21 tag không phân biệt hoa thường', () => {
    it('tagList được cắt khoảng trắng + chữ thường; trùng nhau sau chuẩn hoá thì gộp', async () => {
      const x = uid();
      const res = await createArticle(me.token, [
        `NestJS_${x}`,
        ` nestjs_${x} `,
        `Vue_${x}`,
      ]).expect(201);
      expect(res.body.article.tagList).toEqual([`nestjs_${x}`, `vue_${x}`]);
    });

    it('hai bài gắn "Go" và "go" dùng chung một tag; ?tag= lọc không phân biệt hoa thường', async () => {
      const name = `go_${uid()}`;
      await createArticle(me.token, [name.toUpperCase()]).expect(201);
      await createArticle(me.token, [name]).expect(201);
      expect(await db.getRepository(Tag).countBy({ name })).toBe(1);
      const list = await http()
        .get(`/api/articles?tag=${name.toUpperCase()}`)
        .expect(200);
      expect(list.body.articlesCount).toBe(2);
    });
  });

  describe('ISS-22 image của user phải là URL http(s)', () => {
    const putImage = (image: unknown) =>
      http().put('/api/user').set(auth(me.token)).send({ user: { image } });

    it.each([
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      'ftp://example.com/a.png',
      'not a url',
      '/relative/a.png',
    ])('%s → 422 image is invalid', async (image) => {
      const res = await putImage(image).expect(422);
      expect(res.body).toEqual({ errors: { image: ['is invalid'] } });
    });

    it.each(['https://example.com/a.png', 'http://localhost:3000/a.png'])(
      '%s → 200',
      async (image) => {
        const res = await putImage(image).expect(200);
        expect(res.body.user.image).toBe(image);
      },
    );

    it('"" và null vẫn xoá ảnh (spec auth.hurl)', async () => {
      expect((await putImage('').expect(200)).body.user.image).toBeNull();
      expect((await putImage(null).expect(200)).body.user.image).toBeNull();
    });
  });
});

// App riêng với giới hạn thấp: cả bộ e2e chạy với LOGIN_THROTTLE_LIMIT=1000 (vitest.config.e2e.ts).
describe('ISS-20 giới hạn số lần đăng nhập theo IP (e2e)', () => {
  let app: INestApplication<App>;
  const LIMIT = 3;
  const login = (lang = '') =>
    request(app.getHttpServer())
      .post(`/api/users/login${lang}`)
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

  it('quá giới hạn → 429 {"errors":{"request":[…]}} + Retry-After; đăng ký không bị chặn', async () => {
    for (let i = 0; i < LIMIT; i++) await login().expect(401);
    const res = await login().expect(429);
    expect(res.body).toEqual({
      errors: { request: ['too many attempts, try again later'] },
    });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);

    const vi = await login('?lang=vi').expect(429);
    expect(vi.body.errors.request[0]).toBe(
      'thử quá nhiều lần, vui lòng thử lại sau',
    );

    await registerUser(app, 'thr');
  });
});
