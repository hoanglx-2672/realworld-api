/**
 * Chuẩn hoá tên tag: cắt khoảng trắng + chữ thường, để "NestJS" và "nestjs" là một tag (ISS-21).
 * Dùng cho cả tagList khi ghi và `?tag=` khi lọc, nên lọc không phân biệt hoa thường.
 * Giá trị không phải chuỗi giữ nguyên để validator báo lỗi đúng kiểu.
 */
export const normalizeTag = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
