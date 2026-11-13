import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Giới hạn login (ISS-20) nới rộng cho cả bộ e2e; test ISS-20 tự hạ xuống khi dựng app riêng.
    env: { LOGIN_THROTTLE_LIMIT: '1000' },
  },
});
