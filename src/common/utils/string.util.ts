/** Postgres không lưu / so được ký tự NUL trong text (lỗi 22021 → 500): kiểm trước khi truy vấn. */
export const hasNulChar = (value: string): boolean => value.includes('\u0000');
