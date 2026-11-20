import { type HttpException, HttpStatus } from '@nestjs/common';
import { errorsException } from '../common/http-errors.js';

/** 404 {"errors": {"article": ["not found"]}} */
export const articleNotFoundException = (): HttpException =>
  errorsException(HttpStatus.NOT_FOUND, 'article', 'errors.notFound');

/** 403 {"errors": {"article": ["forbidden"]}}: không phải tác giả. */
export const articleForbiddenException = (): HttpException =>
  errorsException(HttpStatus.FORBIDDEN, 'article', 'errors.forbidden');
