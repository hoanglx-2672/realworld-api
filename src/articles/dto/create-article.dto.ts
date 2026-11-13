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

export const TITLE_MAX_LENGTH = 255;
export const DESCRIPTION_MAX_LENGTH = 1000;
export const BODY_MAX_LENGTH = 100_000;
export const TAG_MAX_LENGTH = 50;
export const TAGS_MAX = 20;

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
