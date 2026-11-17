import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { LowercaseTags1794400000000 } from '../src/database/migrations/1794400000000-LowercaseTags.js';
import { createTestApp, registerUser, uid } from './support/create-test-app.js';

// Nhận xét review PR #10: migration dữ liệu chưa có test. Dựng dữ liệu "cũ" (trước ISS-21)
// bằng SQL thẳng — app hiện tại không còn ghi được tag hoa — rồi chạy up() và kiểm.
describe('migration LowercaseTags (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  const id = uid();

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
  });
  afterAll(() => app.close());

  const newArticleId = async (token: string): Promise<number> => {
    const res = await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', `Token ${token}`)
      .send({ article: { title: `m ${uid()}`, description: 'd', body: 'b' } })
      .expect(201);
    const [row] = await db.query(`SELECT id FROM articles WHERE slug = $1`, [
      res.body.article.slug,
    ]);
    return row.id;
  };
  const insertTag = async (name: string): Promise<number> =>
    (
      await db.query(`INSERT INTO tags (name) VALUES ($1) RETURNING id`, [name])
    )[0].id;
  const link = (articleId: number, tagId: number) =>
    db.query(`INSERT INTO article_tags (article_id, tag_id) VALUES ($1, $2)`, [
      articleId,
      tagId,
    ]);
  const runUp = async () => {
    const runner = db.createQueryRunner();
    try {
      await new LowercaseTags1794400000000().up(runner);
    } finally {
      await runner.release();
    }
  };
  const tagsOf = async (articleId: number): Promise<string[]> =>
    (
      await db.query(
        `SELECT t.name FROM article_tags at JOIN tags t ON t.id = at.tag_id
         WHERE at.article_id = $1 ORDER BY t.name`,
        [articleId],
      )
    ).map((r: { name: string }) => r.name);

  it('gộp hoa/thường + khoảng trắng hai đầu vào tag chuẩn, giữ liên kết, không trùng', async () => {
    const { token } = await registerUser(app, 'mig');
    const canonical = `nestjs_${id}`;
    const a1 = await newArticleId(token);
    const a2 = await newArticleId(token);

    const lower = await insertTag(canonical); // tag chuẩn đã có sẵn
    const upper = await insertTag(`NestJS_${id}`);
    const spaced = await insertTag(`  NESTJS_${id} `);
    const vietnamese = await insertTag(`ĐÀ_${id}`);
    await link(a1, lower);
    await link(a1, upper); // a1 gắn cả hai → sau khi gộp chỉ còn một
    await link(a2, spaced);
    await link(a2, vietnamese);

    await runUp();

    expect(await tagsOf(a1)).toEqual([canonical]);
    expect(await tagsOf(a2)).toEqual([`nestjs_${id}`, `đà_${id}`].sort());
    const left = await db.query(
      `SELECT name FROM tags WHERE lower(btrim(name)) IN ($1, $2)`,
      [canonical, `đà_${id}`],
    );
    expect(left.map((r: { name: string }) => r.name).sort()).toEqual(
      [canonical, `đà_${id}`].sort(),
    );
  });

  it('chạy lại lần hai không đổi gì (idempotent)', async () => {
    const before = await db.query(`SELECT count(*)::int AS n FROM tags`);
    await runUp();
    const after = await db.query(`SELECT count(*)::int AS n FROM tags`);
    expect(after[0].n).toBe(before[0].n);
  });
});
