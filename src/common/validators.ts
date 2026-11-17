import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsObject,
  Matches,
  ValidateBy,
  ValidateIf,
  ValidateNested,
  type ValidationOptions,
} from 'class-validator';
import { normalizeTag } from './utils/tag.util.js';

/** Cắt khoảng trắng đầu/cuối của chuỗi; `"   "` thành `""` để @IsNotEmpty bắt được. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/**
 * Như @IsNotEmpty nhưng chuỗi toàn khoảng trắng ("   ", "\n\t") cũng tính là rỗng — dùng cho
 * field không `@Trim()` vì nội dung cần giữ nguyên (description, body markdown).
 * Cùng tên constraint `isNotEmpty` → cùng câu "can't be blank" và cùng thứ tự ưu tiên lỗi.
 */
export const NotBlank = (options?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'isNotEmpty',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string'
            ? value.trim() !== ''
            : value !== '' && value !== null && value !== undefined,
      },
    },
    options,
  );

/** Postgres không lưu được ký tự NUL trong text/varchar (lỗi 22021 → 500). */
export const NoNulChar = (options?: ValidationOptions) =>
  // oxlint-disable-next-line no-control-regex -- cố ý bắt ký tự NUL
  Matches(/^[^\u0000]*$/, options);

/**
 * Lớp bọc body theo spec: {"user": {...}}, {"article": {...}}.
 * @IsObject chặn mảng / chuỗi (`{"user": []}` trước đây lọt qua @ValidateNested → 500).
 */
export const Wrapped = (type: () => new () => object) =>
  applyDecorators(IsDefined(), IsObject(), ValidateNested(), Type(type));

/**
 * Chỉ kiểm khi field có mặt (dùng cho DTO cập nhật).
 * Khác `@IsOptional()`: `@IsOptional` bỏ qua cả `null`, còn đây `null` vẫn bị kiểm (và bị từ chối).
 */
export const IfPresent = () =>
  ValidateIf((_object, value) => value !== undefined);

/** Một tag (query `?tag=`). */
export const TagName = () =>
  Transform(({ value }: { value: unknown }) => normalizeTag(value));

/** Mảng tag; không phải mảng thì để nguyên cho @IsArray báo lỗi. */
export const TagNames = () =>
  Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map(normalizeTag) : value,
  );
