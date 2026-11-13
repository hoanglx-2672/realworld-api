import {
  IsByteLength,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NoNulChar, Trim, Wrapped } from '../../common/validators.js';

/**
 * Mật khẩu: tối thiểu 8 ký tự (NIST 800-63B, bộ test đòi);
 * tối đa 72 **byte** UTF-8 vì bcrypt bỏ qua phần sau byte 72 (đếm ký tự thì "é" lọt).
 */
export const PASSWORD_MIN = 8;
export const USERNAME_MAX_LENGTH = 255;
export const EMAIL_MAX_LENGTH = 255;
export const PASSWORD_MAX_BYTES = 72;

export class RegisterUserDto {
  @Trim()
  @IsNotEmpty()
  @IsString()
  @MaxLength(USERNAME_MAX_LENGTH)
  @NoNulChar()
  username: string;

  @Trim()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(PASSWORD_MIN)
  @IsByteLength(0, PASSWORD_MAX_BYTES)
  password: string;
}

/** Body: {"user": {...}} */
export class RegisterRequestDto {
  @Wrapped(() => RegisterUserDto)
  user: RegisterUserDto;
}
