import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  createTestApp,
  registerUser,
  type TestUser,
  uid,
} from './support/create-test-app.js';

// Nhận xét review PR #9: tags chưa có e2e riêng.
describe('GET /api/tags (e2e)', () => {
  let app: INestApplication<App>;
  let me: TestUser;
  const id = uid();

  const http = () => request(app.getHttpServer());
  const createArticle = (tagList: string[]) =>
    http()
      .post('/api/articles')
      .set('Authorization', `Token ${me.token}`)
      .send({
        article: { title: `t ${uid()}`, description: 'd', body: 'b', tagList },
      })
      .expect(201);
  const tags = async (): Promise<string[]> =>
    (await http().get('/api/tags').expect(200)).body.tags;

  beforeAll(async () => {
    app = await createTestApp();
    me = await registerUser(app, 'tag');
  });
  afterAll(() => app.close());

  it('TAG-01 không cần đăng nhập; trả {"tags": [...]} gồm tag đang được dùng', async () => {
    await createArticle([`dragons_${id}`]);
    expect(await tags()).toContain(`dragons_${id}`);
  });

  it('TAG-02 thứ tự giống tagList của article (so theo mã ký tự, không theo collation của DB)', async () => {
    // en_US.utf8 bỏ qua dấu "-" khi so: "cats" đứng trước "c-sharp"; JS sort() thì ngược lại.
    const names = [`cats_${id}`, `c-sharp_${id}`];
    const res = await createArticle(names);
    const ours = (await tags()).filter((t) => names.includes(t));
    expect(ours).toEqual(res.body.article.tagList);
    expect(ours).toEqual([...names].sort());
  });

  it('TAG-03 xoá bài cuối cùng mang tag → tag biến khỏi danh sách', async () => {
    const name = `orphan_${id}`;
    const res = await createArticle([name]);
    expect(await tags()).toContain(name);
    await http()
      .delete(`/api/articles/${res.body.article.slug}`)
      .set('Authorization', `Token ${me.token}`)
      .expect(204);
    expect(await tags()).not.toContain(name);
  });
});
