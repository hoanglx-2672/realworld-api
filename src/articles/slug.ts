import { randomBytes } from 'node:crypto';

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
    .slice(0, 80)
    .replace(/-+$/, '');
  return base || 'article';
}

/**
 * Slug duy nhất mà không cần hỏi DB trước: thêm 6 ký tự ngẫu nhiên base36
 * (~2 tỉ khả năng). Hai bài trùng title vẫn ra hai slug khác nhau (spec đòi).
 */
export function uniqueSlug(title: string): string {
  const suffix = randomBytes(4)
    .readUInt32BE(0)
    .toString(36)
    .padStart(6, '0')
    .slice(-6);
  return `${slugify(title)}-${suffix}`;
}
