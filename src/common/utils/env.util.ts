/**
 * Số nguyên dương từ env; rỗng → mặc định. Sai (0, âm, "ten") thì dừng lúc khởi động:
 * ví dụ với giới hạn login, `Number('')` = 0 sẽ chặn mọi lần login, còn `NaN` thì tắt hẳn
 * việc chặn mà không ai biết.
 */
export function positiveInt(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new Error(`${name} phải là số nguyên dương (nhận: "${value}")`);
  }
  return n;
}
