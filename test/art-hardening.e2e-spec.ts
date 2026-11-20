import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { Tag } from '../src/tags/tag.entity.js';
import { User } from '../src/users/user.entity.js';
import {
  createTestApp,
  registerUser,
  type TestUser,
  uid,
} from './support/create-test-app.js';

describe('articles hardening (e2e, art-4)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let author: TestUser;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Token ${token}` });
  const newArticle = (over: object = {}) => ({
    title: `Bài ${uid()}`,
    description: 'mô tả',
    body: 'nội dung',
    ...over,
  });
  const createArticle = async (token: string, over: object = {}) =>
    (
      await http()
        .post('/api/articles')
        .set(auth(token))
        .send({ article: newArticle(over) })
        .expect(201)
    ).body.article as { slug: string };

  /** User đăng ký rồi bị xoá thẳng trong DB: token vẫn đúng chữ ký. */
  const ghostToken = async () => {
    const ghost = await registerUser(app, 'ghost');
    await db.getRepository(User).delete({ username: ghost.username });
    return ghost.token;
  };

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    author = await registerUser(app, 'hard');
  });
  afterAll(() => app.close());

  describe('token của user đã bị xoá', () => {
    it('ART4-01 POST /articles → 401 token is invalid, không 500, không để lại tag', async () => {
      const token = await ghostToken();
      const tag = `orphan_${uid()}`;
      const res = await http()
        .post('/api/articles')
        .set(auth(token))
        .send({ article: newArticle({ tagList: [tag] }) })
        .expect(401);
      expect(res.body).toEqual({ errors: { token: ['is invalid'] } });
      expect(await db.getRepository(Tag).countBy({ name: tag })).toBe(0);
    });

    it('ART4-02 PUT / DELETE bài người khác bằng token ma → 401 (không phải 403)', async () => {
      const { slug } = await createArticle(author.token);
      const token = await ghostToken();
      await http()
        .put(`/api/articles/${slug}`)
        .set(auth(token))
        .send({ article: { body: 'x' } })
        .expect(401);
      await http().delete(`/api/articles/${slug}`).set(auth(token)).expect(401);
    });

    it('ART4-03 endpoint tuỳ chọn (GET /articles) với token ma → 401', async () => {
      const token = await ghostToken();
      await http().get('/api/articles').set(auth(token)).expect(401);
    });
  });

  describe('header Authorization sai dạng', () => {
    it.each(['Bearer abc', 'Token', 'Token ', 'abc'])(
      'ART4-04 endpoint tuỳ chọn với "%s" → 401 token is invalid (không coi là khách)',
      async (header) => {
        const res = await http()
          .get('/api/articles?limit=1')
          .set('Authorization', header)
          .expect(401);
        expect(res.body).toEqual({ errors: { token: ['is invalid'] } });
      },
    );

    it('ART4-05 endpoint bắt buộc với "Bearer <token đúng>" → 401 token is invalid', async () => {
      const res = await http()
        .get('/api/user')
        .set('Authorization', `Bearer ${author.token}`)
        .expect(401);
      expect(res.body).toEqual({ errors: { token: ['is invalid'] } });
    });

    it('ART4-06 không có header → endpoint tuỳ chọn cho qua, endpoint bắt buộc "is missing"', async () => {
      await http().get('/api/articles?limit=1').expect(200);
      const res = await http().get('/api/user').expect(401);
      expect(res.body).toEqual({ errors: { token: ['is missing'] } });
    });
  });

  describe('transaction + khoá dòng', () => {
    it('ART4-07 PUT và DELETE cùng lúc → bài không "sống lại"', async () => {
      for (let i = 0; i < 5; i++) {
        const { slug } = await createArticle(author.token, {
          tagList: [`race_${uid()}`],
        });
        const [put, del] = await Promise.all([
          http()
            .put(`/api/articles/${slug}`)
            .set(auth(author.token))
            .send({ article: { body: 'sửa', tagList: [`race_${uid()}`] } }),
          http().delete(`/api/articles/${slug}`).set(auth(author.token)),
        ]);
        expect([200, 404]).toContain(put.status);
        expect(del.status).toBe(204);
        await http().get(`/api/articles/${slug}`).expect(404);
      }
    });

    it('ART4-07b hai DELETE cùng lúc → một 204, một 404', async () => {
      for (let i = 0; i < 5; i++) {
        const { slug } = await createArticle(author.token);
        const responses = await Promise.all(
          [1, 2].map(() =>
            http().delete(`/api/articles/${slug}`).set(auth(author.token)),
          ),
        );
        const statuses = responses.map((r) => r.status).sort((a, b) => a - b);
        expect(statuses).toEqual([204, 404]);
      }
    });
  });

  describe('lớp bọc body và giới hạn độ dài của article', () => {
    it.each([
      ['thiếu "article"', {}],
      ['"article" là mảng', { article: [] }],
      ['"article" là chuỗi', { article: 'x' }],
    ])('ART4-08 %s → 422', async (_name, body) => {
      const res = await http()
        .post('/api/articles')
        .set(auth(author.token))
        .send(body)
        .expect(422);
      expect(res.body.errors.article).toBeDefined();
    });

    it.each([
      ['title 256 ký tự', { title: 'a'.repeat(256) }, 'title'],
      [
        'description 1001 ký tự',
        { description: 'a'.repeat(1001) },
        'description',
      ],
      [
        '21 tag',
        { tagList: Array.from({ length: 21 }, (_, i) => `t${i}`) },
        'tagList',
      ],
      ['tag 51 ký tự', { tagList: ['a'.repeat(51)] }, 'tagList'],
    ])('ART4-09 %s → 422', async (_name, over, field) => {
      const res = await http()
        .post('/api/articles')
        .set(auth(author.token))
        .send({ article: newArticle(over) })
        .expect(422);
      expect(res.body.errors[field]).toBeDefined();
    });

    it('ART4-10 PUT title 256 ký tự → 422', async () => {
      const { slug } = await createArticle(author.token);
      await http()
        .put(`/api/articles/${slug}`)
        .set(auth(author.token))
        .send({ article: { title: 'a'.repeat(256) } })
        .expect(422);
    });
  });

  describe('trạng thái theo người xem', () => {
    it('ART4-11 đã favorite + đang follow tác giả → favorited, following = true, favoritesCount = 1', async () => {
      const { slug } = await createArticle(author.token);
      const fan = await registerUser(app, 'fan');
      const users = db.getRepository(User);
      const [fanRow, authorRow] = await Promise.all([
        users.findOneByOrFail({ username: fan.username }),
        users.findOneByOrFail({ username: author.username }),
      ]);
      const articleId = (
        await db.query('SELECT id FROM articles WHERE slug = $1', [slug])
      )[0].id;
      // Chưa có API favorite/follow (ý 6, 7): ghi thẳng bảng nối.
      await db.query(
        'INSERT INTO favorites (article_id, user_id) VALUES ($1, $2)',
        [articleId, fanRow.id],
      );
      await db.query(
        'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
        [fanRow.id, authorRow.id],
      );

      const one = await http()
        .get(`/api/articles/${slug}`)
        .set(auth(fan.token))
        .expect(200);
      expect(one.body.article).toMatchObject({
        favorited: true,
        favoritesCount: 1,
        author: { following: true },
      });

      const guest = await http().get(`/api/articles/${slug}`).expect(200);
      expect(guest.body.article).toMatchObject({
        favorited: false,
        favoritesCount: 1,
        author: { following: false },
      });
    });
  });

  describe('i18n các lỗi của article', () => {
    it('ART4-12 ?lang=vi: 404 "không tìm thấy", 403 "không có quyền"', async () => {
      const nf = await http()
        .get(`/api/articles/khong-co-${uid()}?lang=vi`)
        .expect(404);
      expect(nf.body).toEqual({ errors: { article: ['không tìm thấy'] } });

      const { slug } = await createArticle(author.token);
      const other = await registerUser(app, 'other');
      const fb = await http()
        .delete(`/api/articles/${slug}?lang=vi`)
        .set(auth(other.token))
        .expect(403);
      expect(fb.body).toEqual({ errors: { article: ['không có quyền'] } });
    });
  });
});
