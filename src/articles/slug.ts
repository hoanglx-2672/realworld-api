import { randomBytes } from 'node:crypto';
import {
  SLUG_BASE_MAX_LENGTH,
  SLUG_FALLBACK,
  SLUG_SUFFIX_LENGTH,
} from './articles.constants.js';

/**
 * "Học NestJS từ đầu: Đường đi!" → "hoc-nestjs-tu-dau-duong-di".
 * NFD tách chữ và dấu, bỏ dấu; `đ` không tách được nên đổi tay.
 * Không còn ký tự nào (title toàn emoji) → "article".
 */
export function slugify(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_BASE_MAX_LENGTH)
    .replace(/-+$/, '');
  return base || SLUG_FALLBACK;
}

/**
 * Slug duy nhất mà không cần hỏi DB trước: thêm hậu tố ngẫu nhiên base36
 * (SLUG_SUFFIX_LENGTH ký tự, ~2 tỉ khả năng). Hai bài trùng title vẫn ra hai slug khác nhau (spec đòi).
 */
export function uniqueSlug(title: string): string {
  const suffix = randomBytes(4)
    .readUInt32BE(0)
    .toString(36)
    .padStart(SLUG_SUFFIX_LENGTH, '0')
    .slice(-SLUG_SUFFIX_LENGTH);
  return `${slugify(title)}-${suffix}`;
}
