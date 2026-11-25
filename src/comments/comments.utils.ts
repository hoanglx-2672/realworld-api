import { type HttpException, HttpStatus } from '@nestjs/common';
import { errorsException } from '../common/http-errors.js';
import { COMMENT_ID_MAX, COMMENT_ID_PATTERN } from './comments.constants.js';

/** 404 {"errors": {"comment": ["not found"]}} */
export const commentNotFoundException = (): HttpException =>
  errorsException(HttpStatus.NOT_FOUND, 'comment', 'errors.notFound');

/** 403 {"errors": {"comment": ["forbidden"]}}: không phải tác giả comment. */
export const commentForbiddenException = (): HttpException =>
  errorsException(HttpStatus.FORBIDDEN, 'comment', 'errors.forbidden');

/**
 * `:id` hợp lệ là số nguyên dương trong int4. Còn lại (`abc`, `1.5`, `1e3`, `-1`, `0`, quá lớn)
 * → undefined, để trả 404 "comment not found" thay vì để Postgres báo lỗi (→ 500).
 */
export function parseCommentId(raw: string): number | undefined {
  if (!COMMENT_ID_PATTERN.test(raw)) return undefined;
  const id = Number(raw);
  return id >= 1 && id <= COMMENT_ID_MAX ? id : undefined;
}
