import { QueryFailedError } from 'typeorm';
import {
  foreignKeyViolationColumn,
  uniqueViolationColumn,
} from './http-errors.js';

const pgError = (code: string, detail?: string) =>
  new QueryFailedError(
    'INSERT ...',
    [],
    Object.assign(new Error('pg'), { code, detail }),
  );

describe('uniqueViolationColumn', () => {
  it('lỗi unique 23505 → tên cột trong detail', () => {
    const error = pgError('23505', 'Key (email)=(a@b.c) already exists.');
    expect(uniqueViolationColumn(error)).toBe('email');
  });

  it('mã lỗi khác (khoá ngoại 23503) → undefined', () => {
    const error = pgError('23503', 'Key (author_id)=(9) is not present.');
    expect(uniqueViolationColumn(error)).toBeUndefined();
  });

  it('23505 nhưng detail lạ / thiếu → undefined', () => {
    expect(uniqueViolationColumn(pgError('23505', 'whatever'))).toBeUndefined();
    expect(uniqueViolationColumn(pgError('23505'))).toBeUndefined();
  });

  it('không phải QueryFailedError → undefined', () => {
    expect(uniqueViolationColumn(new Error('x'))).toBeUndefined();
    expect(uniqueViolationColumn('chuỗi')).toBeUndefined();
  });
});

describe('foreignKeyViolationColumn', () => {
  it('lỗi khoá ngoại 23503 → tên cột trong detail', () => {
    const error = pgError(
      '23503',
      'Key (article_id)=(5) is not present in table "articles".',
    );
    expect(foreignKeyViolationColumn(error)).toBe('article_id');
  });

  it('mã lỗi khác (unique 23505) → undefined', () => {
    const error = pgError('23505', 'Key (email)=(a@b.c) already exists.');
    expect(foreignKeyViolationColumn(error)).toBeUndefined();
  });

  it('không phải QueryFailedError → undefined', () => {
    expect(foreignKeyViolationColumn(new Error('x'))).toBeUndefined();
  });
});
