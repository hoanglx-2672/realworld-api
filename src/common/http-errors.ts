import { HttpException, HttpStatus } from '@nestjs/common';
import { t } from '@nestjs/i18n';
import { QueryFailedError } from 'typeorm';
import {
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from './constants/error.constants.js';

/**
 * Lỗi theo định dạng spec RealWorld: {"errors": {"<field>": ["<câu đã dịch>"]}}.
 * `key` là key i18n, ví dụ `errors.taken`.
 */
export function errorsException(
  status: HttpStatus,
  field: string,
  key: string,
): HttpException {
  return new HttpException({ errors: { [field]: [t(key)] } }, status);
}

/**
 * Nếu `error` là lỗi unique của Postgres thì trả tên cột bị trùng
 * (đọc từ detail: `Key (email)=(a@b.c) already exists.`), không thì undefined.
 */
export function uniqueViolationColumn(error: unknown): string | undefined {
  return violatedColumn(error, PG_UNIQUE_VIOLATION);
}

/**
 * Nếu `error` là lỗi khoá ngoại của Postgres khi ghi (dòng được trỏ tới vừa bị xoá) thì trả
 * tên cột khoá ngoại (`Key (article_id)=(5) is not present in table …`), không thì undefined.
 */
export function foreignKeyViolationColumn(error: unknown): string | undefined {
  return violatedColumn(error, PG_FOREIGN_KEY_VIOLATION);
}

/** Tên cột trong detail của Postgres (`Key (<cột>)=(…) …`) nếu `error` mang đúng mã `code`. */
function violatedColumn(error: unknown, code: string): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  const driverError = error.driverError as { code?: string; detail?: string };
  if (driverError.code !== code) return undefined;
  return /Key \((\w+)\)/.exec(driverError.detail ?? '')?.[1];
}
