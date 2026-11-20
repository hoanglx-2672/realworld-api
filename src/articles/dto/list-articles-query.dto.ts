import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NoNulChar, TagName } from '../../common/validators.js';
import {
  FILTER_MAX_LENGTH,
  LIST_LIMIT_DEFAULT,
  LIST_LIMIT_MAX,
  OFFSET_MAX,
} from '../articles.constants.js';

/**
 * GET /api/articles?tag=&author=&favorited=&limit=&offset=
 * Query string luôn là chuỗi → @Type(() => Number) đổi sang số ("abc" → NaN → @IsInt báo lỗi).
 * Giá trị mặc định gán ở đây được giữ nhờ `transform: true` (class-transformer tạo instance).
 */
export class ListArticlesQueryDto {
  @IsOptional()
  @TagName()
  @IsNotEmpty()
  @IsString()
  @MaxLength(FILTER_MAX_LENGTH)
  @NoNulChar()
  tag?: string;

  /** username tác giả */
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(FILTER_MAX_LENGTH)
  @NoNulChar()
  author?: string;

  /** username người đã favorite */
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(FILTER_MAX_LENGTH)
  @NoNulChar()
  favorited?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIST_LIMIT_MAX)
  limit: number = LIST_LIMIT_DEFAULT;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(OFFSET_MAX)
  offset: number = 0;
}
