/** DB riêng cho e2e khi `.env` không đặt DB_DATABASE_TEST. */
const DEFAULT_TEST_DATABASE = 'realworld_test';

/**
 * Tên DB cho e2e. Bộ e2e xoá sạch dữ liệu của DB này (global-setup.ts), nên chặn mọi
 * cấu hình có thể trỏ nhầm vào DB dev: tên phải kết thúc bằng `_test` và khác DB_DATABASE.
 */
export function testDatabaseName(env: NodeJS.ProcessEnv): string {
  const name = env.DB_DATABASE_TEST?.trim() || DEFAULT_TEST_DATABASE;
  if (!/^[a-z0-9_]+_test$/.test(name) || name === env.DB_DATABASE) {
    throw new Error(
      `DB_DATABASE_TEST="${name}" không hợp lệ: chỉ gồm a-z, 0-9, _, kết thúc bằng _test và khác DB_DATABASE`,
    );
  }
  return name;
}
