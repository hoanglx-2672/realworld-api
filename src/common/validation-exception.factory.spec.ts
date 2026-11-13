import type { ValidationError } from 'class-validator';
import { validationExceptionFactory } from './validation-exception.factory.js';

const error = (
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError => ({ property, constraints, children });

const bodyOf = (errors: ValidationError[]) =>
  validationExceptionFactory(errors).getResponse();

describe('validationExceptionFactory', () => {
  it('trả 422 dạng {"errors": {field: [câu]}}', () => {
    const exception = validationExceptionFactory([
      error('email', { isEmail: 'is invalid' }),
    ]);
    expect(exception.getStatus()).toBe(422);
    expect(exception.getResponse()).toEqual({
      errors: { email: ['is invalid'] },
    });
  });

  it('DTO lồng {"user": {...}} → key là field lá, không có tiền tố user.', () => {
    expect(
      bodyOf([
        error('user', undefined, [
          error('username', { isNotEmpty: "can't be blank" }),
        ]),
      ]),
    ).toEqual({ errors: { username: ["can't be blank"] } });
  });

  it('có lỗi gốc → chỉ trả câu của lỗi gốc (QA-auth-02)', () => {
    expect(
      bodyOf([
        error('username', {
          isString: 'is invalid',
          maxLength: 'is too long (maximum is 255 characters)',
        }),
      ]),
    ).toEqual({ errors: { username: ['is invalid'] } });
  });

  it('lỗi gốc theo thứ tự ưu tiên: isDefined trước isNotEmpty', () => {
    expect(
      bodyOf([
        error('title', { isNotEmpty: 'x', isDefined: "can't be blank" }),
      ]),
    ).toEqual({ errors: { title: ["can't be blank"] } });
  });

  it('không có lỗi gốc → giữ mọi câu, bỏ câu trùng', () => {
    expect(
      bodyOf([
        error('tagList', {
          arrayMaxSize: 'is too long (maximum is 20 items)',
          maxLength: 'is too long (maximum is 50 characters)',
          noNul: 'is invalid',
          matches: 'is invalid',
        }),
      ]),
    ).toEqual({
      errors: {
        tagList: [
          'is too long (maximum is 20 items)',
          'is too long (maximum is 50 characters)',
          'is invalid',
        ],
      },
    });
  });

  it('lỗi không gắn field (body là [] → unknownValue) → key body, không phải "undefined"', () => {
    expect(
      bodyOf([
        {
          property: undefined as unknown as string,
          constraints: { unknownValue: 'is invalid' },
          children: [],
        },
      ]),
    ).toEqual({ errors: { body: ['is invalid'] } });
  });
});
