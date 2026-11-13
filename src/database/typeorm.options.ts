import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { Article } from '../articles/article.entity.js';
import { Comment } from '../comments/comment.entity.js';
import { Tag } from '../tags/tag.entity.js';
import { User } from '../users/user.entity.js';

/**
 * Cấu hình DB dùng chung cho HAI nơi:
 *  - app Nest (TypeOrmModule.forRootAsync trong app.module.ts)
 *  - TypeORM CLI khi chạy migration (data-source.ts)
 * Để hai bên không bao giờ lệch nhau.
 */
export function typeOrmOptions(env: NodeJS.ProcessEnv): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 5432),
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    logging: env.DB_LOGGING === 'true',
    entities: [User, Article, Comment, Tag],
    // Chạy từ dist/ nên chỉ lấy file .js đã build.
    migrations: [join(import.meta.dirname, 'migrations', '*.js')],
    // KHÔNG dùng synchronize: mọi thay đổi bảng phải đi qua migration.
    synchronize: false,
  };
}
