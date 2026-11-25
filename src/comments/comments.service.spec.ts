import { HttpException } from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';
import type { Article } from '../articles/article.entity.js';
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
    return new CommentsService(comments, articles);
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

describe('CommentsService.remove', () => {
  const serviceWith = (affected: number) => {
    const comments = {
      findOne: vi.fn(async () => ({ id: 7, author: { id: 1 } })),
      delete: vi.fn(async () => ({ affected })),
    } as unknown as Repository<Comment>;
    const articles = {
      findOne: vi.fn(async () => ({ id: 5 })),
    } as unknown as Repository<Article>;
    return new CommentsService(comments, articles);
  };

  it('DELETE khác đã xoá trước (affected = 0) → 404, không 204', async () => {
    const error = await serviceWith(0)
      .remove('s', '7', 1)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(404);
  });

  it('xoá được (affected = 1) → không lỗi', async () => {
    await expect(serviceWith(1).remove('s', '7', 1)).resolves.toBeUndefined();
  });
});
