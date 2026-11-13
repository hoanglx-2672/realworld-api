import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  IfPresent,
  NoNulChar,
  Trim,
  TagNames,
  Wrapped,
} from '../../common/validators.js';
import {
  BODY_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  TAG_MAX_LENGTH,
  TAGS_MAX,
  TITLE_MAX_LENGTH,
} from './create-article.dto.js';

/**
 * Mọi field tuỳ chọn. tagList: không gửi = giữ tag cũ, `[]` = xoá hết,
 * `null` = 422 (articles.hurl:202–245).
 */
export class UpdateArticleDto {
  @Trim()
  @IfPresent()
  @IsNotEmpty()
  @IsString()
  @MaxLength(TITLE_MAX_LENGTH)
  @NoNulChar()
  title?: string;

  @IfPresent()
  @IsNotEmpty()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  @NoNulChar()
  description?: string;

  @IfPresent()
  @IsNotEmpty()
  @IsString()
  @MaxLength(BODY_MAX_LENGTH)
  @NoNulChar()
  body?: string;

  @IfPresent()
  @TagNames()
  @IsArray()
  @ArrayMaxSize(TAGS_MAX)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(TAG_MAX_LENGTH, { each: true })
  @NoNulChar({ each: true })
  tagList?: string[];
}

/** Body: {"article": {...}} */
export class UpdateArticleRequestDto {
  @Wrapped(() => UpdateArticleDto)
  article: UpdateArticleDto;
}
