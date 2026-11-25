/** Nội dung comment tối đa 10.000 ký tự: đủ cho một bình luận dài, chặn body khổng lồ. */
export const COMMENT_BODY_MAX_LENGTH = 10_000;

/**
 * Cột `id` của comments là int4 (SERIAL): `:id` lớn hơn số này mà đưa vào truy vấn thì
 * Postgres lỗi 22003 (→ 500) thay vì "không thấy".
 */
export const COMMENT_ID_MAX = 2_147_483_647;

/** `:id` dạng số nguyên dương, tối đa 10 chữ số. */
export const COMMENT_ID_PATTERN = /^\d{1,10}$/;

/** Cột khoá ngoại trỏ tới bài: lỗi khoá ngoại ở cột này nghĩa là bài vừa bị xoá. */
export const COMMENT_ARTICLE_FK_COLUMN = 'article_id';
