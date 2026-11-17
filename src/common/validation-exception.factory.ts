import { UnprocessableEntityException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { ROOT_CONSTRAINTS } from './constants/error.constants.js';
import type { ErrorsBody } from './types/errors-body.type.js';

/**
 * Đổi lỗi class-validator (đã được I18nValidationPipe dịch) sang định dạng spec:
 * 422 {"errors": {"email": ["is invalid"]}}.
 * DTO lồng ({"user": {"email": ...}}) → key là tên field lá (`email`, không phải `user.email`).
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): UnprocessableEntityException {
  const result: ErrorsBody['errors'] = {};

  const collect = (list: ValidationError[]) => {
    for (const error of list) {
      const constraints = error.constraints ?? {};
      const names = Object.keys(constraints);
      if (names.length) {
        const root = ROOT_CONSTRAINTS.find((n) => n in constraints);
        // Body không phải object (vd. `[]`) → class-validator báo 'unknownValue' không có property.
        result[error.property || 'body'] = root
          ? [constraints[root]]
          : [...new Set(names.map((n) => constraints[n]))];
      }
      if (error.children?.length) collect(error.children);
    }
  };
  collect(errors);

  return new UnprocessableEntityException({ errors: result });
}
