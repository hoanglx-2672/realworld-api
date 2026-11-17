import { HttpStatus } from '@nestjs/common';

/** Lỗi không do mình ném (Nest/Express tự sinh): field + key i18n theo mã trạng thái. */
export const FRAMEWORK_ERRORS: Partial<Record<number, [string, string]>> = {
  // JSON hỏng → 'body'; path sai mã hoá (/api/x/%FF) → 'request' (xem frameworkErrorField)
  [HttpStatus.BAD_REQUEST]: ['body', 'errors.malformed'],
  [HttpStatus.NOT_FOUND]: ['path', 'errors.notFound'], // route không tồn tại
  [HttpStatus.PAYLOAD_TOO_LARGE]: ['body', 'errors.tooLarge'], // > 100 kB
  [HttpStatus.TOO_MANY_REQUESTS]: ['request', 'errors.tooManyRequests'], // ThrottlerGuard
};

/**
 * Lỗi validation "gốc", theo thứ tự ưu tiên: khi một cái hỏng thì chỉ trả câu của nó, vì
 * các lỗi còn lại chỉ là hệ quả (username = 123 → `is too long` vô nghĩa).
 * Spec: field trống → đúng một câu `can't be blank` (bộ test kiểm `[0]`).
 */
export const ROOT_CONSTRAINTS = [
  'isDefined',
  'isNotEmpty',
  'isObject',
  'isArray',
  'isString',
  'isInt',
];

/** Mã lỗi Postgres khi vi phạm ràng buộc unique. */
export const PG_UNIQUE_VIOLATION = '23505';
