import { HttpException, HttpStatus } from '@nestjs/common';
import { t } from '@nestjs/i18n';
import { QueryFailedError } from 'typeorm';
import { PG_UNIQUE_VIOLATION } from './constants/error.constants.js';

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
  if (!(error instanceof QueryFailedError)) return undefined;
  const driverError = error.driverError as { code?: string; detail?: string };
  if (driverError.code !== PG_UNIQUE_VIOLATION) return undefined;
  return /Key \((\w+)\)/.exec(driverError.detail ?? '')?.[1];
}
