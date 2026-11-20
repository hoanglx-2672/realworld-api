import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  NoNulChar,
  NotBlank,
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
} from '../articles.constants.js';

export class CreateArticleDto {
  @Trim()
  @IsNotEmpty()
  @IsString()
  @MaxLength(TITLE_MAX_LENGTH)
  @NoNulChar()
  title: string;

  @NotBlank()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  @NoNulChar()
  description: string;

  @NotBlank()
  @IsString()
  @MaxLength(BODY_MAX_LENGTH)
  @NoNulChar()
  body: string;

  @IsOptional()
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
export class CreateArticleRequestDto {
  @Wrapped(() => CreateArticleDto)
  article: CreateArticleDto;
}
