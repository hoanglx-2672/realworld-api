import {
  IsByteLength,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  IfPresent,
  NoNulChar,
  Trim,
  Wrapped,
} from '../../common/validators.js';
import {
  BIO_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  IMAGE_URL_MAX_LENGTH,
  IMAGE_URL_OPTIONS,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN,
  USERNAME_MAX_LENGTH,
} from '../users.constants.js';

/**
 * Mọi field đều tuỳ chọn. Hai nhóm khác nhau khi gửi `null` / `""`:
 * - email, username, password: không được null/rỗng → 422 (bộ test errors_auth)
 * - bio, image: nhận null; `""` được service đổi thành null (bộ test auth)
 */
export class UpdateUserDto {
  @Trim()
  @IfPresent()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email?: string;

  @Trim()
  @IfPresent()
  @IsNotEmpty()
  @IsString()
  @MaxLength(USERNAME_MAX_LENGTH)
  @NoNulChar()
  username?: string;

  @IfPresent()
  @IsNotEmpty()
  @IsString()
  @MinLength(PASSWORD_MIN)
  @IsByteLength(0, PASSWORD_MAX_BYTES)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(BIO_MAX_LENGTH)
  @NoNulChar()
  bio?: string | null;

  // null / "" → xoá ảnh (service đổi "" thành null); còn lại phải là URL http(s) tuyệt đối (ISS-22):
  // chặn `javascript:` / `data:` lọt vào thẻ <img> của frontend.
  @ValidateIf((_o, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(IMAGE_URL_MAX_LENGTH)
  @IsUrl(IMAGE_URL_OPTIONS)
  @NoNulChar()
  image?: string | null;
}

/** Body: {"user": {...}} */
export class UpdateUserRequestDto {
  @Wrapped(() => UpdateUserDto)
  user: UpdateUserDto;
}
