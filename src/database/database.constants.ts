/** Biến môi trường bắt buộc để kết nối Postgres (xem .env.example). */
export const REQUIRED_DB_ENV = [
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
] as const;

export const DEFAULT_DB_HOST = 'localhost';
export const DEFAULT_DB_PORT = 5432;
