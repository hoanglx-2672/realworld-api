import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import {
  createTestApp,
  registerUser,
  type TestUser,
  uid,
} from './support/create-test-app.js';

// Case ID: docs/features/articles/research.md
describe('articles (e2e)', () => {
  let app: INestApplication<App>;
  let author: TestUser;
  const id = uid();
  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

  const http = () => request(app.getHttpServer());
  const create = (article: unknown, token: string | null = author.token) => {
    const req = http().post('/api/articles').send({ article });
    return token ? req.set('Authorization', `Token ${token}`) : req;
  };
  const newArticle = (over: object = {}) => ({
    title: `Bài ${uid()}`,
    description: 'mô tả',
    body: 'nội dung',
    ...over,
  });

  beforeAll(async () => {
    app = await createTestApp();
    author = await registerUser(app, 'art');
  });
  afterAll(() => app.close());

  describe('POST /api/articles + GET /api/articles/:slug (art-1)', () => {
    let slug: string;

    it('ART-01 tạo bài có tag → 201', async () => {
      const res = await create(
        newArticle({
          title: `Test Article ${id}`,
          tagList: [`d_${id}`, `t_${id}`],
        }),
      ).expect(201);
      const a = res.body.article;
      expect(a).toMatchObject({
        title: `Test Article ${id}`,
        description: 'mô tả',
        body: 'nội dung',
        tagList: [`d_${id}`, `t_${id}`],
        favorited: false,
        favoritesCount: 0,
        author: {
          username: author.username,
          bio: null,
          image: null,
          following: false,
        },
      });
      expect(a.slug).toEqual(expect.any(String));
      expect(a.createdAt).toMatch(ISO);
      expect(a.updatedAt).toMatch(ISO);
      slug = a.slug;
    });

    it('ART-06 xem một bài (không token) → 200, đủ field', async () => {
      const res = await http().get(`/api/articles/${slug}`).expect(200);
      expect(res.body.article).toMatchObject({
        slug,
        title: `Test Article ${id}`,
        body: 'nội dung',
        tagList: [`d_${id}`, `t_${id}`],
        favorited: false,
        favoritesCount: 0,
        author: { username: author.username, following: false },
      });
    });

    it('ART-X08 xem bài có token → 200; token hỏng → 401', async () => {
      await http()
        .get(`/api/articles/${slug}`)
        .set('Authorization', `Token ${author.token}`)
        .expect(200);
      const res = await http()
        .get(`/api/articles/${slug}`)
        .set('Authorization', `Token ${author.token}x`)
        .expect(401);
      expect(res.body).toEqual({ errors: { token: ['is invalid'] } });
    });

    it('ART-E01 tạo không token → 401', async () => {
      const res = await create(newArticle(), null).expect(401);
      expect(res.body).toEqual({ errors: { token: ['is missing'] } });
    });

    it('ART-E02 slug không tồn tại → 404', async () => {
      const res = await http()
        .get(`/api/articles/unknown-slug-${id}`)
        .expect(404);
      expect(res.body).toEqual({ errors: { article: ['not found'] } });
    });

    it.each(['title', 'description', 'body'])(
      "ART-E04 %s rỗng → 422 can't be blank",
      async (field) => {
        const res = await create(newArticle({ [field]: '' })).expect(422);
        expect(res.body.errors[field][0]).toBe("can't be blank");
      },
    );

    it('ART-E05 hai bài trùng title → slug khác nhau', async () => {
      const title = `Dup Title ${id}`;
      const r1 = await create(newArticle({ title })).expect(201);
      const r2 = await create(newArticle({ title })).expect(201);
      expect(r1.body.article.slug).not.toBe(r2.body.article.slug);
    });

    it('ART-X01 title tiếng Việt → slug không dấu', async () => {
      const res = await create(
        newArticle({ title: 'Học NestJS từ đầu: Đường đi!' }),
      ).expect(201);
      expect(res.body.article.slug).toMatch(
        /^hoc-nestjs-tu-dau-duong-di-[a-z0-9]{6}$/,
      );
    });

    it('ART-X02 title chỉ có emoji → slug vẫn hợp lệ', async () => {
      const res = await create(newArticle({ title: '🐉🔥' })).expect(201);
      expect(res.body.article.slug).toMatch(/^article-[a-z0-9]{6}$/);
      await http().get(`/api/articles/${res.body.article.slug}`).expect(200);
    });

    it('ART-X04 tagList: trim, gộp trùng, sắp alphabet', async () => {
      const res = await create(
        newArticle({ tagList: [` z_${id} `, `a_${id}`, `z_${id}`] }),
      ).expect(201);
      expect(res.body.article.tagList).toEqual([`a_${id}`, `z_${id}`]);
    });

    it('ART-X04 tagList có phần tử rỗng / không phải mảng → 422', async () => {
      await create(newArticle({ tagList: ['ok', '  '] })).expect(422);
      await create(newArticle({ tagList: 'dragons' })).expect(422);
    });

    it('ART-X09 field lạ (slug, author) bị bỏ qua', async () => {
      const res = await create(
        newArticle({ slug: 'tu-dat-slug', author: { username: 'hacker' } }),
      ).expect(201);
      expect(res.body.article.slug).not.toBe('tu-dat-slug');
      expect(res.body.article.author.username).toBe(author.username);
    });
  });

  describe('PUT + DELETE /api/articles/:slug (art-2)', () => {
    let slug: string;
    let created: { createdAt: string; updatedAt: string };
    let other: TestUser;

    const update = (
      s: string,
      article: unknown,
      token: string | null = author.token,
    ) => {
      const req = http().put(`/api/articles/${s}`).send({ article });
      return token ? req.set('Authorization', `Token ${token}`) : req;
    };
    const remove = (s: string, token: string | null = author.token) => {
      const req = http().delete(`/api/articles/${s}`);
      return token ? req.set('Authorization', `Token ${token}`) : req;
    };

    beforeAll(async () => {
      other = await registerUser(app, 'other');
      const res = await create(
        newArticle({ title: `Sửa ${id}`, tagList: [`d_${id}`, `t_${id}`] }),
      ).expect(201);
      slug = res.body.article.slug;
      created = res.body.article;
    });

    it('ART-07 sửa body → slug/title/tag giữ nguyên, updatedAt đổi, createdAt không', async () => {
      await new Promise((r) => setTimeout(r, 15));
      const res = await update(slug, { body: 'Updated body content' }).expect(
        200,
      );
      const a = res.body.article;
      expect(a).toMatchObject({
        slug,
        title: `Sửa ${id}`,
        body: 'Updated body content',
        tagList: [`d_${id}`, `t_${id}`],
        createdAt: created.createdAt,
      });
      expect(a.updatedAt).not.toBe(created.updatedAt);
      const again = await http().get(`/api/articles/${slug}`).expect(200);
      expect(again.body.article.body).toBe('Updated body content');
    });

    it('ART-08 không gửi tagList → giữ tag cũ', async () => {
      const res = await update(slug, {
        body: 'Body without touching tags',
      }).expect(200);
      expect(res.body.article.tagList).toHaveLength(2);
    });

    it('ART-09 tagList [] → xoá hết tag', async () => {
      const res = await update(slug, { tagList: [] }).expect(200);
      expect(res.body.article.tagList).toEqual([]);
      const again = await http().get(`/api/articles/${slug}`).expect(200);
      expect(again.body.article.tagList).toEqual([]);
    });

    it('ART-10 tagList null → 422', async () => {
      await update(slug, { tagList: null }).expect(422);
    });

    it.each(['title', 'description', 'body'])(
      "PUT %s rỗng → 422 can't be blank",
      async (field) => {
        const res = await update(slug, { [field]: '' }).expect(422);
        expect(res.body.errors[field][0]).toBe("can't be blank");
      },
    );

    it('ART-E07 người khác sửa / xoá → 403 forbidden, bài còn nguyên', async () => {
      const r1 = await update(slug, { body: 'hack' }, other.token).expect(403);
      expect(r1.body).toEqual({ errors: { article: ['forbidden'] } });
      const r2 = await remove(slug, other.token).expect(403);
      expect(r2.body).toEqual({ errors: { article: ['forbidden'] } });
      const again = await http().get(`/api/articles/${slug}`).expect(200);
      expect(again.body.article.body).not.toBe('hack');
    });

    it('ART-E03 sửa / xoá không token → 401', async () => {
      await update(slug, { body: 'x' }, null).expect(401);
      await remove(slug, null).expect(401);
    });

    it('ART-E06 sửa / xoá slug không tồn tại → 404', async () => {
      const r1 = await update(`unknown-slug-${id}`, { body: 'x' }).expect(404);
      expect(r1.body).toEqual({ errors: { article: ['not found'] } });
      await remove(`unknown-slug-${id}`).expect(404);
    });

    it('ART-X03 đổi title → slug đổi, slug cũ 404', async () => {
      const res = await update(slug, { title: `Tiêu đề mới ${id}` }).expect(
        200,
      );
      const newSlug = res.body.article.slug;
      expect(newSlug).not.toBe(slug);
      expect(newSlug).toMatch(/^tieu-de-moi-/);
      await http().get(`/api/articles/${slug}`).expect(404);
      await http().get(`/api/articles/${newSlug}`).expect(200);
      slug = newSlug;
    });

    it('ART-X10 xoá bài có tag, comment, favorite → 204, không 500', async () => {
      const res = await create(newArticle({ tagList: [`x_${id}`] })).expect(
        201,
      );
      const s = res.body.article.slug;
      const ds = app.get(DataSource);
      const [{ id: articleId }] = await ds.query(
        'SELECT id FROM articles WHERE slug = $1',
        [s],
      );
      const [{ id: userId }] = await ds.query(
        'SELECT id FROM users WHERE username = $1',
        [author.username],
      );
      await ds.query(
        'INSERT INTO favorites(article_id, user_id) VALUES ($1, $2)',
        [articleId, userId],
      );
      await ds.query(
        'INSERT INTO comments(body, article_id, author_id) VALUES ($1, $2, $3)',
        ['c', articleId, userId],
      );
      await remove(s).expect(204);
      await http().get(`/api/articles/${s}`).expect(404);
    });

    it('ART-11 xoá → 204, GET lại 404 (chạy cuối nhóm)', async () => {
      const r = await remove(slug).expect(204);
      expect(r.text).toBe('');
      const res = await http().get(`/api/articles/${slug}`).expect(404);
      expect(res.body).toEqual({ errors: { article: ['not found'] } });
    });
  });

  describe('GET /api/articles — lọc + phân trang (art-3)', () => {
    let writer: TestUser;
    let reader: TestUser;
    const slugs: string[] = []; // theo thứ tự tạo: cũ → mới
    const tag = `pg_${id}`;
    const list = (query: string, token?: string) => {
      const req = http().get(`/api/articles${query}`);
      return token ? req.set('Authorization', `Token ${token}`) : req;
    };

    beforeAll(async () => {
      writer = await registerUser(app, 'page');
      reader = await registerUser(app, 'reader');
      for (let i = 1; i <= 3; i++) {
        const res = await create(
          newArticle({
            title: `Pagination ${i} ${id}`,
            tagList: i === 2 ? [tag] : [],
          }),
          writer.token,
        ).expect(201);
        slugs.push(res.body.article.slug);
      }
      // reader favorite bài 1 và follow writer — chưa có API, ghi thẳng vào DB
      const ds = app.get(DataSource);
      const userId = async (u: string) =>
        (await ds.query('SELECT id FROM users WHERE username = $1', [u]))[0].id;
      const [{ id: a1 }] = await ds.query(
        'SELECT id FROM articles WHERE slug = $1',
        [slugs[0]],
      );
      await ds.query(
        'INSERT INTO favorites(article_id, user_id) VALUES ($1, $2)',
        [a1, await userId(reader.username)],
      );
      await ds.query(
        'INSERT INTO follows(follower_id, following_id) VALUES ($1, $2)',
        [await userId(reader.username), await userId(writer.username)],
      );
    });

    it('ART-02 danh sách không token → 200, phần tử không có body', async () => {
      const res = await list('').expect(200);
      expect(res.body.articles).toEqual(expect.any(Array));
      expect(Number.isInteger(res.body.articlesCount)).toBe(true);
      expect(res.body.articlesCount).toBeGreaterThanOrEqual(3);
      const first = res.body.articles[0];
      expect(first).not.toHaveProperty('body');
      expect(first).toMatchObject({
        slug: expect.any(String),
        tagList: expect.any(Array),
        favorited: expect.any(Boolean),
        favoritesCount: expect.any(Number),
        author: { username: expect.any(String) },
      });
      expect(first.createdAt).toMatch(ISO);
    });

    it('ART-03 ?author= → chỉ bài của tác giả, mới nhất trước', async () => {
      const res = await list(`?author=${writer.username}`).expect(200);
      expect(res.body.articlesCount).toBe(3);
      expect(res.body.articles.map((a: { slug: string }) => a.slug)).toEqual(
        [...slugs].reverse(),
      );
    });

    it('ART-12/13 limit=1 → mới nhất; offset=1 → bài kế; articlesCount là tổng', async () => {
      const p1 = await list(`?author=${writer.username}&limit=1`).expect(200);
      expect(p1.body.articles).toHaveLength(1);
      expect(p1.body.articlesCount).toBe(3);
      expect(p1.body.articles[0].slug).toBe(slugs[2]);
      const p2 = await list(
        `?author=${writer.username}&limit=1&offset=1`,
      ).expect(200);
      expect(p2.body.articles[0].slug).toBe(slugs[1]);
      expect(p2.body.articlesCount).toBe(3);
    });

    it('ART-X07 offset vượt tổng → mảng rỗng, articlesCount vẫn đúng', async () => {
      const res = await list(`?author=${writer.username}&offset=10`).expect(
        200,
      );
      expect(res.body).toEqual({ articles: [], articlesCount: 3 });
    });

    it('ART-05 ?tag= → bài có tag', async () => {
      const res = await list(`?tag=${tag}`).expect(200);
      expect(res.body.articlesCount).toBe(1);
      expect(res.body.articles[0].slug).toBe(slugs[1]);
      expect(res.body.articles[0].tagList).toContain(tag);
    });

    it('?favorited=<username> → bài user đó đã favorite, có favoritesCount', async () => {
      const res = await list(`?favorited=${reader.username}`).expect(200);
      expect(res.body.articlesCount).toBe(1);
      expect(res.body.articles[0]).toMatchObject({
        slug: slugs[0],
        favoritesCount: 1,
      });
    });

    it('ART-04 có token → favorited / following theo người xem', async () => {
      const res = await list(`?author=${writer.username}`, reader.token).expect(
        200,
      );
      const bySlug = Object.fromEntries(
        res.body.articles.map((a: { slug: string }) => [a.slug, a]),
      );
      expect(bySlug[slugs[0]]).toMatchObject({
        favorited: true,
        author: { following: true },
      });
      expect(bySlug[slugs[1]]).toMatchObject({
        favorited: false,
        author: { following: true },
      });
      const anon = await list(`?author=${writer.username}`).expect(200);
      expect(anon.body.articles[2]).toMatchObject({
        favorited: false,
        author: { following: false },
      });
    });

    it('lọc kết hợp author + tag', async () => {
      const res = await list(`?author=${writer.username}&tag=${tag}`).expect(
        200,
      );
      expect(res.body.articlesCount).toBe(1);
      const none = await list(`?author=${reader.username}&tag=${tag}`).expect(
        200,
      );
      expect(none.body).toEqual({ articles: [], articlesCount: 0 });
    });

    it.each([
      ['limit=0', 'limit'],
      ['limit=-1', 'limit'],
      ['limit=abc', 'limit'],
      ['limit=1000', 'limit'],
      ['offset=-1', 'offset'],
    ])('ART-X05/X06 ?%s → 422', async (q, field) => {
      const res = await list(`?${q}`).expect(422);
      expect(res.body.errors[field]).toHaveLength(1);
    });
  });

  describe('hồi quy từ review (docs/features/articles/review.md)', () => {
    it('R-01 ký tự NUL trong slug → 404, không 500', async () => {
      await http().get('/api/articles/x%00').expect(404);
      await http()
        .delete('/api/articles/x%00')
        .set('Authorization', `Token ${author.token}`)
        .expect(404);
    });

    it.each(['tag', 'author', 'favorited'])(
      'R-01 ký tự NUL trong ?%s → 422, không 500',
      async (field) => {
        const res = await http().get(`/api/articles?${field}=a%00`).expect(422);
        expect(res.body.errors[field]).toHaveLength(1);
      },
    );

    it.each(['1e20', '1e21'])('R-02 ?offset=%s → 422, không 500', async (v) => {
      const res = await http().get(`/api/articles?offset=${v}`).expect(422);
      expect(res.body.errors.offset).toHaveLength(1);
    });

    it('R-04 chỉ đổi tagList → updatedAt vẫn đổi', async () => {
      const res = await create(newArticle()).expect(201);
      const before = res.body.article;
      await new Promise((r) => setTimeout(r, 15));
      const after = await http()
        .put(`/api/articles/${before.slug}`)
        .set('Authorization', `Token ${author.token}`)
        .send({ article: { tagList: [`r04_${id}`] } })
        .expect(200);
      expect(after.body.article.tagList).toEqual([`r04_${id}`]);
      expect(after.body.article.updatedAt).not.toBe(before.updatedAt);
      expect(after.body.article.createdAt).toBe(before.createdAt);
    });
  });
});
