import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { testDatabaseName } from './test/support/test-database.js';

// Nạp .env như data-source.ts: không ghi đè biến đã có; CI không có .env thì dùng env của job.
if (existsSync('.env')) process.loadEnvFile();

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Tạo DB test, chạy migration, dọn dữ liệu trước và sau cả bộ e2e.
    globalSetup: ['./test/support/global-setup.ts'],
    env: {
      // App trong e2e nối vào DB test riêng, không ghi user rác vào DB dev.
      DB_DATABASE: testDatabaseName(process.env),
      // Giới hạn login (ISS-20) nới rộng cho cả bộ e2e;
      // test ISS-20 trong test/issues.e2e-spec.ts tự hạ xuống khi dựng app riêng.
      LOGIN_THROTTLE_LIMIT: '1000',
    },
  },
});
