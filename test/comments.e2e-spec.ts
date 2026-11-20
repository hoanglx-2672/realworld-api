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

// CMT-01…, CMT-E01…: case trong bộ API test Hurl của RealWorld; CMT-X01…: case thêm ngoài bộ đó.
describe('comments (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let alice: TestUser;
  let bob: TestUser;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Token ${token}` });
  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

  const createArticle = async (token: string): Promise<string> =>
    (
      await http()
        .post('/api/articles')
        .set(auth(token))
        .send({ article: { title: `c ${uid()}`, description: 'd', body: 'b' } })
        .expect(201)
    ).body.article.slug;
  const postComment = (slug: string, token: string, comment: unknown) =>
    http()
      .post(`/api/articles/${slug}/comments`)
      .set(auth(token))
      .send({ comment });
  const addComment = async (slug: string, token: string, body: string) =>
    (await postComment(slug, token, { body }).expect(201)).body.comment;
  const listComments = (slug: string, token?: string) =>
    http()
      .get(`/api/articles/${slug}/comments`)
      .set(token ? auth(token) : {});
  const deleteComment = (slug: string, id: number | string, token: string) =>
    http().delete(`/api/articles/${slug}/comments/${id}`).set(auth(token));

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    alice = await registerUser(app, 'cmta');
    bob = await registerUser(app, 'cmtb');
  });
  afterAll(() => app.close());

  describe('POST /api/articles/:slug/comments', () => {
    it('CMT-01 tạo comment → 201 đúng hình dạng Comment', async () => {
      const slug = await createArticle(alice.token);
      const res = await postComment(slug, alice.token, {
        body: 'Test comment body',
      }).expect(201);
      const { comment } = res.body;
      expect(Number.isInteger(comment.id)).toBe(true);
      expect(comment.body).toBe('Test comment body');
      expect(comment.createdAt).toMatch(ISO);
      expect(comment.updatedAt).toMatch(ISO);
      expect(comment.author).toEqual({
        username: alice.username,
        bio: null,
        image: null,
        following: false,
      });
    });

    it('CMT-E01 không token → 401 token is missing', async () => {
      const res = await http()
        .post('/api/articles/some-slug/comments')
        .send({ comment: { body: 'x' } })
        .expect(401);
      expect(res.body).toEqual({ errors: { token: ['is missing'] } });
    });

    it("CMT-E03 body rỗng → 422 can't be blank", async () => {
      const slug = await createArticle(alice.token);
      const res = await postComment(slug, alice.token, { body: '' }).expect(
        422,
      );
      expect(res.body).toEqual({ errors: { body: ["can't be blank"] } });
    });

    it.each([
      ['toàn khoảng trắng', { body: '   \n' }],
      ['thiếu body', {}],
      ['body null', { body: null }],
      ['body là số', { body: 5 }],
    ])('CMT-X01 %s → 422 một câu ở key body', async (_name, comment) => {
      const slug = await createArticle(alice.token);
      const res = await postComment(slug, alice.token, comment).expect(422);
      expect(Object.keys(res.body.errors)).toEqual(['body']);
      expect(res.body.errors.body).toHaveLength(1);
    });

    it.each([
      ['thiếu lớp bọc', { body: 'x' }],
      ['comment là mảng', { comment: [] }],
    ])('CMT-X02 %s → 422', async (_name, payload) => {
      const slug = await createArticle(alice.token);
      await http()
        .post(`/api/articles/${slug}/comments`)
        .set(auth(alice.token))
        .send(payload)
        .expect(422);
    });

    it('CMT-X10 body quá 10.000 ký tự → 422', async () => {
      const slug = await createArticle(alice.token);
      await postComment(slug, alice.token, {
        body: 'a'.repeat(10_001),
      }).expect(422);
    });

    it('CMT-E04 bài không có → 404 article not found', async () => {
      const res = await postComment(`unknown-${uid()}`, alice.token, {
        body: 'orphan',
      }).expect(404);
      expect(res.body).toEqual({ errors: { article: ['not found'] } });
    });

    it('CMT-X09 ?lang=vi → câu lỗi tiếng Việt', async () => {
      const res = await http()
        .post(`/api/articles/unknown-${uid()}/comments?lang=vi`)
        .set(auth(alice.token))
        .send({ comment: { body: 'x' } })
        .expect(404);
      expect(res.body.errors.article[0]).not.toBe('not found');
    });
  });

  describe('GET /api/articles/:slug/comments', () => {
    it('CMT-02/03 có token và không token → 200, cùng nội dung', async () => {
      const slug = await createArticle(alice.token);
      const created = await addComment(slug, alice.token, 'Test comment body');
      for (const token of [alice.token, undefined]) {
        const res = await listComments(slug, token).expect(200);
        expect(res.body.comments).toHaveLength(1);
        expect(res.body.comments[0]).toEqual(created);
      }
    });

    it('bài chưa có comment → []', async () => {
      const slug = await createArticle(alice.token);
      const res = await listComments(slug).expect(200);
      expect(res.body).toEqual({ comments: [] });
    });

    it('mới nhất trước', async () => {
      const slug = await createArticle(alice.token);
      await addComment(slug, alice.token, 'first');
      await addComment(slug, bob.token, 'second');
      const res = await listComments(slug).expect(200);
      expect(res.body.comments.map((c: { body: string }) => c.body)).toEqual([
        'second',
        'first',
      ]);
    });

    it('CMT-X06 author.following theo người xem; khách → false', async () => {
      const slug = await createArticle(alice.token);
      await addComment(slug, bob.token, 'from bob');
      await db.query(
        `INSERT INTO follows (follower_id, following_id)
         SELECT a.id, b.id FROM users a, users b
         WHERE a.username = $1 AND b.username = $2`,
        [alice.username, bob.username],
      );
      const asAlice = await listComments(slug, alice.token).expect(200);
      expect(asAlice.body.comments[0].author.following).toBe(true);
      const asGuest = await listComments(slug).expect(200);
      expect(asGuest.body.comments[0].author.following).toBe(false);
    });

    it('CMT-E05 bài không có → 404 article not found', async () => {
      const res = await listComments(`unknown-${uid()}`).expect(404);
      expect(res.body).toEqual({ errors: { article: ['not found'] } });
    });

    it('CMT-X05 slug chứa NUL → 404 article not found, không 500', async () => {
      const res = await listComments('x%00').expect(404);
      expect(res.body).toEqual({ errors: { article: ['not found'] } });
      await postComment('x%00', alice.token, { body: 'x' }).expect(404);
      await deleteComment('x%00', 1, alice.token).expect(404);
    });

    it('CMT-X07 xoá bài → comment mất theo', async () => {
      const slug = await createArticle(alice.token);
      const c = await addComment(slug, alice.token, 'gone');
      await http()
        .delete(`/api/articles/${slug}`)
        .set(auth(alice.token))
        .expect(204);
      const rows = await db.query(`SELECT 1 FROM comments WHERE id = $1`, [
        c.id,
      ]);
      expect(rows).toHaveLength(0);
      await listComments(slug).expect(404);
    });
  });

  describe('DELETE /api/articles/:slug/comments/:id', () => {
    it('CMT-04/05 xoá một trong hai comment → 204, còn lại comment kia', async () => {
      const slug = await createArticle(alice.token);
      const first = await addComment(slug, alice.token, 'First comment');
      await addComment(slug, alice.token, 'Second comment');
      const res = await deleteComment(slug, first.id, alice.token).expect(204);
      expect(res.text).toBe('');
      const list = await listComments(slug).expect(200);
      expect(list.body.comments.map((c: { body: string }) => c.body)).toEqual([
        'Second comment',
      ]);
    });

    it('CMT-E02 không token → 401 token is missing', async () => {
      const res = await http()
        .delete('/api/articles/some-slug/comments/1')
        .expect(401);
      expect(res.body).toEqual({ errors: { token: ['is missing'] } });
    });

    it('CMT-E06 bài không có → 404 article (kiểm bài trước comment)', async () => {
      const res = await deleteComment(
        `unknown-${uid()}`,
        99999,
        alice.token,
      ).expect(404);
      expect(res.body).toEqual({ errors: { article: ['not found'] } });
    });

    it('CMT-E07 comment không có → 404 comment not found', async () => {
      const slug = await createArticle(alice.token);
      const res = await deleteComment(slug, 999999999, alice.token).expect(404);
      expect(res.body).toEqual({ errors: { comment: ['not found'] } });
    });

    it.each(['abc', '1.5', '-1', '1e3', '99999999999', '0'])(
      'CMT-X03 :id = %s → 404 comment not found, không 500',
      async (id) => {
        const slug = await createArticle(alice.token);
        const res = await deleteComment(slug, id, alice.token).expect(404);
        expect(res.body).toEqual({ errors: { comment: ['not found'] } });
      },
    );

    it('CMT-X04 comment thuộc bài khác → 404 comment not found, comment còn nguyên', async () => {
      const slugA = await createArticle(alice.token);
      const slugB = await createArticle(alice.token);
      const c = await addComment(slugA, alice.token, 'on A');
      const res = await deleteComment(slugB, c.id, alice.token).expect(404);
      expect(res.body).toEqual({ errors: { comment: ['not found'] } });
      expect(
        (await listComments(slugA).expect(200)).body.comments,
      ).toHaveLength(1);
    });

    it('CMT-E08 xoá comment của người khác → 403 comment forbidden, comment còn', async () => {
      const slug = await createArticle(alice.token);
      const c = await addComment(slug, alice.token, "A's comment");
      const res = await deleteComment(slug, c.id, bob.token).expect(403);
      expect(res.body).toEqual({ errors: { comment: ['forbidden'] } });
      const list = await listComments(slug).expect(200);
      expect(list.body.comments[0].body).toBe("A's comment");
    });

    it('chủ bài cũng không xoá được comment của người khác → 403', async () => {
      const slug = await createArticle(alice.token);
      const c = await addComment(slug, bob.token, 'bob on alice');
      await deleteComment(slug, c.id, alice.token).expect(403);
    });
  });
});
