import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim, Wrapped } from '../../common/validators.js';
import { EMAIL_MAX_LENGTH } from '../users.constants.js';

export class LoginUserDto {
  @Trim()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  // Không giới hạn độ dài ở login (ngoại lệ có chủ đích của luật MaxLength): chỉ so với hash,
  // bcrypt chỉ đọc 72 byte đầu; sai thế nào cũng là "credentials invalid", không lộ luật mật khẩu.
  @IsNotEmpty()
  @IsString()
  password: string;
}

/** Body: {"user": {"email", "password"}} */
export class LoginRequestDto {
  @Wrapped(() => LoginUserDto)
  user: LoginUserDto;
}
