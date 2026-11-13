import type { DataSourceOptions } from 'typeorm';
import { Article } from '../articles/article.entity.js';
import { Comment } from '../comments/comment.entity.js';
import { Tag } from '../tags/tag.entity.js';
import { User } from '../users/user.entity.js';

const REQUIRED_ENV = ['DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'] as const;

/**
 * Cấu hình DB dùng chung cho HAI nơi:
 *  - app Nest (TypeOrmModule.forRootAsync trong app.module.ts)
 *  - TypeORM CLI khi chạy migration (data-source.ts, thêm danh sách migration)
 * Để hai bên không bao giờ lệch nhau.
 */
export function typeOrmOptions(env: NodeJS.ProcessEnv): DataSourceOptions {
  // Thiếu thì báo ngay tên biến, thay vì để pg kết nối bằng user của hệ điều hành
  // rồi hỏng với lỗi xác thực khó hiểu sau mấy lần thử lại.
  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (missing.length) {
    throw new Error(
      `Thiếu biến môi trường: ${missing.join(', ')} (xem .env.example)`,
    );
  }
  return {
    type: 'postgres',
    // || thay vì ??: dòng `DB_PORT=` trong .env cho chuỗi rỗng, không phải undefined.
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    logging: env.DB_LOGGING === 'true',
    entities: [User, Article, Comment, Tag],
    // KHÔNG dùng synchronize: mọi thay đổi bảng phải đi qua migration.
    synchronize: false,
  };
}
