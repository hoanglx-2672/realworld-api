import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NoNulChar, TagName } from '../../common/validators.js';

export const LIST_LIMIT_DEFAULT = 20;
export const LIST_LIMIT_MAX = 100;
/** tag / author / favorited: dài hơn thì chắc chắn không khớp gì; chặn để không đẩy chuỗi khổng lồ vào truy vấn. */
export const FILTER_MAX_LENGTH = 255;
/**
 * `offset=1e20` vẫn qua @IsInt (Number.isInteger(1e20) === true) nhưng vượt bigint
 * của Postgres → 500. Chặn ở số nguyên an toàn lớn nhất của JS.
 */
export const OFFSET_MAX = Number.MAX_SAFE_INTEGER;

/**
 * GET /api/articles?tag=&author=&favorited=&limit=&offset=
 * Query string luôn là chuỗi → @Type(() => Number) đổi sang số ("abc" → NaN → @IsInt báo lỗi).
 * Giá trị mặc định gán ở đây được giữ nhờ `transform: true` (class-transformer tạo instance).
 */
export class ListArticlesQueryDto {
  @IsOptional()
  @TagName()
  @IsString()
  @MaxLength(FILTER_MAX_LENGTH)
  @NoNulChar()
  tag?: string;

  /** username tác giả */
  @IsOptional()
  @IsString()
  @MaxLength(FILTER_MAX_LENGTH)
  @NoNulChar()
  author?: string;

  /** username người đã favorite */
  @IsOptional()
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
