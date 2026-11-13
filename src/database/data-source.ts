import { existsSync } from 'node:fs';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { typeOrmOptions } from './typeorm.options.js';

// TypeORM CLI không đi qua ConfigModule của Nest, nên tự nạp .env.
// Node >= 20.12 có sẵn process.loadEnvFile(), không cần gói dotenv.
// Không có .env (ví dụ trên CI) thì dùng biến môi trường sẵn có.
if (existsSync('.env')) process.loadEnvFile();

/** Điểm vào cho TypeORM CLI: `typeorm -d dist/database/data-source.js ...` */
export default new DataSource(typeOrmOptions(process.env));
