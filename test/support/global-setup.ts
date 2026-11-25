/// <reference types="vite/client" />
import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { typeOrmOptions } from '../../src/database/typeorm.options.js';
import { testDatabaseName } from './test-database.js';

type MigrationClass = new () => unknown;

/**
 * Chạy một lần trước và sau cả bộ e2e:
 *  - tạo DB test nếu chưa có, chạy migration (cùng bộ migration với app thật);
 *  - xoá sạch dữ liệu trước khi chạy (lần trước có thể dừng giữa chừng) và sau khi chạy xong.
 * Dọn ở đây chứ không ở afterAll của từng file: các file e2e chạy song song trên cùng DB,
 * file nào dọn sớm sẽ xoá mất dữ liệu của file khác đang chạy.
 */
export async function setup(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile();
  const name = testDatabaseName(process.env);

  // Kết nối vào DB dev (chắc chắn có) để tạo DB test.
  const admin = await new DataSource(typeOrmOptions(process.env)).initialize();
  try {
    const found: unknown[] = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    // Tên đã được testDatabaseName() giới hạn trong [a-z0-9_] nên ghép vào câu lệnh được.
    if (!found.length) await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.destroy();
  }

  await withTestDatabase(async (db) => {
    await db.runMigrations({ transaction: 'each' });
    await truncateAll(db);
  });
}

export async function teardown(): Promise<void> {
  await withTestDatabase(truncateAll);
}

async function withTestDatabase(
  work: (db: DataSource) => Promise<void>,
): Promise<void> {
  // Vite gom sẵn các file migration (.ts), không cần build ra dist/.
  const modules = import.meta.glob<Record<string, unknown>>(
    '../../src/database/migrations/*.ts',
    { eager: true },
  );
  const migrations = Object.values(modules).flatMap((m) =>
    Object.values(m).filter(
      (x): x is MigrationClass => typeof x === 'function',
    ),
  );
  const db = new DataSource({
    ...typeOrmOptions({
      ...process.env,
      DB_DATABASE: testDatabaseName(process.env),
    }),
    migrations,
  });
  await db.initialize();
  try {
    await work(db);
  } finally {
    await db.destroy();
  }
}

/** Xoá dữ liệu mọi bảng (trừ bảng lịch sử migration), đặt lại id về 1. */
async function truncateAll(db: DataSource): Promise<void> {
  const tables: { tablename: string }[] = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'",
  );
  if (!tables.length) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await db.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
