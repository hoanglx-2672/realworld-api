import { type HttpException, HttpStatus } from '@nestjs/common';
import { errorsException } from '../common/http-errors.js';
import type { Article } from './article.entity.js';

/** 404 {"errors": {"article": ["not found"]}} */
export const articleNotFoundException = (): HttpException =>
  errorsException(HttpStatus.NOT_FOUND, 'article', 'errors.notFound');

/** 403 {"errors": {"article": ["forbidden"]}}: không phải tác giả. */
export const articleForbiddenException = (): HttpException =>
  errorsException(HttpStatus.FORBIDDEN, 'article', 'errors.forbidden');

/**
 * Tag sắp alphabet: spec không quy định thứ tự, alphabet ổn định giữa các lần đọc.
 * So theo mã UTF-16, khớp ORDER BY ... COLLATE "C" của GET /tags.
 */
export const sortedTagNames = (article: Article): string[] =>
  (article.tags ?? []).map((t) => t.name).sort();
