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
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN,
  USERNAME_MAX_LENGTH,
} from './register-user.dto.js';

const BIO_MAX_LENGTH = 10_000;
const IMAGE_URL_MAX_LENGTH = 2048;
const IMAGE_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false, // cho phép http://localhost:3000/a.png khi dev
};

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
