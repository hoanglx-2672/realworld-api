import type { FindOptionsOrder, FindOptionsRelations } from 'typeorm';
import type { Article } from './article.entity.js';

export const TITLE_MAX_LENGTH = 255;
export const DESCRIPTION_MAX_LENGTH = 1000;
export const BODY_MAX_LENGTH = 100_000;
export const TAG_MAX_LENGTH = 50;
export const TAGS_MAX = 20;

export const LIST_LIMIT_DEFAULT = 20;
export const LIST_LIMIT_MAX = 100;
/**
 * tag / author / favorited: có mặt thì không được rỗng (`?author=` → 422, không lặng lẽ bỏ lọc
 * và trả mọi bài). Dài hơn giới hạn thì chắc chắn không khớp gì; chặn để không đẩy chuỗi
 * khổng lồ vào truy vấn.
 */
export const FILTER_MAX_LENGTH = 255;
/**
 * `offset=1e20` vẫn qua @IsInt (Number.isInteger(1e20) === true) nhưng vượt bigint
 * của Postgres → 500. Chặn ở số nguyên an toàn lớn nhất của JS.
 */
export const OFFSET_MAX = Number.MAX_SAFE_INTEGER;

/** Phần chữ của slug tối đa 80 ký tự; title toàn emoji (không còn chữ) → "article". */
export const SLUG_BASE_MAX_LENGTH = 80;
export const SLUG_FALLBACK = 'article';
/** Hậu tố ngẫu nhiên base36 của slug: 6 ký tự (~2 tỉ khả năng). */
export const SLUG_SUFFIX_LENGTH = 6;
/** Số lần thử lại khi hậu tố ngẫu nhiên của slug trùng (gần như không xảy ra). */
export const SLUG_ATTEMPTS = 3;

/** Quan hệ cần nạp để trả một bài ra ngoài (author cho Profile, tags cho tagList). */
export const ARTICLE_VIEW_RELATIONS: FindOptionsRelations<Article> = {
  author: true,
  tags: true,
};

/**
 * Thứ tự danh sách bài: mới nhất trước, trùng giờ thì id lớn trước để phân trang ổn định.
 * Truy vấn lấy id của trang trong ArticlesService.list xếp theo đúng hai cột này.
 */
export const ARTICLE_LIST_ORDER: FindOptionsOrder<Article> = {
  createdAt: 'DESC',
  id: 'DESC',
};
