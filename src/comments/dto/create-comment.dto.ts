import { IsString, MaxLength } from 'class-validator';
import { NoNulChar, NotBlank, Wrapped } from '../../common/validators.js';
import { COMMENT_BODY_MAX_LENGTH } from '../comments.constants.js';

export class CreateCommentDto {
  // Giữ nguyên khoảng trắng của nội dung; "   " vẫn tính là rỗng.
  @NotBlank()
  @IsString()
  @MaxLength(COMMENT_BODY_MAX_LENGTH)
  @NoNulChar()
  body: string;
}

/** Body: {"comment": {...}} */
export class CreateCommentRequestDto {
  @Wrapped(() => CreateCommentDto)
  comment: CreateCommentDto;
}
