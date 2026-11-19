import {
  IsByteLength,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NoNulChar, Trim, Wrapped } from '../../common/validators.js';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN,
  USERNAME_MAX_LENGTH,
} from '../users.constants.js';

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
