import { HttpException } from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';
import type { Article } from '../articles/article.entity.js';
import type { User } from '../users/user.entity.js';
import type { Comment } from './comment.entity.js';
import { CommentsService } from './comments.service.js';

describe('CommentsService.create', () => {
  const pgError = (code: string, detail: string) =>
    new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error(detail), { code, detail }),
    );

  const serviceWith = (saveError: Error) => {
    const comments = {
      create: vi.fn((v: unknown) => v),
      save: vi.fn(async () => {
        throw saveError;
      }),
    } as unknown as Repository<Comment>;
    const articles = {
      findOne: vi.fn(async () => ({ id: 5 })),
    } as unknown as Repository<Article>;
    return new CommentsService(comments, articles, {} as Repository<User>);
  };

  it('CMT-X08 bài bị xoá giữa lúc tra và lúc ghi (khoá ngoại article_id) → 404, không 500', async () => {
    const service = serviceWith(
      pgError(
        '23503',
        'Key (article_id)=(5) is not present in table "articles".',
      ),
    );
    const error = await service
      .create('s', 1, { body: 'x' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(404);
  });

  it('lỗi khoá ngoại ở cột khác (author_id) → ném nguyên lỗi gốc', async () => {
    const original = pgError(
      '23503',
      'Key (author_id)=(1) is not present in table "users".',
    );
    const error = await serviceWith(original)
      .create('s', 1, { body: 'x' })
      .catch((e: unknown) => e);
    expect(error).toBe(original);
  });
});
